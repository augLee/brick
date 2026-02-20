import { NextResponse } from "next/server";
import visionPromptJson from "@/docs/prompts/vision.json";
import { getSupabaseAdminClient, publicBucket } from "@/lib/supabase";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// --- 타입 정의 ---
type VisionAnalysis = {
  subject_type:
    | "person"
    | "architecture"
    | "vehicle"
    | "animal"
    | "object"
    | "scene"
    | "other";
  confidence: number;
  key_features: string[];
  camera_hint: string;
  depth_hint?: string;
  negative_prompt: string;
  // 추가
  dominant_color?: string;   // "#RRGGBB"
  palette8?: string[];       // ["#....", ...] length=8
  mask64?: number[][];       // 64x64, each cell 0|1
};

type GeminiPart = {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
};

type ImagePayload = { mimeType: string; data: string };

type VisionPrompt = { system: string; user: string };

// OpenAI 응답 최소 타입(필요한 부분만)
type OpenAIChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type OpenAIImagesResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: { message?: string };
};

// --- 프롬프트 로딩 ---
const visionPrompt = visionPromptJson as unknown as VisionPrompt;

// --- 프롬프트 헬퍼 ---
const baseRenderPrompt = () => `
Rebuild the input photo as a fully 3D LEGO model (like an official LEGO set), NOT a flat mosaic.
Preserve the subject silhouette, proportions, and key parts.
Freestanding 3D object with real volume: visible side faces, layered bricks, separated components.
Studio product photography on clean off-white background (#FAF9F6), centered, sharp, realistic LEGO plastic.
No baseplate, no stand, no pedestal. Isolated object with a soft ground shadow only.
`.trim();


const subjectAddon = (type: string) => {
  const addons: Record<string, string> = {
    person:
      "For people, keep face/hair/clothing silhouette recognizable but simplify details into blocky bricks.",
    architecture:
      "For buildings, keep major facade lines and skyline, simplified into stepped brick geometry.",
    vehicle:
      "Build a fully 3D LEGO car model. Preserve wheelbase and body silhouette. Wheels must be perfectly circular with distinct tires and rims, centered on axles. Body must have 3D thickness and fenders/hood/cabin as separate volumes (not merged into a flat board).",
    animal:
      "For animals, preserve silhouette and key markings while using blocky brick forms.",
  };
  return addons[type] || "Convert the subject into a detailed brick-built model.";
};

const fallbackAnalysis: VisionAnalysis = {
  subject_type: "object",
  confidence: 0.4,
  key_features: ["subject silhouette"],
  camera_hint: "three-quarter angle",
  depth_hint: "center has most depth",
  negative_prompt: "blurry, text, watermark, logo, nudity, violence, weapons",

  dominant_color: "#1E88E5",
  palette8: ["#FFFFFF","#000000","#D9D9D9","#7A7A7A","#E53935","#1E88E5","#FDD835","#43A047"],
};

const SUPABASE_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const OPENAI_VISION_TIMEOUT_MS = Number(process.env.OPENAI_VISION_TIMEOUT_MS || 60000);
const GEMINI_IMAGE_TIMEOUT_MS = Number(process.env.GEMINI_IMAGE_TIMEOUT_MS || 45000);
const OPENAI_IMAGE_TIMEOUT_MS = Number(process.env.OPENAI_IMAGE_TIMEOUT_MS || 70000);
const OPENAI_VISION_MAX_TOKENS = Number(process.env.OPENAI_VISION_MAX_TOKENS || 900);
const FETCH_RETRY_COUNT = Number(process.env.FETCH_RETRY_COUNT || 2);
const FETCH_RETRY_BASE_DELAY_MS = Number(process.env.FETCH_RETRY_BASE_DELAY_MS || 500);

function logStep(traceId: string, step: string, data?: Record<string, unknown>) {
  if (data) {
    console.log(`[generate-render][${traceId}] ${step}`, data);
    return;
  }
  console.log(`[generate-render][${traceId}] ${step}`);
}

function shortHash(value: string) {
  return value.slice(0, 8);
}

function createEmptyMask64(): number[][] {
  return Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => 0));
}

function createCenterMask64(radiusRatio = 0.38): number[][] {
  const cx = 31.5, cy = 31.5;
  const r = 64 * radiusRatio;
  const r2 = r * r;
  return Array.from({ length: 64 }, (_, y) =>
    Array.from({ length: 64 }, (_, x) => {
      const dx = x - cx, dy = y - cy;
      return dx * dx + dy * dy <= r2 ? 1 : 0;
    })
  );
}

function maskCoverage(mask: number[][]): number {
  let on = 0;
  for (const row of mask) for (const v of row) if (v === 1) on++;
  return on / (64 * 64);
}

function clampMask64(mask: number[][]): number[][] {
  const cov = maskCoverage(mask);
  if (cov < 0.02 || cov > 0.92) return createCenterMask64();
  return mask;
}

// --- 유틸 ---
const HEX = /^#[0-9A-F]{6}$/;

function normalizeHex(s: string) {
  const up = s.trim().toUpperCase();
  return HEX.test(up) ? up : null;
}

function ensurePalette8(raw: unknown): string[] {
  const base = fallbackAnalysis.palette8!;
  const mustSoft = ["#000000", "#7A7A7A"]; // 휠 안정용(화이트/라이트그레이는 굳이 강제 X)

  const norm = Array.isArray(raw)
    ? raw
        .map((x) => (typeof x === "string" ? normalizeHex(x) : null))
        .filter((x): x is string => !!x)
    : [];

  // 분석 팔레트 순서 유지 + 중복 제거
  const out: string[] = [];
  for (const c of norm) if (!out.includes(c)) out.push(c);

  // 휠용 색 없으면만 뒤에 추가(순서 최대한 유지)
  for (const c of mustSoft) if (!out.includes(c)) out.push(c);

  // 8개 맞추기: 부족하면 fallback으로 채움
  for (const c of base) {
    if (out.length >= 8) break;
    if (!out.includes(c)) out.push(c);
  }

  return out.slice(0, 8);
}

function ensureMask64(raw: unknown): number[][] {
  const normalizeCell = (value: unknown): 0 | 1 => {
    if (value === 1 || value === "1" || value === true) return 1;
    if (value === 0 || value === "0" || value === false) return 0;
    return 0;
  };

  const to64Matrix = (rows: unknown[]): number[][] => {
    if (rows.length !== 64) return createEmptyMask64();
    const out: number[][] = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== 64) return createEmptyMask64();
      out.push(row.map((cell) => normalizeCell(cell)));
    }
    return out;
  };

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return createEmptyMask64();

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        if (parsed.length === 4096) {
          const out: number[][] = [];
          for (let y = 0; y < 64; y++) {
            const row: number[] = [];
            for (let x = 0; x < 64; x++) {
              row.push(normalizeCell(parsed[y * 64 + x]));
            }
            out.push(row);
          }
          return out;
        }

        if (Array.isArray(parsed[0])) {
          return to64Matrix(parsed);
        }
      }
    } catch {
      const flat = trimmed.replace(/[^01]/g, "");
      if (flat.length >= 4096) {
        const out: number[][] = [];
        for (let y = 0; y < 64; y++) {
          const row: number[] = [];
          for (let x = 0; x < 64; x++) {
            row.push(flat[y * 64 + x] === "1" ? 1 : 0);
          }
          out.push(row);
        }
        return out;
      }
      return createEmptyMask64();
    }
  }

  if (Array.isArray(raw) && raw.length === 4096) {
    const out: number[][] = [];
    for (let y = 0; y < 64; y++) {
      const row: number[] = [];
      for (let x = 0; x < 64; x++) {
        row.push(normalizeCell(raw[y * 64 + x]));
      }
      out.push(row);
    }
    return out;
  }

  if (Array.isArray(raw) && raw.length === 64 && raw.every((row) => Array.isArray(row))) {
    return to64Matrix(raw);
  }

  return createEmptyMask64();
}

function coerceAnalysis(raw: Partial<VisionAnalysis>): VisionAnalysis {
  return {
    ...fallbackAnalysis,
    ...raw,
    key_features: Array.isArray(raw.key_features) ? raw.key_features : fallbackAnalysis.key_features,
    dominant_color:
      typeof raw.dominant_color === "string" && normalizeHex(raw.dominant_color)
        ? normalizeHex(raw.dominant_color)!
        : fallbackAnalysis.dominant_color,
    palette8: ensurePalette8(raw.palette8),
    mask64: clampMask64(ensureMask64(raw.mask64)),
  };
}

/**
 * ✅ Edge-safe base64 인코딩 (Buffer 없이)
 */
function arrayBufferToBase64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function toBytesFromDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } {
  if (!dataUrl.startsWith("data:")) {
    throw new Error("이미지 데이터 URL 형식이 아닙니다.");
  }

  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("이미지 데이터 URL이 손상되었습니다.");

  const meta = dataUrl.slice(5, comma);
  const isBase64 = meta.includes(";base64");
  const rawMimeType = meta.split(";")[0]?.trim() || "image/png";
  const payload = dataUrl.slice(comma + 1);
  if (!payload) throw new Error("이미지 데이터가 비어 있습니다.");

  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { mimeType: rawMimeType, bytes };
  }

  const decoded = decodeURIComponent(payload);
  return { mimeType: rawMimeType, bytes: new TextEncoder().encode(decoded) };
}

function normalizeContentType(contentType: string) {
  return contentType.split(";")[0].trim().toLowerCase() || "image/png";
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      const timeoutError = new Error(`요청 타임아웃(${timeoutMs}ms)`);
      timeoutError.name = "AbortError";
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetryAndTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  retries = FETCH_RETRY_COUNT
): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(input, init, timeoutMs);
      if (!isRetryableStatus(res.status)) return res;
      if (attempt === retries) return res;
      await sleep(FETCH_RETRY_BASE_DELAY_MS * (attempt + 1));
    } catch (error: unknown) {
      lastError = error;
      if (!isRetryableError(error) || attempt === retries) throw error;
      await sleep(FETCH_RETRY_BASE_DELAY_MS * (attempt + 1));
    }
  }

  throw (lastError instanceof Error ? lastError : new Error("요청 실패"));
}

async function uploadRenderImageToSupabase(jobId: string, imageDataUrl: string): Promise<string> {
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) {
    throw new Error("SUPABASE 환경변수를 확인해주세요.");
  }

  const { mimeType: rawMimeType, bytes } = toBytesFromDataUrl(imageDataUrl);
  const contentType = normalizeContentType(rawMimeType);
  const ext = SUPABASE_MIME_TO_EXT[contentType] || SUPABASE_MIME_TO_EXT[rawMimeType] || "png";
  const filePath = `renders/${jobId}/preview.${ext}`;

  const { error } = await supabaseAdmin.storage.from(publicBucket).upload(filePath, bytes, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(error.message || "이미지 업로드 실패");
  }

  const { data } = supabaseAdmin.storage.from(publicBucket).getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error("업로드된 이미지의 URL을 가져오지 못했습니다.");
  }
  return data.publicUrl;
}

async function fetchInputImagePayload(inputImageUrl: string): Promise<ImagePayload> {
  const cleanUrl = inputImageUrl.trim();
  const imageRes = await fetchWithRetryAndTimeout(cleanUrl, {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0 BrickifyAI/1.0" },
  }, OPENAI_IMAGE_TIMEOUT_MS);

  if (!imageRes.ok) {
    const errorText = await imageRes.text().catch(() => "");
    throw new Error(
      `입력 이미지를 불러오지 못했습니다. status=${imageRes.status} / message=${errorText}`
    );
  }

  const mimeType = imageRes.headers.get("content-type")?.split(";")[0] || "image/png";
  const arrayBuffer = await imageRes.arrayBuffer();

  const base64Data = arrayBufferToBase64(arrayBuffer);
  return { mimeType, data: base64Data };
}

async function generateImageWithOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");

  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com";
  const project = process.env.OPENAI_PROJECT_ID?.trim();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  // 프로젝트 헤더는 proj_... 일 때만
  if (project && project.startsWith("proj_")) headers["OpenAI-Project"] = project;

  const res = await fetchWithRetryAndTimeout(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      prompt,
      size: "1024x1024",
    }),
  }, OPENAI_IMAGE_TIMEOUT_MS);

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI 이미지 생성 실패: ${res.status} ${t}`);
  }

  const data = (await res.json()) as OpenAIImagesResponse;
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI 이미지 생성 결과가 비었습니다.");
  return `data:image/png;base64,${b64}`;
}

/**
 * ✅ OpenAI: 분석 (JSON 응답)
 */
async function analyzeWithOpenAI(inputImageUrl: string): Promise<VisionAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");

  const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini";
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com";
  const project = process.env.OPENAI_PROJECT_ID?.trim();

  // 민감정보(키 전체) 로그 금지: 앞부분만
  console.log("[OPENAI] key head:", apiKey.slice(0, 8));
  console.log("[OPENAI] project:", project);
  console.log("[OPENAI] vision model:", model);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // 프로젝트 헤더는 "proj_..." ID만 허용 (이름 넣으면 401)
  if (project && project.startsWith("proj_")) {
    headers["OpenAI-Project"] = project;
  } else if (project) {
    console.warn("[OPENAI] OPENAI_PROJECT_ID must start with proj_. got:", project);
  }

  const maskInstruction = `
      Return strict JSON only.
      Required fields:
      - subject_type: "person" | "architecture" | "vehicle" | "animal" | "object" | "scene" | "other"
      - confidence: number
      - key_features: string[]
      - camera_hint: string
      - negative_prompt: string
      - dominant_color: "#RRGGBB"
      - palette8: exactly 8 unique "#RRGGBB" values
      - mask64: 64x64 binary matrix (array of 64 rows, each 64 cells, each cell is 0 or 1)
      Mask rule:
      - 1 means subject/lego-object area to include for BOM.
      - 0 means background to exclude from BOM.
      `.trim();
    
    const inputImagePayload = await fetchInputImagePayload(inputImageUrl);
    const dataUrl = `data:${inputImagePayload.mimeType};base64,${inputImagePayload.data}`;

    const res = await fetchWithRetryAndTimeout(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      max_tokens: OPENAI_VISION_MAX_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: visionPrompt.system },
        {
          role: "user",
          content: [
            { type: "text", text: visionPrompt.user },
            { type: "text", text: maskInstruction },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          ],
        },
      ],      
    }),
  }, OPENAI_VISION_TIMEOUT_MS);

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(
      `OpenAI 분석 실패: ${res.status} ${t} (model=${model}, project=${project ?? "none"})`
    );
  }

  const data = (await res.json()) as OpenAIChatCompletionsResponse;
  const content = data.choices?.[0]?.message?.content ?? "{}";

  let parsed: Partial<VisionAnalysis> = {};
  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content) as Partial<VisionAnalysis>;
    } catch {
      parsed = {};
    }
  }
  return coerceAnalysis(parsed);
}

function buildFallbackPreview(subjectType: string) {
  const label = `${subjectType.toUpperCase()} BRICK PREVIEW`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#FAF9F6"/><text x="512" y="512" text-anchor="middle" font-size="44" fill="#71717A">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// 요청 바디 최소 타입
type GenerateRenderRequestBody = {
  inputImageUrl?: unknown;
};

type GenerateRenderResponseBody = {
  jobId: string;
  previewImageUrl: string;
  palette8: string[];
  mask64: number[][];
  dominant_color?: string;
  storyText: string;
};

type StoredRenderIndex = GenerateRenderResponseBody & {
  inputImageUrl: string;
  createdAt: string;
};

function getRenderIndexPath(inputHash: string) {
  return `render-index/${inputHash}.json`;
}

function getRenderLockPath(inputHash: string) {
  return `render-locks/${inputHash}.lock`;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = new Uint8Array(digest);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isConflictError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { statusCode?: string | number; message?: string };
  const status = String(candidate.statusCode ?? "");
  const message = String(candidate.message ?? "").toLowerCase();
  return status === "409" || message.includes("already exists") || message.includes("duplicate");
}

async function loadExistingRenderIndex(inputHash: string): Promise<GenerateRenderResponseBody | null> {
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) throw new Error("SUPABASE 환경변수를 확인해주세요.");

  const { data, error } = await supabaseAdmin.storage
    .from(publicBucket)
    .download(getRenderIndexPath(inputHash));

  if (error) {
    return null;
  }

  const text = await data.text();
  const parsed = JSON.parse(text) as Partial<StoredRenderIndex>;

  if (
    typeof parsed.jobId !== "string" ||
    typeof parsed.previewImageUrl !== "string" ||
    !Array.isArray(parsed.palette8) ||
    typeof parsed.storyText !== "string"
  ) {
    return null;
  }

  return {
    jobId: parsed.jobId,
    previewImageUrl: parsed.previewImageUrl,
    palette8: parsed.palette8.filter((c): c is string => typeof c === "string"),
    mask64: ensureMask64(parsed.mask64),
    dominant_color: typeof parsed.dominant_color === "string" ? parsed.dominant_color : undefined,
    storyText: parsed.storyText,
  };
}

async function tryAcquireRenderLock(inputHash: string): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) throw new Error("SUPABASE 환경변수를 확인해주세요.");

  const { error } = await supabaseAdmin.storage
    .from(publicBucket)
    .upload(getRenderLockPath(inputHash), new TextEncoder().encode(new Date().toISOString()), {
      contentType: "text/plain",
      upsert: false,
    });

  if (!error) return true;
  if (isConflictError(error)) return false;
  throw new Error(error.message || "렌더 락 생성 실패");
}

async function releaseRenderLock(inputHash: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) return;
  await supabaseAdmin.storage.from(publicBucket).remove([getRenderLockPath(inputHash)]);
}

async function saveRenderIndex(inputHash: string, payload: StoredRenderIndex) {
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) throw new Error("SUPABASE 환경변수를 확인해주세요.");

  const { error } = await supabaseAdmin.storage
    .from(publicBucket)
    .upload(getRenderIndexPath(inputHash), new TextEncoder().encode(JSON.stringify(payload)), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message || "렌더 인덱스 저장 실패");
  }
}

type StoredJobMeta = {
  jobId: string;
  inputImageUrl: string;
  createdAt: string;
  subject_type: VisionAnalysis["subject_type"];
  confidence: number;
  key_features: string[];
  camera_hint: string;
  negative_prompt: string;
  dominant_color?: string;
  palette8: string[];
  mask64: number[][];
  previewImageUrl: string; // stored public url
};

async function saveJobMetaToSupabase(jobId: string, meta: StoredJobMeta) {
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) throw new Error("SUPABASE 환경변수를 확인해주세요.");

  const path = `renders/${jobId}/meta.json`;

  const { error } = await supabaseAdmin.storage
    .from(publicBucket)
    .upload(path, new TextEncoder().encode(JSON.stringify(meta)), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) throw new Error(error.message || "job meta 저장 실패");
}

// (선택) bom.json을 미리 만들어두면 download route가 단순해짐
// 지금은 실제 BOM 계산이 없으니 빈 배열로 저장(나중에 교체)
async function saveEmptyBomToSupabase(jobId: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) throw new Error("SUPABASE 환경변수를 확인해주세요.");

  const path = `renders/${jobId}/bom.json`;

  const { error } = await supabaseAdmin.storage
    .from(publicBucket)
    .upload(path, new TextEncoder().encode("[]"), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) throw new Error(error.message || "bom.json 저장 실패");
}

// --- 메인 API 핸들러 ---
export async function POST(req: Request) {
  let lockHash: string | null = null;
  const traceId = crypto.randomUUID().slice(0, 8);
  try {
    logStep(traceId, "request:start");
    const bodyUnknown = (await req.json().catch(() => ({}))) as unknown;
    const body = bodyUnknown as GenerateRenderRequestBody;

    const inputImageUrl = body.inputImageUrl;
    if (typeof inputImageUrl !== "string" || !inputImageUrl.trim()) {
      logStep(traceId, "request:invalid_input");
      return NextResponse.json({ error: "URL이 없습니다." }, { status: 400 });
    }
    const normalizedInputImageUrl = inputImageUrl.trim();
    logStep(traceId, "input:normalized", { length: normalizedInputImageUrl.length });

    logStep(traceId, "hash:compute:start");
    const inputHash = await sha256Hex(normalizedInputImageUrl);
    logStep(traceId, "hash:compute:done", { inputHash: shortHash(inputHash) });

    logStep(traceId, "cache:check:start");
    const existing = await loadExistingRenderIndex(inputHash);
    if (existing) {
      logStep(traceId, "cache:hit", { inputHash: shortHash(inputHash), jobId: existing.jobId });
      return NextResponse.json(existing);
    }
    logStep(traceId, "cache:miss", { inputHash: shortHash(inputHash) });

    logStep(traceId, "lock:acquire:start", { inputHash: shortHash(inputHash) });
    const acquired = await tryAcquireRenderLock(inputHash);
    if (!acquired) {
      logStep(traceId, "lock:acquire:conflict", { inputHash: shortHash(inputHash) });
      const existingAfterLock = await loadExistingRenderIndex(inputHash);
      if (existingAfterLock) {
        logStep(traceId, "cache:hit_after_conflict", { jobId: existingAfterLock.jobId });
        return NextResponse.json(existingAfterLock);
      }
      logStep(traceId, "request:in_progress_conflict");
      return NextResponse.json(
        { error: "이미 브릭 작품 생성이 진행 중입니다. 잠시 후 다시 시도해주세요." },
        { status: 409 }
      );
    }
    lockHash = inputHash;
    logStep(traceId, "lock:acquire:done", { inputHash: shortHash(inputHash) });

    // ✅ 분석은 OpenAI만 사용
    let analysis: VisionAnalysis = fallbackAnalysis;
    try {
      logStep(traceId, "vision:analyze:start");
      analysis = await analyzeWithOpenAI(normalizedInputImageUrl);
      logStep(traceId, "vision:analyze:done", {
        subject: analysis.subject_type,
        hasMask: Array.isArray(analysis.mask64),
      });
    } catch (err: unknown) {
      console.error(`[generate-render][${traceId}] vision:analyze:error`, err);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      analysis = isTimeout
        ? { ...fallbackAnalysis, mask64: createCenterMask64() }
        : fallbackAnalysis;
      logStep(traceId, "vision:analyze:fallback");
    }

    logStep(traceId, "prompt:build:start");
    const palette = (analysis.palette8?.length === 8 ? analysis.palette8 : fallbackAnalysis.palette8)!;
    //const paletteText = palette.join(", ");
    const paletteLines = palette.map((c, i) => `${i + 1}) ${c}`).join("\n");

    const colorConstraint = `
    COLOR CONSTRAINT (STRICT):
    Use EXACTLY these 8 flat colors only (no other colors):
    ${paletteLines}
    Any pixel outside the palette is forbidden.
    Replace any non-palette colors with the nearest palette color.
    No gradients, no shading, no dithering, no texture.
    `.trim();
    
    const wheelRule = `
    WHEELS:
    Wheels are ALLOWED if appropriate.
    Wheels/tires should use only #000000 or #7A7A7A (solid shapes, no gradients).
    `.trim();

    // ✅ 최종 프롬프트 구성
    // const finalPrompt = [
    //   baseRenderPrompt(),
    //   subjectAddon(analysis.subject_type),
    //    // 3D 강제
    //   "3D rules: full 3D object, freestanding, not attached to a vertical baseboard. No pixel mosaic. No wall art.",
    //   "Show depth clearly: visible side surfaces, undercarriage shadow, gaps between parts.",
    //   "Camera: 3/4 front view, slightly above, like a LEGO catalog product shot.",
    //   "Lighting: softbox studio, crisp highlights on plastic, soft shadow on ground.",
    //   `Key features: ${analysis.key_features.join(", ")}.`,
    //   "Style: simplified blocky LEGO geometry.",
    //   `Camera: ${analysis.camera_hint}.`,
    //   `Negative prompt: ${analysis.negative_prompt}.`,
    // ].join(" ");
    const finalPrompt = [
      baseRenderPrompt(),
      subjectAddon(analysis.subject_type),
      "3D rules: full 3D object, freestanding, not flat, not wall art.",
      "Camera: 3/4 front view, slightly above, like a LEGO catalog product shot.",
      "Lighting: softbox studio, crisp highlights on plastic, soft shadow on ground.",
      `Key features: ${analysis.key_features.join(", ")}.`,
      `Camera hint: ${analysis.camera_hint}.`,
      colorConstraint,
      wheelRule,
      `Negative prompt: ${analysis.negative_prompt}.`,
    ].join("\n\n");

    // ✅ moderation_blocked 완화: 이미지 생성에만 Safe Prefix
    const SAFE_PREFIX = `
      Create a clean studio product photo of a fully 3D LEGO model (official LEGO set style).
      Background: off-white (#FAF9F6). Centered. Sharp. Realistic LEGO plastic.
      Freestanding 3D object with visible side faces and depth. Soft ground shadow only.
      No text, no logos, no watermark.
      No nudity, no violence, no weapons, no hate symbols, no political content.
      If the input depicts a person, render as a generic LEGO minifigure-style toy (no real-person likeness).
      `.trim();


    const imagePrompt = `${SAFE_PREFIX}\n\n${finalPrompt}`;
    logStep(traceId, "prompt:build:done", { paletteSize: palette.length });

    let previewImageUrl = buildFallbackPreview(analysis.subject_type);
    logStep(traceId, "preview:init_fallback");

    // ✅ Gemini는 이미지 생성만 (키 있을 때만)
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
    const enableGemini = process.env.ENABLE_GEMINI === "true";

    const geminiImageModel =
      process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";

    // 1) Gemini로 이미지 생성 시도
    let geminiSucceeded = false;

    if (enableGemini && geminiApiKey) {
      try {
        logStep(traceId, "gemini:input_fetch:start");
        const imagePayload = await fetchInputImagePayload(normalizedInputImageUrl);
        logStep(traceId, "gemini:input_fetch:done", { mimeType: imagePayload.mimeType });

        logStep(traceId, "gemini:generate:start", { model: geminiImageModel });
        const geminiRes = await fetchWithRetryAndTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            geminiImageModel
          )}:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: imagePrompt }, // ✅ safe prompt 사용
                    {
                      inlineData: {
                        mimeType: imagePayload.mimeType,
                        data: imagePayload.data,
                      },
                    },
                  ],
                },
              ],
              generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
            }),
          },
          GEMINI_IMAGE_TIMEOUT_MS
        );

        if (geminiRes.ok) {
          logStep(traceId, "gemini:generate:response_ok");
          const geminiData = (await geminiRes.json()) as GeminiResponse;
          const b64Image =
            geminiData.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
              ?.inlineData?.data;

          if (b64Image) {
            previewImageUrl = `data:image/png;base64,${b64Image}`;
            geminiSucceeded = true;
            logStep(traceId, "gemini:generate:done");
          }
        } else {
          const t = await geminiRes.text().catch(() => "");
          console.warn(
            "Gemini image generation failed:",
            geminiRes.status,
            t,
            "model:",
            geminiImageModel
          );
          logStep(traceId, "gemini:generate:failed_status", { status: geminiRes.status });
        }
      } catch (err: unknown) {
        console.warn("Gemini image generation error:", err, "model:", geminiImageModel);
        logStep(traceId, "gemini:generate:error");
      }
    } else {
      logStep(traceId, "gemini:skip", { enableGemini, hasApiKey: Boolean(geminiApiKey) });
    }

    // 2) Gemini 실패 시 OpenAI 이미지 생성 fallback
    if (!geminiSucceeded) {
      try {
        logStep(traceId, "openai:image_fallback:start");
        //previewImageUrl = await generateImageWithOpenAI(imagePrompt); // ✅ safe prompt 사용
        previewImageUrl = await generateImageWithOpenAI2(normalizedInputImageUrl, imagePrompt); // ✅ safe prompt 사용
        logStep(traceId, "openai:image_fallback:done");
      } catch (err: unknown) {
        console.warn("OpenAI image fallback failed:", err);
        logStep(traceId, "openai:image_fallback:error");
      }
    }

    const jobId = crypto.randomUUID();
    logStep(traceId, "storage:upload_preview:start", { jobId });
    const storedPreviewImageUrl = await uploadRenderImageToSupabase(jobId, previewImageUrl);
    logStep(traceId, "storage:upload_preview:done");
    logStep(traceId, "storage:save_meta:start", { jobId });
    await saveJobMetaToSupabase(jobId, {
      jobId,
      inputImageUrl: normalizedInputImageUrl,
      createdAt: new Date().toISOString(),
      subject_type: analysis.subject_type,
      confidence: analysis.confidence,
      key_features: analysis.key_features,
      camera_hint: analysis.camera_hint,
      negative_prompt: analysis.negative_prompt,
      dominant_color: analysis.dominant_color,
      palette8: palette,
      mask64: clampMask64(analysis.mask64 ?? createCenterMask64()),
      previewImageUrl: storedPreviewImageUrl,
    });
    await saveEmptyBomToSupabase(jobId); // ✅ (선택) 일단 자리잡기
    logStep(traceId, "storage:save_meta:done", { jobId });

    const responseBody: GenerateRenderResponseBody = {
      jobId,
      previewImageUrl: storedPreviewImageUrl,
      palette8: palette,
      mask64: clampMask64(analysis.mask64 ?? createCenterMask64()),
      dominant_color: analysis.dominant_color,
      storyText: `${analysis.subject_type} 변환 완료`,
    };

    logStep(traceId, "index:save:start", { inputHash: shortHash(inputHash), jobId });
    await saveRenderIndex(inputHash, {
      ...responseBody,
      inputImageUrl: normalizedInputImageUrl,
      createdAt: new Date().toISOString(),
    });
    logStep(traceId, "index:save:done");

    logStep(traceId, "request:success", { jobId });
    return NextResponse.json(responseBody);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "서버 에러";
    console.error(`[generate-render][${traceId}] request:error`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (lockHash) {
      logStep(traceId, "lock:release:start", { inputHash: shortHash(lockHash) });
      await releaseRenderLock(lockHash);
      logStep(traceId, "lock:release:done");
    }
  }
}

async function generateImageWithOpenAI2(inputImageUrl: string, prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");

  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com";
  const project = process.env.OPENAI_PROJECT_ID?.trim();

  // 1) 입력 이미지 fetch → Blob
  const imgRes = await fetchWithRetryAndTimeout(inputImageUrl, { method: "GET" }, OPENAI_IMAGE_TIMEOUT_MS);
  if (!imgRes.ok) throw new Error(`입력 이미지 fetch 실패: ${imgRes.status}`);
  const imgBlob = await imgRes.blob();

  // 2) multipart/form-data 구성 (Edge OK)
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", "1024x1024");
  form.append("image", imgBlob, "input.png");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (project && project.startsWith("proj_")) headers["OpenAI-Project"] = project;

  const res = await fetchWithRetryAndTimeout(`${baseUrl}/v1/images/edits`, {
    method: "POST",
    headers,
    body: form,
  }, OPENAI_IMAGE_TIMEOUT_MS);

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI 이미지 편집 실패: ${res.status} ${t}`);
  }

  const data = (await res.json()) as OpenAIImagesResponse;
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI 이미지 결과(b64)가 비었습니다.");
  return `data:image/png;base64,${b64}`;
}

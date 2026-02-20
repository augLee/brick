import { NextResponse } from "next/server";
import visionPromptJson from "@/docs/prompts/vision.json";

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

async function fetchInputImagePayload(inputImageUrl: string): Promise<ImagePayload> {
  const cleanUrl = inputImageUrl.trim();
  const imageRes = await fetch(cleanUrl, {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0 BrickifyAI/1.0" },
  });

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

  const res = await fetch(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      prompt,
      size: "1024x1024",
    }),
  });

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

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: visionPrompt.system },
        {
          role: "user",
          content: [
            { type: "text", text: visionPrompt.user },
            { type: "image_url", image_url: { url: inputImageUrl } },
          ],
        },
      ],
    }),
  });

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

// --- 메인 API 핸들러 ---
export async function POST(req: Request) {
  try {
    const bodyUnknown = (await req.json().catch(() => ({}))) as unknown;
    const body = bodyUnknown as GenerateRenderRequestBody;

    const inputImageUrl = body.inputImageUrl;
    if (typeof inputImageUrl !== "string" || !inputImageUrl.trim()) {
      return NextResponse.json({ error: "URL이 없습니다." }, { status: 400 });
    }

    // ✅ 분석은 OpenAI만 사용
    let analysis: VisionAnalysis = fallbackAnalysis;
    try {
      analysis = await analyzeWithOpenAI(inputImageUrl);
    } catch (err: unknown) {
      console.error("OpenAI Error:", err);
      analysis = fallbackAnalysis;
    }

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
      Create a clean studio product photo of a fully 3D LEGO model (like an official LEGO set).
      White/off-white background (#FAF9F6), centered, sharp, realistic LEGO plastic.
      Must be a freestanding full 3D object with visible side faces and depth.
      NOT a flat mosaic, NOT a relief, NOT wall-mounted art, NOT a baseplate portrait.
      No text, no logos, no watermark.
      No nudity, no violence, no weapons, no hate symbols, no political content.
      If the input depicts a person, keep the silhouette, hairstyle, and outfit recognizable, but render as a LEGO-style toy figure (no real-person photo likeness).
      `.trim();


    const imagePrompt = `${SAFE_PREFIX}\n\n${finalPrompt}`;

    let previewImageUrl = buildFallbackPreview(analysis.subject_type);

    // ✅ Gemini는 이미지 생성만 (키 있을 때만)
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
    const enableGemini = process.env.ENABLE_GEMINI === "true";

    const geminiImageModel =
      process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";

    // 1) Gemini로 이미지 생성 시도
    let geminiSucceeded = false;

    if (enableGemini && geminiApiKey) {
      try {
        const imagePayload = await fetchInputImagePayload(inputImageUrl);

        const geminiRes = await fetch(
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
          }
        );

        if (geminiRes.ok) {
          const geminiData = (await geminiRes.json()) as GeminiResponse;
          const b64Image =
            geminiData.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
              ?.inlineData?.data;

          if (b64Image) {
            previewImageUrl = `data:image/png;base64,${b64Image}`;
            geminiSucceeded = true;
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
        }
      } catch (err: unknown) {
        console.warn("Gemini image generation error:", err, "model:", geminiImageModel);
      }
    }

    // 2) Gemini 실패 시 OpenAI 이미지 생성 fallback
    if (!geminiSucceeded) {
      try {
        //previewImageUrl = await generateImageWithOpenAI(imagePrompt); // ✅ safe prompt 사용
        previewImageUrl = await generateImageWithOpenAI2(inputImageUrl, imagePrompt); // ✅ safe prompt 사용
      } catch (err: unknown) {
        console.warn("OpenAI image fallback failed:", err);
      }
    }

    const jobId = crypto.randomUUID();

    return NextResponse.json({
      jobId,
      previewImageUrl,
      palette8: palette,
      dominant_color: analysis.dominant_color,
      storyText: `${analysis.subject_type} 변환 완료`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "서버 에러";
    console.error("API Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generateImageWithOpenAI2(inputImageUrl: string, prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");

  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com";
  const project = process.env.OPENAI_PROJECT_ID?.trim();

  // 1) 입력 이미지 fetch → Blob
  const imgRes = await fetch(inputImageUrl);
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

  const res = await fetch(`${baseUrl}/v1/images/edits`, {
    method: "POST",
    headers,
    body: form,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI 이미지 편집 실패: ${res.status} ${t}`);
  }

  const data = (await res.json()) as OpenAIImagesResponse;
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI 이미지 결과(b64)가 비었습니다.");
  return `data:image/png;base64,${b64}`;
}

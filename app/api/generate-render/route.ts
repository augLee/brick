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
};

type GeminiPart = {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
};

type ImagePayload = { mimeType: string; data: string };

type VisionProvider = "openai" | "gemini";

type VisionPrompt = { system: string; user: string };

// OpenAI 응답 최소 타입(필요한 부분만)
type OpenAIChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

// --- 프롬프트 로딩 (any 금지: unknown -> 타입 캐스팅) ---
const visionPrompt = visionPromptJson as unknown as VisionPrompt;

// --- 프롬프트 헬퍼 ---
const baseRenderPrompt = () =>
  "Transform the reference image into a LEGO-like brickified artwork. Keep the original composition, subject identity, and large color regions recognizable.";

const subjectAddon = (type: string) => {
  const addons: Record<string, string> = {
    person:
      "For people, keep face/hair/clothing silhouette recognizable but simplify details into blocky bricks.",
    architecture:
      "For buildings, keep major facade lines and skyline, simplified into stepped brick geometry.",
    vehicle:
      "For cars/vehicles, keep wheelbase and iconic body silhouette, simplified with chunky brick blocks.",
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
  negative_prompt: "blurry, text, watermark, logo",
};

// --- 유틸 ---
function normalizeVisionProvider(value?: string): VisionProvider {
  return value?.toLowerCase() === "gemini" ? "gemini" : "openai";
}

function coerceAnalysis(raw: Partial<VisionAnalysis>): VisionAnalysis {
  return {
    ...fallbackAnalysis,
    ...raw,
    key_features: Array.isArray(raw.key_features)
      ? raw.key_features
      : fallbackAnalysis.key_features,
  };
}

/**
 * ✅ Cloudflare Edge에서 안전한 base64 인코딩
 * - Pages에서 nodejs_compat 켜져 있으면 Buffer 사용이 가장 안정적
 */
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

  // nodejs_compat 필요
  const base64Data = Buffer.from(arrayBuffer).toString("base64");
  return { mimeType, data: base64Data };
}

/**
 * ✅ OpenAI: SDK 대신 fetch 직접 호출 (Edge/Worker에서 안정적)
 */
async function analyzeWithOpenAI(inputImageUrl: string): Promise<VisionAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
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
    throw new Error(`OpenAI 분석 실패: ${res.status} ${t}`);
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

async function analyzeWithGemini(
  imagePayload: ImagePayload,
  geminiApiKey: string
): Promise<VisionAnalysis> {
  const promptText = `${visionPrompt.system}\n\n${visionPrompt.user}`;

  const geminiVisionRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: promptText },
              { inlineData: { mimeType: imagePayload.mimeType, data: imagePayload.data } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  if (!geminiVisionRes.ok) {
    const t = await geminiVisionRes.text().catch(() => "");
    throw new Error(`Gemini 분석 실패: ${geminiVisionRes.status} ${t}`);
  }

  const geminiVisionData = (await geminiVisionRes.json()) as GeminiResponse;
  const text =
    geminiVisionData.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text ?? "{}";

  let parsed: Partial<VisionAnalysis> = {};
  try {
    parsed = JSON.parse(text) as Partial<VisionAnalysis>;
  } catch {
    parsed = {};
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

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const visionProvider = normalizeVisionProvider(process.env.VISION_PROVIDER);

    let imagePayload: ImagePayload | null = null;
    let analysis: VisionAnalysis = fallbackAnalysis;

    // Gemini 쓸 수 있으면 미리 이미지 payload 준비
    if (geminiApiKey) {
      try {
        imagePayload = await fetchInputImagePayload(inputImageUrl);
      } catch (err: unknown) {
        return NextResponse.json(
          { message: "이미지 로드 실패", detail: String(err) },
          { status: 400 }
        );
      }
    }

    // 분석 실행
    if (visionProvider === "openai") {
      try {
        analysis = await analyzeWithOpenAI(inputImageUrl);
      } catch (err: unknown) {
        console.error("OpenAI Error:", err);
        return NextResponse.json({ message: "OpenAI 분석 실패" }, { status: 500 });
      }
    } else {
      if (!geminiApiKey) {
        return NextResponse.json({ message: "Gemini 키 없음" }, { status: 500 });
      }
      try {
        if (!imagePayload) throw new Error("이미지 없음");
        analysis = await analyzeWithGemini(imagePayload, geminiApiKey);
      } catch (err: unknown) {
        console.error("Gemini Vision Error:", err);
        return NextResponse.json({ message: "Gemini 분석 실패" }, { status: 500 });
      }
    }

    // 프롬프트 구성
    const finalPrompt = [
      baseRenderPrompt(),
      subjectAddon(analysis.subject_type),
      `Key features: ${analysis.key_features.join(", ")}.`,
      "Style: simplified blocky LEGO geometry.",
      `Camera: ${analysis.camera_hint}.`,
      `Negative prompt: ${analysis.negative_prompt}.`,
    ].join(" ");

    let previewImageUrl = buildFallbackPreview(analysis.subject_type);

    // Gemini 이미지 생성(가능할 때만)
    if (geminiApiKey && imagePayload) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: finalPrompt },
                  { inlineData: { mimeType: imagePayload.mimeType, data: imagePayload.data } },
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
          geminiData.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData
            ?.data;

        if (b64Image) previewImageUrl = `data:image/png;base64,${b64Image}`;
      } else {
        const t = await geminiRes.text().catch(() => "");
        console.warn("Gemini image generation failed:", geminiRes.status, t);
      }
    }

    // Edge 환경: 전역 crypto 사용
    const jobId = crypto.randomUUID();

    return NextResponse.json({
      jobId,
      previewImageUrl,
      partsSummary: "MVP 추정: 약 900~1,300개 브릭",
      storyText: `${analysis.subject_type} 변환 완료`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "서버 에러";
    console.error("API Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

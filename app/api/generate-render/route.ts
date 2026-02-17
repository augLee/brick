import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import visionPrompt from "@/docs/prompts/vision.json";
import { getOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEMINI_VISION_MODEL = "gemini-2.0-flash";
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const IMAGEN_MODEL = process.env.IMAGEN_MODEL || "imagen-3.0-generate-002";

type VisionAnalysis = {
  subject_type: "person" | "architecture" | "vehicle" | "animal" | "object" | "scene" | "other";
  confidence: number;
  key_features: string[];
  camera_hint: string;
  depth_hint?: string;
  negative_prompt: string;
};

type VisionProvider = "openai" | "gemini";

type OpenAIErrorLike = {
  status?: number;
  response?: {
    status?: number;
    data?: unknown;
  };
};

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: unknown;
};

type ImagePayload = { data: string; mimeType: string };

const fallbackAnalysis: VisionAnalysis = {
  subject_type: "object",
  confidence: 0.4,
  key_features: ["subject silhouette"],
  camera_hint: "three-quarter angle",
  depth_hint: "center has most depth",
  negative_prompt: "blurry, text, watermark, logo",
};

function normalizeVisionProvider(value?: string): VisionProvider {
  return value?.toLowerCase() === "gemini" ? "gemini" : "openai";
}

function coerceAnalysis(raw: Partial<VisionAnalysis>): VisionAnalysis {
  return {
    ...fallbackAnalysis,
    ...raw,
    key_features: Array.isArray(raw.key_features) ? raw.key_features : fallbackAnalysis.key_features,
  };
}

function buildFallbackPreview(text = "PREVIEW") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" fill="#FAF9F6"/>
    <rect x="256" y="256" width="512" height="512" rx="40" fill="#f4f4f5" stroke="#e4e4e7" stroke-width="10"/>
    <text x="512" y="512" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="48" fill="#71717A">${text}</text>
    <text x="512" y="580" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#A1A1AA">(Gemini Generation Failed)</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function fetchImageAsBase64(url: string): Promise<ImagePayload> {
  const res = await fetch(url.trim());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch image: status=${res.status}, body=${body}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/png";
  return { data: base64, mimeType };
}

function getImageBase64FromGeminiResponse(payload: GeminiGenerateContentResponse): string | null {
  const parts = payload.candidates?.[0]?.content?.parts;
  if (!parts) return null;

  for (const part of parts) {
    const fromInlineData = part.inlineData?.data;
    if (fromInlineData) return fromInlineData;
    const fromInlineDataSnake = part.inline_data?.data;
    if (fromInlineDataSnake) return fromInlineDataSnake;
  }
  return null;
}

async function analyzeWithOpenAI(inputImageUrl: string): Promise<VisionAnalysis> {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const visionRes = await openai.chat.completions.create({
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
  });

  const parsed = JSON.parse(visionRes.choices[0]?.message?.content ?? "{}") as Partial<VisionAnalysis>;
  return coerceAnalysis(parsed);
}

async function analyzeWithGemini(image: ImagePayload, apiKey: string): Promise<VisionAnalysis> {
  const promptText = `${visionPrompt.system}\n\n${visionPrompt.user}`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: promptText },
              { inlineData: { data: image.data, mimeType: image.mimeType } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );

  const payload = (await res.json()) as GeminiGenerateContentResponse;
  if (!res.ok) {
    throw {
      status: res.status,
      response: { status: res.status, data: payload },
    } satisfies OpenAIErrorLike;
  }

  const text = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text ?? "{}";
  const parsed = JSON.parse(text) as Partial<VisionAnalysis>;
  return coerceAnalysis(parsed);
}

async function generateWithGeminiImageModel(image: ImagePayload, prompt: string, apiKey: string): Promise<string | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { data: image.data, mimeType: image.mimeType } },
            ],
          },
        ],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    },
  );

  const payload = (await res.json()) as GeminiGenerateContentResponse;
  if (!res.ok) {
    console.error("Gemini image generation error:", payload);
    return null;
  }

  return getImageBase64FromGeminiResponse(payload);
}

async function generateWithImagen(prompt: string, apiKey: string): Promise<string | null> {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGEN_MODEL,
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  const payload = (await res.json()) as { data?: Array<{ b64_json?: string }>; error?: unknown };
  if (!res.ok) {
    console.error("Imagen API error:", payload);
    return null;
  }
  return payload.data?.[0]?.b64_json ?? null;
}

function buildRenderPrompt(analysis: VisionAnalysis) {
  const keyFeatures = analysis.key_features.join(", ");
  return [
    "Create a brickified image that clearly resembles the uploaded reference photo.",
    "The result should look like LEGO/Minecraft-style block art with visible studs and plastic bricks.",
    "Keep major composition, silhouette, and color regions similar to the source image.",
    "Simplify details but preserve recognizability for person/vehicle/building/background.",
    "Off-white studio-like background (#FAF9F6), clean product render feel.",
    "No text, no logo, no watermark, no extra hands.",
    `Subject type: ${analysis.subject_type}.`,
    `Key features to preserve: ${keyFeatures || "main silhouette and dominant colors"}.`,
    `Camera hint: ${analysis.camera_hint || "three-quarter"}.`,
    `Negative prompt: ${analysis.negative_prompt || "blurry, low quality, text, logo, watermark"}.`,
  ].join(" ");
}

function runMockMode(message?: string) {
  return NextResponse.json({
    jobId: randomUUID(),
    previewImageUrl: buildFallbackPreview("MOCK PREVIEW"),
    partsSummary: "Mock Data: 850 bricks",
    storyText: message || "현재 데모 모드로 실행 중입니다. (API 키 확인 필요)",
  });
}

export async function POST(req: Request) {
  try {
    const { inputImageUrl } = (await req.json()) as { inputImageUrl?: string };
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!inputImageUrl || typeof inputImageUrl !== "string") {
      return NextResponse.json({ error: "No URL" }, { status: 400 });
    }

    if (!geminiApiKey) {
      console.warn("GEMINI_API_KEY is missing. Using Mock Mode.");
      return runMockMode();
    }

    const imagePayload = await fetchImageAsBase64(inputImageUrl);
    const visionProvider = normalizeVisionProvider(process.env.VISION_PROVIDER);
    let analysis = fallbackAnalysis;

    if (visionProvider === "openai") {
      try {
        analysis = await analyzeWithOpenAI(inputImageUrl);
      } catch (err: unknown) {
        const openAIError = err as OpenAIErrorLike;
        const status = openAIError.status ?? openAIError.response?.status;
        const data = openAIError.response?.data ?? err;
        console.error("OpenAI error:", data);

        if (status === 429) {
          return NextResponse.json(
            {
              message: "OpenAI 호출 한도를 초과했어요. (결제/예산 또는 요청 빈도 확인 필요)",
              detail: data,
            },
            { status: 429 },
          );
        }

        return NextResponse.json({ message: "OpenAI vision 분석 실패", detail: data }, { status: 500 });
      }
    } else {
      try {
        analysis = await analyzeWithGemini(imagePayload, geminiApiKey);
      } catch (err: unknown) {
        const geminiError = err as OpenAIErrorLike;
        const status = geminiError.status ?? geminiError.response?.status ?? 500;
        const data = geminiError.response?.data ?? err;
        console.error("Gemini vision error:", data);
        return NextResponse.json({ message: "Gemini vision 분석 실패", detail: data }, { status });
      }
    }

    const renderPrompt = buildRenderPrompt(analysis);

    let previewImageUrl: string | null = null;
    let generationPath: "gemini-image" | "imagen" | "fallback" = "fallback";

    const geminiImageB64 = await generateWithGeminiImageModel(imagePayload, renderPrompt, geminiApiKey);
    if (geminiImageB64) {
      previewImageUrl = `data:image/png;base64,${geminiImageB64}`;
      generationPath = "gemini-image";
    }

    if (!previewImageUrl) {
      const imagenB64 = await generateWithImagen(renderPrompt, geminiApiKey);
      if (imagenB64) {
        previewImageUrl = `data:image/png;base64,${imagenB64}`;
        generationPath = "imagen";
      }
    }

    if (!previewImageUrl) {
      previewImageUrl = buildFallbackPreview("IMAGE GEN FAILED");
      generationPath = "fallback";
    }

    return NextResponse.json({
      jobId: randomUUID(),
      previewImageUrl,
      partsSummary: "Estimated: ~1,200 bricks (AI analysis)",
      storyText: `AI가 "${analysis.subject_type}" 특성을 분석해 브릭 스타일 결과물을 생성했습니다.`,
      debug: {
        visionProvider,
        generationPath,
        imageModel: GEMINI_IMAGE_MODEL,
        imagenModel: IMAGEN_MODEL,
      },
    });
  } catch (error: unknown) {
    console.error("Server Error:", error);
    return runMockMode("서버 오류로 인해 데모 모드로 실행됩니다.");
  }
}

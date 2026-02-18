// api/generate-render/route.ts
import { NextResponse } from "next/server";
import visionPrompt from "@/docs/prompts/vision.json";
import { getOpenAIClient } from "@/lib/openai";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type VisionAnalysis = {
  subject_type: "person" | "architecture" | "vehicle" | "animal" | "object" | "scene" | "other";
  confidence: number;
  key_features: string[];
  camera_hint: string;
  depth_hint?: string;
  negative_prompt: string;
};

type GeminiPart = { text?: string; inlineData?: { data?: string } };
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
};
type ImagePayload = { mimeType: string; data: string };

type OpenAIErrorLike = {
  status?: number;
  response?: {
    status?: number;
    data?: unknown;
  };
};

type VisionProvider = "openai" | "gemini";

const baseRenderPrompt = () =>
  "Transform the reference image into a LEGO-like brickified artwork. Keep the original composition, subject identity, and large color regions recognizable.";

const subjectAddon = (type: string) => {
  const addons: Record<string, string> = {
    person: "For people, keep face/hair/clothing silhouette recognizable but simplify details into blocky bricks.",
    architecture: "For buildings, keep major facade lines and skyline, simplified into stepped brick geometry.",
    vehicle: "For cars/vehicles, keep wheelbase and iconic body silhouette, simplified with chunky brick blocks.",
    animal: "For animals, preserve silhouette and key markings while using blocky brick forms.",
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

async function fetchInputImagePayload(inputImageUrl: string): Promise<ImagePayload> {
  const cleanUrl = inputImageUrl.trim();
  const imageRes = await fetch(cleanUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Node.js) BrickifyAI/1.0",
    },
  });

  if (!imageRes.ok) {
    const errorText = await imageRes.text();
    throw new Error(`입력 이미지를 불러오지 못했습니다. status=${imageRes.status} / message=${errorText}`);
  }

  const mimeType = imageRes.headers.get("content-type")?.split(";")[0] || "image/png";
  const data = Buffer.from(await imageRes.arrayBuffer()).toString("base64");
  return { mimeType, data };
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

async function analyzeWithGemini(imagePayload: ImagePayload, geminiApiKey: string): Promise<VisionAnalysis> {
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
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const geminiVisionData = (await geminiVisionRes.json()) as GeminiResponse;
  const text = geminiVisionData.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text ?? "{}";
  return coerceAnalysis(JSON.parse(text));
}

function buildFallbackPreview(subjectType: string) {
  const label = `${subjectType.toUpperCase()} BRICK PREVIEW`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" fill="#FAF9F6"/>
    <rect x="240" y="530" width="190" height="170" rx="24" fill="#27272A"/>
    <rect x="448" y="530" width="190" height="170" rx="24" fill="#3F3F46"/>
    <rect x="656" y="530" width="130" height="170" rx="24" fill="#52525B"/>
    <rect x="372" y="340" width="290" height="160" rx="24" fill="#C2410C"/>
    <circle cx="435" cy="340" r="26" fill="#C2410C"/>
    <circle cx="522" cy="340" r="26" fill="#C2410C"/>
    <circle cx="610" cy="340" r="26" fill="#C2410C"/>
    <text x="512" y="790" text-anchor="middle" font-size="44" font-family="sans-serif" fill="#71717A">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function POST(req: Request) {
  try {
    const { inputImageUrl } = await req.json();
    if (!inputImageUrl || typeof inputImageUrl !== "string") {
      return NextResponse.json({ error: "URL이 없습니다." }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const visionProvider = normalizeVisionProvider(process.env.VISION_PROVIDER);
    let imagePayload: ImagePayload | null = null;
    let analysis: VisionAnalysis = fallbackAnalysis;

    if (geminiApiKey) {
      try {
        imagePayload = await fetchInputImagePayload(inputImageUrl);
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : err;
        return NextResponse.json(
          {
            message: "입력 이미지를 읽을 수 없어 브릭 렌더를 생성할 수 없습니다.",
            detail,
          },
          { status: 400 },
        );
      }
    }

    if (visionProvider === "openai") {
      try {
        analysis = await analyzeWithOpenAI(inputImageUrl);
      } catch (err: unknown) {
        const openAIError = err as OpenAIErrorLike;
        const status = openAIError.status ?? openAIError.response?.status;
        const data = openAIError.response?.data ?? err;
        const detail =
          typeof data === "object" && data !== null && "error" in data
            ? (data as { error?: unknown }).error ?? data
            : data;

        console.error("OpenAI error:", data);

        if (status === 429) {
          return NextResponse.json(
            {
              message: "OpenAI 호출 한도를 초과했어요. (결제/예산 또는 요청 빈도 확인 필요)",
              detail,
            },
            { status: 429 },
          );
        }

        return NextResponse.json(
          {
            message: "OpenAI vision 분석 실패",
            detail,
          },
          { status: 500 },
        );
      }
    } else {
      if (!geminiApiKey) {
        return NextResponse.json(
          { message: "GEMINI_API_KEY가 없어 Gemini vision 분석을 실행할 수 없습니다." },
          { status: 500 },
        );
      }

      try {
        if (!imagePayload) {
          return NextResponse.json({ message: "Gemini vision 분석을 위한 입력 이미지가 없습니다." }, { status: 500 });
        }
        analysis = await analyzeWithGemini(imagePayload, geminiApiKey);
      } catch (err: unknown) {
        const geminiError = err as OpenAIErrorLike;
        const status = geminiError.status ?? geminiError.response?.status ?? 500;
        const data = geminiError.response?.data ?? err;
        console.error("Gemini vision error:", data);
        return NextResponse.json(
          {
            message: "Gemini vision 분석 실패",
            detail: data,
          },
          { status },
        );
      }
    }

    const finalPrompt = [
      baseRenderPrompt(),
      subjectAddon(analysis.subject_type),
      `Key features to preserve: ${analysis.key_features.join(", ") || "main silhouette and major colors"}.`,
      "Style target: simplified blocky LEGO/Minecraft-like geometry with visible studs and brick seams.",
      "Include foreground subject and background shapes as brick blocks, not flat cartoon.",
      "Result should feel clearly similar to the uploaded image while reduced to clean brick forms.",
      "No text, no logos, no watermark.",
      `Camera: ${analysis.camera_hint || "three-quarter"}.`,
      `Negative prompt: ${analysis.negative_prompt || "text, logo, watermark, blur"}.`,
    ].join(" ");

    let previewImageUrl = buildFallbackPreview(analysis.subject_type);

    if (geminiApiKey) {
      if (!imagePayload) {
        return NextResponse.json({ message: "이미지 생성용 입력 이미지가 없습니다." }, { status: 500 });
      }
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
        },
      );

      if (geminiRes.ok) {
        const geminiData = (await geminiRes.json()) as GeminiResponse;
        const b64Image = geminiData.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
        if (b64Image) {
          previewImageUrl = `data:image/png;base64,${b64Image}`;
        }
      }
    }

    return NextResponse.json({
      jobId: crypto.randomUUID(),
      previewImageUrl,
      partsSummary: "MVP 추정: 약 900~1,300개 브릭",
      storyText: `${analysis.subject_type}을(를) 바탕으로 브릭 작품 설계를 시작했습니다.`,
      debug: {
        analysis,
        visionProvider,
        hasOpenAI: Boolean(getOpenAIClient()),
        hasGemini: Boolean(geminiApiKey),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "렌더 생성 중 오류가 발생했습니다.";
    console.error("generate-render error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

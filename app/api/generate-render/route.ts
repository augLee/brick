// api/generate-render/route.ts
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { NextResponse } from 'next/server';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- 프롬프트 헬퍼 함수들 (기존 로직 복구) ---
const baseRenderPrompt = () => `High-quality 3D studio product render of a LEGO-like brick-built model. Clean off-white background (#FAF9F6). Soft studio lighting, realistic plastic material, visible studs, premium product photography look. No text, no logos.`;

const subjectAddon = (type: string) => {
  const addons: Record<string, string> = {
    person: "Convert into a brick-built bust statue. Preserve hairstyle and clothing colors.",
    architecture: "Convert into a brick-built architecture set. Preserve facade shapes.",
    vehicle: "Convert into a brick-built vehicle. Preserve wheelbase and iconic curves.",
    animal: "Convert into a brick-built creature. Preserve silhouette with brick geometry.",
  };
  return addons[type] || "Convert the subject into a detailed brick-built model.";
};

// --- 핵심 API 로직 ---
export async function POST(req: Request) {
  try {
    const { inputImageUrl } = await req.json();
    if (!inputImageUrl) return NextResponse.json({ error: "URL이 없습니다." }, { status: 400 });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1. OpenAI Vision 분석 (gpt-4o-mini)
    console.log("🔍 분석 시작...");
    const visionRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Analyze the image and return JSON: {subject_type, key_features: [], camera_hint}." },
        { role: "user", content: [{ type: "text", text: "Analyze this image for brick conversion." }, { type: "image_url", image_url: { url: inputImageUrl } }] }
      ]
    });

    const analysis = JSON.parse(visionRes.choices[0].message.content || "{}");
    const finalPrompt = `${baseRenderPrompt()} ${subjectAddon(analysis.subject_type)} Camera: ${analysis.camera_hint || 'three-quarter'}.`;

    // 2. Gemini 이미지 생성 (fetch 사용)
    console.log("🎨 Gemini 렌더링 시작...");
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
        })
      }
    );

    const geminiData = await geminiRes.json();
    const b64Image = geminiData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;

    if (!b64Image) throw new Error("Gemini가 이미지를 생성하지 못했습니다.");

    // 3. 최종 결과 반환
    return NextResponse.json({
      jobId: randomUUID(),
      previewImageUrl: `data:image/png;base64,${b64Image}`,
      partsSummary: "약 1,200개의 브릭 부품이 필요합니다.",
      storyText: `${analysis.subject_type}을(를) 모티브로 한 나만의 브릭 아트가 완성되었습니다!`
    });

  } catch (error: any) {
    console.error("🔥 Engine Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
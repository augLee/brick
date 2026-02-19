"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Upload, Sparkles, Loader2, ArrowRight, CheckCircle2, Info, ImageUp } from "lucide-react";
import { clearAdminLogs, pushAdminLog } from "@/lib/admin-logs";
import { isAdminModeEnabled, isLayerVisibleEnabled } from "@/lib/admin-mode";

type RenderResult = {
  jobId: string;
  previewImageUrl: string;
  partsSummary: string;
  storyText: string;
  debug?: {
    visionProvider?: string;
    generationPath?: string;
    imageModel?: string;
    imagenModel?: string;
  };
};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function CreatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RenderResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const validateImageFile = (nextFile: File) => {
    if (nextFile.size > MAX_FILE_SIZE) {
      return "파일 크기는 10MB 이하만 가능합니다.";
    }

    if (nextFile.type) {
      if (!ALLOWED_IMAGE_TYPES.includes(nextFile.type)) {
        return "이미지 파일(JPG, PNG, WebP)만 업로드할 수 있습니다.";
      }
      return null;
    }

    const lowerName = nextFile.name.toLowerCase();
    const hasAllowedExt = ALLOWED_IMAGE_EXT.some((ext) => lowerName.endsWith(ext));
    if (!hasAllowedExt) {
      return "이미지 파일(JPG, PNG, WebP)만 업로드할 수 있습니다.";
    }
    return null;
  };

  const selectFile = (nextFile: File) => {
    const validationError = validateImageFile(nextFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setError(null);
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    selectFile(selectedFile);
  };

  const generateBrickArt = async () => {
    if (!file) return;
    try {
      if (isAdminModeEnabled) {
        clearAdminLogs();
        pushAdminLog("create", "새 생성 플로우 시작", { fileName: file.name });
      }

      setError(null);
      setIsUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = (await uploadRes.json()) as { url?: string; error?: string };
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || "업로드에 실패했습니다.");
      }
      if (isAdminModeEnabled) {
        pushAdminLog("upload", "이미지 업로드 성공", { url: uploadData.url });
      }

      setIsUploading(false);
      setIsGenerating(true);

      const renderRes = await fetch("/api/generate-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputImageUrl: uploadData.url }),
      });
      const renderData = (await renderRes.json()) as Partial<RenderResult> & { error?: string; message?: string };
      if (!renderRes.ok || !renderData.previewImageUrl || !renderData.jobId) {
        throw new Error(renderData.message || renderData.error || "렌더 생성에 실패했습니다.");
      }
      if (isAdminModeEnabled) {
        pushAdminLog("generate-render", "렌더 생성 성공", {
          jobId: renderData.jobId,
          debug: renderData.debug,
        });
      }

      setResult({
        jobId: renderData.jobId,
        previewImageUrl: renderData.previewImageUrl,
        partsSummary: renderData.partsSummary || "부품 수량 분석 결과가 준비되었습니다.",
        storyText: renderData.storyText || "브릭 디자인이 생성되었습니다.",
        debug: renderData.debug,
      });
    } catch (err: unknown) {
      if (isAdminModeEnabled) {
        pushAdminLog("create", "생성 플로우 실패", { error: err instanceof Error ? err.message : String(err) });
      }
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
      setIsGenerating(false);
    }
  };

  return (
    <div className="text-zinc-900">
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-6">
        <div className="grid gap-12 md:grid-cols-2">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">사진 업로드</h1>
              <p className="mt-2 text-sm font-medium text-zinc-500">인물, 사물, 건축물 어떤 사진이든 업로드해보세요.</p>
            </div>
            {isAdminModeEnabled && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
                환경설정: 관리자 모드 <span className="text-emerald-600">ON</span>
                {" / "}Layer <span className={isLayerVisibleEnabled ? "text-emerald-600" : "text-zinc-500"}>{isLayerVisibleEnabled ? "ON" : "OFF"}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) selectFile(dropped);
              }}
              className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[2.4rem] border-2 border-dashed transition
                ${dragActive ? "border-[#C2410C] bg-orange-50" : "border-zinc-200 bg-zinc-50"}
                ${previewUrl ? "border-[#C2410C] bg-white" : ""}`}
            >
              {previewUrl ? (
                <>
                  <Image src={previewUrl} alt="업로드 미리보기" fill className="object-contain p-3" />
                  <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">
                    클릭해서 다른 사진으로 교체
                  </div>
                  <div className="pointer-events-none absolute bottom-4 left-0 w-full px-4 text-center text-xs font-semibold text-zinc-500 whitespace-nowrap">
                    현재 이미지를 누르면 그 위에 다른 사진을 다시 올릴 수 있어요.
                  </div>
                </>
                
              ) : (
                <div className="space-y-4 text-center">
                  <div className="mx-auto inline-flex rounded-2xl bg-white p-4 shadow-sm">
                    <ImageUp size={28} className="text-[#C2410C]" />
                  </div>
                  <p className="text-sm font-bold text-zinc-500">클릭 또는 드래그앤드롭</p>
                  <p className="text-xs font-medium text-zinc-400">JPG, PNG, WEBP / 최대 10MB</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </button>            

            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}

            <button
              type="button"
              onClick={generateBrickArt}
              disabled={!file || isUploading || isGenerating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C2410C] px-4 py-4 text-base font-bold text-white transition hover:bg-[#B8430A] disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {isUploading ? "업로드 중..." : isGenerating ? "AI 분석/생성 중..." : "브릭 작품 생성하기"}
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-black tracking-tight md:text-4xl">AI 결과물</h2>
              <p className="mt-2 text-sm font-medium text-zinc-500">생성된 오프화이트 배경의 제품형 렌더를 확인하세요.</p>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-[2.4rem] border border-zinc-200 bg-zinc-100">
              {result ? (
                <Image src={result.previewImageUrl} alt="브릭 렌더 결과" fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center p-10 text-center text-sm font-semibold text-zinc-400">
                  아직 생성된 결과가 없습니다.
                </div>
              )}
            </div>

            {result && (
              <div className="space-y-4 rounded-[1.5rem] border border-orange-100 bg-orange-50 p-6">
                <div className="flex items-center gap-2 text-[#C2410C]">
                  <CheckCircle2 size={18} />
                  <p className="text-sm font-black">생성 완료</p>
                </div>
                <p className="text-sm font-semibold leading-relaxed text-[#B8430A]">{result.storyText}</p>
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                  <Info size={14} />
                  {result.partsSummary}
                </div>
                <Link
                  href={`/checkout?jobId=${encodeURIComponent(result.jobId)}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#C2410C] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#B8430A]"
                >
                  다음 단계로 이동
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}

            {!result && !isUploading && !isGenerating && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-xs font-semibold text-zinc-500">
                <Sparkles size={14} />
                업로드 후 생성 버튼을 누르면 결과가 여기에 표시됩니다.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

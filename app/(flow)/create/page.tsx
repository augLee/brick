"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Upload, Sparkles, Loader2, ArrowRight, CheckCircle2, Info, ImageUp } from "lucide-react";
import { clearAdminLogs, pushAdminLog } from "@/lib/admin-logs";
import { isAdminModeEnabled, isLayerVisibleEnabled } from "@/lib/admin-mode";
import { useLanguage, type SiteLanguage } from "@/components/LanguageProvider";
import type { BomItem } from "@/lib/bom-client";
import { computeBomFromPreview } from "@/lib/bom-client";

type RenderResult = {
  jobId: string;
  previewImageUrl: string;
  partsSummary: string;
  storyText: string;

  palette8?: string[];
  dominant_color?: string;

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

const copy = {
  ko: {
    fileSizeError: "파일 크기는 10MB 이하만 가능합니다.",
    fileTypeError: "이미지 파일(JPG, PNG, WebP)만 업로드할 수 있습니다.",
    uploadError: "업로드에 실패했습니다.",
    renderError: "렌더 생성에 실패했습니다.",
    partsFallback: "부품 수량 분석 결과가 준비되었습니다.",
    storyFallback: "브릭 디자인이 생성되었습니다.",
    unknownError: "알 수 없는 오류가 발생했습니다.",
    uploadTitle: "사진 업로드",
    uploadDesc: "인물, 사물, 건축물 어떤 사진이든 업로드해보세요.",
    adminLabel: "환경설정: 관리자 모드",
    layerLabel: "Layer",
    clickReplace: "클릭해서 다른 사진으로 교체",
    clickReplaceDesc: "현재 이미지를 누르면 그 위에 다른 사진을 다시 올릴 수 있어요.",
    dropHint: "클릭 또는 드래그앤드롭",
    fileHint: "JPG, PNG, WEBP / 최대 10MB",
    uploading: "업로드 중...",
    generating: "AI 분석/생성 중...",
    generate: "브릭 작품 생성하기",
    resultTitle: "AI 결과물",
    resultDesc: "생성된 오프화이트 배경의 제품형 렌더를 확인하세요.",
    resultAlt: "브릭 렌더 결과",
    noResult: "아직 생성된 결과가 없습니다.",
    completed: "생성 완료",
    nextStep: "다음 단계로 이동",
    resultWait: "업로드 후 생성 버튼을 누르면 결과가 여기에 표시됩니다.",
    previewAlt: "업로드 미리보기",
    adminStartFlow: "새 생성 플로우 시작",
    adminUploadSuccess: "이미지 업로드 성공",
    adminRenderSuccess: "렌더 생성 성공",
    adminFlowFail: "생성 플로우 실패",
  },
  en: {
    fileSizeError: "File size must be 10MB or less.",
    fileTypeError: "Only image files (JPG, PNG, WebP) can be uploaded.",
    uploadError: "Upload failed.",
    renderError: "Render generation failed.",
    partsFallback: "Part quantity analysis is ready.",
    storyFallback: "Your brick design has been generated.",
    unknownError: "An unknown error occurred.",
    uploadTitle: "Upload Photo",
    uploadDesc: "Upload any photo: portrait, object, or architecture.",
    adminLabel: "Settings: Admin mode",
    layerLabel: "Layer",
    clickReplace: "Click to replace with another photo",
    clickReplaceDesc: "Click the current image to upload another one over it.",
    dropHint: "Click or drag and drop",
    fileHint: "JPG, PNG, WEBP / Max 10MB",
    uploading: "Uploading...",
    generating: "Analyzing/Generating with AI...",
    generate: "Generate Brick Artwork",
    resultTitle: "AI Output",
    resultDesc: "Check the generated product-style render with an off-white background.",
    resultAlt: "Brick render result",
    noResult: "No generated result yet.",
    completed: "Generation Complete",
    nextStep: "Go to Next Step",
    resultWait: "After upload, press generate and results will appear here.",
    previewAlt: "Upload preview",
    adminStartFlow: "New generation flow started",
    adminUploadSuccess: "Image upload success",
    adminRenderSuccess: "Render generation success",
    adminFlowFail: "Generation flow failed",
  },
} satisfies Record<SiteLanguage, Record<string, string>>;

type SortMode = "MOST" | "COLOR" | "PART";
const TOP_N = 40;

function BrickMini({ part, color }: { part: string; color: string }) {
  const m = part.match(/_(\d+)x(\d+)$/);
  const w = m ? Number(m[1]) : 1;
  const h = m ? Number(m[2]) : 1;
  const W = Math.min(w, 6);
  const H = Math.min(h, 6);

  return (
    <div
      className="grid gap-[2px] rounded-xl border bg-zinc-50 p-2"
      style={{
        gridTemplateColumns: `repeat(${W}, 10px)`,
        gridTemplateRows: `repeat(${H}, 10px)`,
      }}
      title={m ? `${w}×${h}` : part}
    >
      {Array.from({ length: W * H }).map((_, i) => (
        <span key={i} className="h-[10px] w-[10px] rounded-full border" style={{ background: color }} />
      ))}
    </div>
  );
}

export default function CreatePage() {
  const { language } = useLanguage();
  const t = copy[language];

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RenderResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bom, setBom] = useState<BomItem[] | null>(null);
  const [bomError, setBomError] = useState<string | null>(null);
  const [isBomLoading, setIsBomLoading] = useState(false);

  const [bomMeta, setBomMeta] = useState<{ totalPieces: number; totalStuds: number; uniqueItems: number } | null>(null);
    
  const [sortMode, setSortMode] = useState<SortMode>("MOST");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);
  const paletteOrder = useMemo(() => {
    const list = (result?.palette8 ?? []).map((c) => String(c).toUpperCase());
    const m = new Map<string, number>();
    list.forEach((c, i) => m.set(c, i));
    return m;
  }, [result?.palette8]);
  
  const safeBom = useMemo(() => {
    return (bom ?? [])
      .filter(
        (it) =>
          it &&
          typeof it.part === "string" &&
          typeof it.color === "string" &&
          Number.isFinite(it.count) &&
          it.count > 0
      )
      .map((it) => ({ ...it, color: it.color.toUpperCase() }));
  }, [bom]);
    
  const totalPieces = useMemo(
    () => bomMeta?.totalPieces ?? safeBom.reduce((s, it) => s + it.count, 0),
    [bomMeta?.totalPieces, safeBom]
  );
  
  const filteredBom = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return safeBom;
    return safeBom.filter((it) => {
      const part = it.part.toLowerCase();
      const color = it.color.toLowerCase();
      const shape = (it.part.match(/_(\d+)x(\d+)$/)?.[0] ?? "").toLowerCase(); // "_2x8"
      return part.includes(q) || color.includes(q) || shape.includes(q);
    });
  }, [safeBom, query]);
  
  const sortedBom = useMemo(() => {
    const arr = [...filteredBom];
  
    const colorRank = (c: string) => paletteOrder.get(c) ?? 9999;
    const partRank = (p: string) => {
      const m = p.match(/_(\d+)x(\d+)$/);
      const area = m ? Number(m[1]) * Number(m[2]) : 1;
      return -area; // 큰 파트 먼저
    };
  
    if (sortMode === "MOST") {
      arr.sort((a, b) => b.count - a.count || a.part.localeCompare(b.part) || a.color.localeCompare(b.color));
    } else if (sortMode === "COLOR") {
      arr.sort(
        (a, b) =>
          colorRank(a.color) - colorRank(b.color) ||
          b.count - a.count ||
          partRank(a.part) - partRank(b.part) ||
          a.part.localeCompare(b.part)
      );
    } else {
      arr.sort(
        (a, b) =>
          partRank(a.part) - partRank(b.part) ||
          a.part.localeCompare(b.part) ||
          b.count - a.count ||
          colorRank(a.color) - colorRank(b.color)
      );
    }
  
    return arr;
  }, [filteredBom, sortMode, paletteOrder]);
  
  const visibleBom = useMemo(() => {
    return sortedBom.slice(0, showAll ? sortedBom.length : TOP_N);
  }, [sortedBom, showAll]);
  
  const hasBom = useMemo(() => (bomMeta?.uniqueItems ?? safeBom.length) > 0, [bomMeta?.uniqueItems, safeBom.length]);
  const moreCount = useMemo(() => Math.max(0, sortedBom.length - TOP_N), [sortedBom.length]);

  useEffect(() => {
      let cancelled = false;
    
      async function run() {
        if (!result?.previewImageUrl || !result.palette8 || result.palette8.length !== 8) {
          setBom(null);
          setBomError(null);
          setIsBomLoading(false);
          return;
        }
    
        try {
          setIsBomLoading(true);
          setBomError(null);
    
          // ✅ 64x64로 빠르게
          const computed = await computeBomFromPreview(result.previewImageUrl, result.palette8, 64, 64);
          if (cancelled) return;

          // ✅ computeBomFromPreview는 { bom, totalPieces, totalStuds, uniqueItems } 리턴
          setBom(computed.bom);
          setBomMeta({ totalPieces: computed.totalPieces, totalStuds: computed.totalStuds, uniqueItems: computed.uniqueItems });

          setSortMode("MOST");
          setQuery("");
          setShowAll(false);

          // ✅ 총 브릭 수로 partsSummary 갱신 (reduce 금지)
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  partsSummary:
                    language === "ko"
                      ? `예상 브릭 수량: 총 ${computed.totalPieces.toLocaleString()}개`
                      : `Estimated bricks: ${computed.totalPieces.toLocaleString()} pcs`,
                }
              : prev
          );
        } catch (e) {
          if (cancelled) return;
          setBom(null);
          setBomMeta(null); 
          setBomError(e instanceof Error ? e.message : "BOM error");
        } finally {
          if (!cancelled) setIsBomLoading(false);
        }
      }
    
      run();
      return () => {
        cancelled = true;
      };
    }, [result?.previewImageUrl, result?.palette8, language]);

  const validateImageFile = (nextFile: File) => {
    if (nextFile.size > MAX_FILE_SIZE) {
      return t.fileSizeError;
    }

    if (nextFile.type) {
      if (!ALLOWED_IMAGE_TYPES.includes(nextFile.type)) {
        return t.fileTypeError;
      }
      return null;
    }

    const lowerName = nextFile.name.toLowerCase();
    const hasAllowedExt = ALLOWED_IMAGE_EXT.some((ext) => lowerName.endsWith(ext));
    if (!hasAllowedExt) {
      return t.fileTypeError;
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
    setBom(null);
    setBomMeta(null);
    setBomError(null);
    setSortMode("MOST");
    setQuery("");
    setShowAll(false);
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
        pushAdminLog("create", t.adminStartFlow, { fileName: file.name });
      }

      setError(null);
      setIsUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = (await uploadRes.json()) as { url?: string; error?: string };
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || t.uploadError);
      }
      if (isAdminModeEnabled) {
        pushAdminLog("upload", t.adminUploadSuccess, { url: uploadData.url });
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
        throw new Error(renderData.message || renderData.error || t.renderError);
      }
      if (isAdminModeEnabled) {
        pushAdminLog("generate-render", t.adminRenderSuccess, {
          jobId: renderData.jobId,
          debug: renderData.debug,
        });
      }

      setResult({
        jobId: renderData.jobId,
        previewImageUrl: renderData.previewImageUrl,
        partsSummary: renderData.partsSummary || t.partsFallback,
        storyText: renderData.storyText || t.storyFallback,
        palette8: (renderData as any).palette8,
        dominant_color: (renderData as any).dominant_color,
        debug: renderData.debug,
      });
    } catch (err: unknown) {
      if (isAdminModeEnabled) {
        pushAdminLog("create", t.adminFlowFail, { error: err instanceof Error ? err.message : String(err) });
      }
      setError(err instanceof Error ? err.message : t.unknownError);
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
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">{t.uploadTitle}</h1>
              <p className="mt-2 text-sm font-medium text-zinc-500">{t.uploadDesc}</p>
            </div>
            {isAdminModeEnabled && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
                {t.adminLabel} <span className="text-emerald-600">ON</span>
                {" / "}
                {t.layerLabel}{" "}
                <span className={isLayerVisibleEnabled ? "text-emerald-600" : "text-zinc-500"}>
                  {isLayerVisibleEnabled ? "ON" : "OFF"}
                </span>
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
                  <Image src={previewUrl} alt={t.previewAlt} fill className="object-contain p-3" />
                  <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">
                    {t.clickReplace}
                  </div>
                  <div className="pointer-events-none absolute bottom-4 left-0 w-full whitespace-nowrap px-4 text-center text-xs font-semibold text-zinc-500">
                    {t.clickReplaceDesc}
                  </div>
                </>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="mx-auto inline-flex rounded-2xl bg-white p-4 shadow-sm">
                    <ImageUp size={28} className="text-[#C2410C]" />
                  </div>
                  <p className="text-sm font-bold text-zinc-500">{t.dropHint}</p>
                  <p className="text-xs font-medium text-zinc-400">{t.fileHint}</p>
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
              {isUploading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isGenerating ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Upload size={18} />
              )}
              {isUploading ? t.uploading : isGenerating ? t.generating : t.generate}
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-black tracking-tight md:text-4xl">{t.resultTitle}</h2>
              <p className="mt-2 text-sm font-medium text-zinc-500">{t.resultDesc}</p>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-[2.4rem] border border-zinc-200 bg-zinc-100">
              {result ? (
                <Image src={result.previewImageUrl} alt={t.resultAlt} fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center p-10 text-center text-sm font-semibold text-zinc-400">{t.noResult}</div>
              )}
            </div>

            {result && (
              <div className="space-y-4 rounded-[1.5rem] border border-orange-100 bg-orange-50 p-6">
                <div className="flex items-center gap-2 text-[#C2410C]">
                  <CheckCircle2 size={18} />
                  <p className="text-sm font-black">{t.completed}</p>
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
                  {t.nextStep}
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}
            {result && (
              <div className="space-y-4 rounded-[1.5rem] border border-zinc-200 bg-white p-6">
                {/* 헤더 */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-zinc-900">
                    {language === "ko" ? "필요 브릭(예상)" : "Bricks needed (estimate)"}
                  </h3>
                  {isBomLoading && (
                    <span className="text-xs font-semibold text-zinc-500">
                      {language === "ko" ? "계산 중…" : "Calculating…"}
                    </span>
                  )}
                </div>

                {/* 팔레트 */}
                {result.palette8?.length === 8 && (
                  <div className="flex flex-wrap gap-2">
                    {result.palette8.map((c) => (
                      <div key={c} className="flex items-center gap-2 rounded-full border px-3 py-1">
                        <span className="h-3 w-3 rounded-full" style={{ background: c }} />
                        <span className="text-xs font-mono text-zinc-600">{c}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 에러/빈상태 */}
                {bomError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
                    {bomError}
                  </p>
                )}

                {!hasBom && !bomError && !isBomLoading && (
                  <p className="text-xs font-semibold text-zinc-500">
                    {language === "ko" ? "아직 BOM이 없습니다." : "No BOM yet."}
                  </p>
                )}

                {/* 본문 */}
                {hasBom && (
                  <div className="space-y-4">
                    {/* 합계 + 정렬 + 검색 */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-500">
                          {language === "ko" ? "총 브릭(피스)" : "Total pieces"}:
                        </span>
                        <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-black text-white">
                          {totalPieces.toLocaleString()}
                        </span>

                        <span className="ml-2 text-xs font-semibold text-zinc-500">
                          {language === "ko" ? "항목" : "Items"}:
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-black text-zinc-900">
                          {sortedBom.length}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {/* 정렬 토글 */}
                        <div className="inline-flex w-full items-center rounded-xl border bg-white p-1 sm:w-auto">
                          <button
                            type="button"
                            onClick={() => setSortMode("MOST")}
                            className={[
                              "flex-1 rounded-lg px-3 py-2 text-xs font-black sm:flex-none",
                              sortMode === "MOST" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50",
                            ].join(" ")}
                          >
                            {language === "ko" ? "많은 순" : "Most"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSortMode("COLOR")}
                            className={[
                              "flex-1 rounded-lg px-3 py-2 text-xs font-black sm:flex-none",
                              sortMode === "COLOR" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50",
                            ].join(" ")}
                          >
                            {language === "ko" ? "색상별" : "Color"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSortMode("PART")}
                            className={[
                              "flex-1 rounded-lg px-3 py-2 text-xs font-black sm:flex-none",
                              sortMode === "PART" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50",
                            ].join(" ")}
                          >
                            {language === "ko" ? "파트별" : "Part"}
                          </button>
                        </div>

                        {/* 검색 */}
                        <div className="relative w-full sm:w-[260px]">
                          <input
                            value={query}
                            onChange={(e) => {
                              setQuery(e.target.value);
                              setShowAll(false);
                            }}
                            placeholder={language === "ko" ? "검색: 1x2, plate_2x8, #FFFFFF" : "Search: 1x2, plate_2x8, #FFFFFF"}
                            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
                          />
                          {query && (
                            <button
                              type="button"
                              onClick={() => {
                                setQuery("");
                                setShowAll(false);
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-black text-zinc-600 hover:bg-zinc-100"
                            >
                              {language === "ko" ? "지움" : "Clear"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 4열 그리드 */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {visibleBom.map((it) => (
                        <div key={`${it.part}-${it.color}`} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="h-4 w-4 rounded-full border" style={{ background: it.color }} />
                              <span className="text-[11px] font-mono text-zinc-500">{it.color}</span>
                            </div>
                            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-black text-white">{it.count}</span>
                          </div>

                          <div className="mt-3 flex items-center justify-center">
                            <BrickMini part={it.part} color={it.color} />
                          </div>

                          <div className="mt-3">
                            <div className="text-xs font-black text-zinc-900">{it.part}</div>
                            <div className="text-[11px] font-semibold text-zinc-500">
                              {it.part.match(/_(\d+)x(\d+)$/)?.slice(1, 3).join("×") ?? "—"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 더보기 */}
                    {sortedBom.length > TOP_N && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-zinc-500">
                          {language === "ko"
                            ? showAll
                              ? `전체 ${sortedBom.length}개 항목 표시 중`
                              : `상위 ${TOP_N}개만 표시 중 (+ ${moreCount}개 더)`
                            : showAll
                              ? `Showing all ${sortedBom.length} items`
                              : `Showing top ${TOP_N} (+ ${moreCount} more)`}
                        </p>

                        <button
                          type="button"
                          onClick={() => setShowAll((v) => !v)}
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-black text-zinc-900 hover:bg-zinc-50"
                        >
                          {language === "ko" ? (showAll ? "접기" : "전체 보기") : showAll ? "Collapse" : "Show all"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!result && !isUploading && !isGenerating && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-xs font-semibold text-zinc-500">
                <Sparkles size={14} />
                {t.resultWait}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

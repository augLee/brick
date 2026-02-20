"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { getAdminLogs, pushAdminLog, type AdminLogEntry } from "@/lib/admin-logs";
import { isAdminModeEnabled } from "@/lib/admin-mode";
import { useLanguage, type SiteLanguage } from "@/components/LanguageProvider";

type DownloadPayload = {
  files: Array<{ name: string; url?: string; status?: string; capacity?: string }>;
  note?: string;
  error?: string;
};

const copy = {
  ko: {
    enterPageLog: "성공 페이지 진입",
    missingJobId: "jobId가 없어 다운로드를 준비할 수 없습니다.",
    downloadLoadError: "다운로드 패키지를 불러오지 못했습니다.",
    downloadSuccessLog: "다운로드 데이터 조회 성공",
    downloadFailLog: "다운로드 데이터 조회 실패",
    unknownError: "알 수 없는 오류가 발생했습니다.",
    titlePaid: "결제가 완료되었습니다",
    titleAdmin: "다운로드 준비가 완료되었습니다",
    subtitle: "미리보기와 부품표는 다운로드할 수 있고, 조립 가이드/스토리 카드는 준비중입니다.",
    preparing: "다운로드 패키지 준비 중...",
    download: "다운로드",
    preparingStatus: "준비중",
    adminLogs: "관리자 로그",
    noLogs: "로그가 없습니다.",
  },
  en: {
    enterPageLog: "Entered success page",
    missingJobId: "Cannot prepare download without jobId.",
    downloadLoadError: "Failed to load download package.",
    downloadSuccessLog: "Download data fetched successfully",
    downloadFailLog: "Failed to fetch download data",
    unknownError: "An unknown error occurred.",
    titlePaid: "Payment Complete",
    titleAdmin: "Download Is Ready",
    subtitle: "Preview and parts list are available now; build guide and story card are still preparing.",
    preparing: "Preparing download package...",
    download: "Download",
    preparingStatus: "Preparing",
    adminLogs: "Admin Logs",
    noLogs: "No logs available.",
  },
} satisfies Record<SiteLanguage, Record<string, string>>;

export default function SuccessPage() {
  const { language } = useLanguage();
  const t = copy[language];

  const [data, setData] = useState<DownloadPayload | null>(null);
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const successUrl = `${window.location.pathname}${window.location.search}`;

    // Add one extra history entry so browser-back lands here and gets redirected back to success.
    window.history.pushState({ locked: true }, "", successUrl);

    const handlePopState = () => {
      window.location.replace(successUrl);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resolvedJobId = params.get("jobId");

    if (isAdminModeEnabled) {
      pushAdminLog("success", t.enterPageLog, { jobId: resolvedJobId });
      setLogs(getAdminLogs());
    }

    if (!resolvedJobId) {
      setError(t.missingJobId);
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        const res = await fetch(`/api/download?jobId=${encodeURIComponent(resolvedJobId)}`);
        const payload = (await res.json()) as DownloadPayload;
        if (!res.ok) {
          throw new Error(payload.error || t.downloadLoadError);
        }
        setData(payload);
        if (isAdminModeEnabled) {
          pushAdminLog("download", t.downloadSuccessLog, payload);
          setLogs(getAdminLogs());
        }
      } catch (err: unknown) {
        if (isAdminModeEnabled) {
          pushAdminLog("download", t.downloadFailLog, {
            error: err instanceof Error ? err.message : String(err),
          });
          setLogs(getAdminLogs());
        }
        setError(err instanceof Error ? err.message : t.unknownError);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [t.downloadFailLog, t.downloadLoadError, t.downloadSuccessLog, t.enterPageLog, t.missingJobId, t.unknownError]);

  return (
    <main className="text-zinc-900">
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-8">
        <div className="rounded-[2rem] border border-zinc-100 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-[#C2410C]">
            <CheckCircle2 size={26} />
            <h1 className="text-3xl font-black tracking-tight">{isAdminModeEnabled ? t.titleAdmin : t.titlePaid}</h1>
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-500">{t.subtitle}</p>

          {loading && (
            <div className="mt-8 inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-bold text-zinc-600">
              <Loader2 size={16} className="animate-spin" />
              {t.preparing}
            </div>
          )}

          {error && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}

          {data?.files && !loading && (
            <div className="mt-7 space-y-3">
              {data.files.map((file) =>
                file.url ? (
                  <a
                    key={file.name}
                    href={file.url}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold transition hover:border-orange-200 hover:bg-orange-50"
                  >
                    {file.name}
                    <span className="inline-flex items-center gap-2 text-[#C2410C]">
                      <Download size={14} />
                      {t.download}
                    </span>
                  </a>
                ) : (
                  <div
                    key={file.name}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-600"
                  >
                    <div>{file.name}</div>
                    <div className="text-right text-xs font-bold text-zinc-500">
                      <p>{file.status === "준비중" ? t.preparingStatus : file.status || t.preparingStatus}</p>
                      {file.capacity && <p>{file.capacity}</p>}
                    </div>
                  </div>
                )
              )}
              {data.note && <p className="pt-2 text-xs font-medium text-zinc-400">{data.note}</p>}
            </div>
          )}
        </div>

        {isAdminModeEnabled && (
          <div className="mt-6 rounded-[2rem] border border-zinc-200 bg-zinc-950 p-6 text-xs text-zinc-100 shadow-sm">
            <h2 className="text-sm font-black tracking-tight text-orange-300">{t.adminLogs}</h2>
            <div className="mt-3 max-h-80 overflow-auto rounded-xl bg-black/30 p-3 font-mono leading-relaxed">
              {logs.length === 0 ? (
                <p className="text-zinc-400">{t.noLogs}</p>
              ) : (
                logs.map((entry, index) => (
                  <p key={`${entry.timestamp}-${index}`}>
                    [{entry.timestamp}] [{entry.scope}] {entry.message}
                    {entry.data ? ` ${JSON.stringify(entry.data)}` : ""}
                  </p>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

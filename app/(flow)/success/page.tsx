"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";

type DownloadPayload = {
  files: Array<{ name: string; url: string }>;
  note?: string;
  error?: string;
};

export default function SuccessPage() {
  const [data, setData] = useState<DownloadPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resolvedJobId = params.get("jobId");

    if (!resolvedJobId) {
      setError("jobId가 없어 다운로드를 준비할 수 없습니다.");
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        const res = await fetch(`/api/download?jobId=${encodeURIComponent(resolvedJobId)}`);
        const payload = (await res.json()) as DownloadPayload;
        if (!res.ok) {
          throw new Error(payload.error || "다운로드 패키지를 불러오지 못했습니다.");
        }
        setData(payload);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  return (
    <main className="text-zinc-900">
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-8">
        <div className="rounded-[2rem] border border-zinc-100 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-[#C2410C]">
            <CheckCircle2 size={26} />
            <h1 className="text-3xl font-black tracking-tight">결제가 완료되었습니다</h1>
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-500">아래 파일을 다운로드해 바로 조립을 시작하세요.</p>

          {loading && (
            <div className="mt-8 inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-bold text-zinc-600">
              <Loader2 size={16} className="animate-spin" />
              다운로드 패키지 준비 중...
            </div>
          )}

          {error && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}

          {data?.files && !loading && (
            <div className="mt-7 space-y-3">
              {data.files.map((file) => (
                <a
                  key={file.name}
                  href={file.url}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold transition hover:border-orange-200 hover:bg-orange-50"
                >
                  {file.name}
                  <span className="inline-flex items-center gap-2 text-[#C2410C]">
                    <Download size={14} />
                    다운로드
                  </span>
                </a>
              ))}
              {data.note && <p className="pt-2 text-xs font-medium text-zinc-400">{data.note}</p>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

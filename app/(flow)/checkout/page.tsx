"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { pushAdminLog } from "@/lib/admin-logs";
import { isAdminModeEnabled } from "@/lib/admin-mode";
import { useLanguage, type SiteLanguage } from "@/components/LanguageProvider";

const copy = {
  ko: {
    enterPageLog: "체크아웃 페이지 진입",
    bypassLog: "관리자 모드 결제 우회",
    sessionError: "결제 세션 생성에 실패했습니다.",
    sessionDoneLog: "결제 세션 생성 완료",
    checkoutFailLog: "결제 진행 실패",
    checkoutError: "결제 처리 중 오류가 발생했습니다.",
    title: "패키지 결제",
    description: "결제 완료 후 바로 조립 가이드, 부품 리스트, 미리보기 이미지를 다운로드할 수 있습니다.",
    adminMode: "환경설정: 관리자 모드",
    oncePayment: "1회 결제 / jobId 기준 다운로드 제공",
    movingPayment: "결제 페이지 이동 중...",
    adminSkip: "관리자 모드로 바로 다운로드 이동",
    payNow: "결제하고 다운로드 받기",
    includes: "포함 항목",
    item1: "고화질 브릭 미리보기 PNG",
    item2: "부품 BOM CSV",
    item3: "층별 조립 가이드 PDF",
    item4: "스토리 카드 텍스트",
    secureText: "안전 결제(Stripe 연동 예정), 성공 후 즉시 다운로드",
    secureAdminText: "관리자 모드: 결제를 건너뛰고 즉시 다운로드로 이동",
  },
  en: {
    enterPageLog: "Entered checkout page",
    bypassLog: "Admin mode payment bypass",
    sessionError: "Failed to create checkout session.",
    sessionDoneLog: "Checkout session created",
    checkoutFailLog: "Checkout failed",
    checkoutError: "An error occurred while processing payment.",
    title: "Package Checkout",
    description: "After payment, you can immediately download the build guide, parts list, and preview image.",
    adminMode: "Settings: Admin mode",
    oncePayment: "One-time payment / Download available by jobId",
    movingPayment: "Redirecting to payment...",
    adminSkip: "Skip payment in admin mode and go to download",
    payNow: "Pay and Download",
    includes: "What's Included",
    item1: "High-resolution brick preview PNG",
    item2: "Parts BOM CSV",
    item3: "Layer-by-layer build guide PDF",
    item4: "Story card text",
    secureText: "Secure payment (Stripe integration planned), instant download after success",
    secureAdminText: "Admin mode: skip payment and go straight to download",
  },
} satisfies Record<SiteLanguage, Record<string, string>>;

export default function CheckoutPage() {
  const { language } = useLanguage();
  const t = copy[language];

  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resolvedJobId = params.get("jobId");
    setJobId(resolvedJobId);

    if (isAdminModeEnabled) {
      pushAdminLog("checkout", t.enterPageLog, { jobId: resolvedJobId });
    }
  }, [t.enterPageLog]);

  const canProceed = useMemo(() => Boolean(jobId), [jobId]);

  const handleCheckout = async () => {
    if (!jobId) return;

    if (isAdminModeEnabled) {
      pushAdminLog("checkout", t.bypassLog, { jobId });
      router.push(`/success?jobId=${encodeURIComponent(jobId)}`);
      return;
    }

    try {
      setPending(true);
      setError(null);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || t.sessionError);
      }

      if (isAdminModeEnabled) {
        pushAdminLog("checkout", t.sessionDoneLog, { jobId, checkoutUrl: data.checkoutUrl });
      }
      router.push(data.checkoutUrl);
    } catch (err: unknown) {
      if (isAdminModeEnabled) {
        pushAdminLog("checkout", t.checkoutFailLog, { error: err instanceof Error ? err.message : String(err) });
      }
      setError(err instanceof Error ? err.message : t.checkoutError);
      setPending(false);
    }
  };

  return (
    <main className="text-zinc-900">
      <section className="mx-auto grid max-w-5xl gap-8 px-6 pb-14 pt-6 md:grid-cols-2">
        <div className="rounded-[2rem] border border-zinc-100 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-black tracking-tight">{t.title}</h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-zinc-500">{t.description}</p>
          {isAdminModeEnabled && (
            <p className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">
              {t.adminMode} <span className="text-emerald-600">ON</span>
            </p>
          )}

          <div className="mt-8 rounded-2xl bg-zinc-50 p-5">
            <p className="text-sm font-bold text-zinc-700">Brickify Digital Package</p>
            <p className="mt-2 text-3xl font-black text-[#C2410C]">₩4,900</p>
            <p className="mt-2 text-xs font-medium text-zinc-500">{t.oncePayment}</p>
          </div>

          {jobId && <p className="mt-5 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-xs font-semibold text-[#B8430A]">jobId: {jobId}</p>}

          {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}

          <button
            type="button"
            disabled={!canProceed || pending}
            onClick={handleCheckout}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C2410C] px-4 py-4 text-base font-bold text-white transition hover:bg-[#B8430A] disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {pending ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
            {pending ? t.movingPayment : isAdminModeEnabled ? t.adminSkip : t.payNow}
          </button>
        </div>

        <div className="rounded-[2rem] border border-zinc-100 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-black tracking-tight">{t.includes}</h2>
          <ul className="mt-5 space-y-3 text-sm font-semibold text-zinc-700">
            <li className="rounded-xl bg-zinc-50 px-4 py-3">{t.item1}</li>
            <li className="rounded-xl bg-zinc-50 px-4 py-3">{t.item2}</li>
            <li className="rounded-xl bg-zinc-50 px-4 py-3">{t.item3}</li>
            <li className="rounded-xl bg-zinc-50 px-4 py-3">{t.item4}</li>
          </ul>

          <div className="mt-8 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <ShieldCheck size={16} />
            {isAdminModeEnabled ? t.secureAdminText : t.secureText}
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

export function FlowHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useLanguage();
  const hideBackButton = pathname === "/success";

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-8">
      <Link href="/">
        <Logo />
      </Link>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
        {!hideBackButton && (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
          >
            <span aria-hidden>🔙</span>
            {language === "ko" ? "뒤로가기" : "Back"}
          </button>
        )}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-bold text-[#C2410C] transition hover:bg-orange-100"
        >
          <span aria-hidden>🏠</span>
          {language === "ko" ? "홈" : "Home"}
        </Link>
      </div>
    </header>
  );
}

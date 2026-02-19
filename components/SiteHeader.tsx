"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/components/LanguageProvider";

export function SiteHeader() {
  const { language } = useLanguage();

  return (
    <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-8">
      <Link href="/">
        <Logo />
      </Link>
      <div className="md:hidden">
        <ThemeToggle />
      </div>
      <nav className="hidden items-center gap-3 text-sm font-bold text-zinc-600 md:flex">
        <Link
          href="/create"
          className="rounded-full bg-[#C2410C] px-4 py-2 text-white transition hover:bg-[#B8430A]"
        >
          {language === "ko" ? "시작하기" : "Start"}
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}

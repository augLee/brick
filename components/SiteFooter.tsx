"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";

const policyLinks = {
  ko: [
    { href: "/about", label: "서비스 소개" },
    { href: "/privacy", label: "개인정보처리방침" },
    { href: "/terms", label: "이용약관" },
    { href: "/contact", label: "문의하기" },
  ],
  en: [
    { href: "/about", label: "About" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms" },
    { href: "/contact", label: "Contact" },
  ],
} as const;

const description = {
  ko: "이 사이트는 사진 기반 브릭 도안 생성 서비스를 제공합니다. 자동화된 결과물은 참고용이며, 실제 부품 수량 및 조립 난이도는 이미지 특성에 따라 달라질 수 있습니다.",
  en: "This site provides a photo-based brick blueprint generation service. Automated outputs are for reference only, and actual part counts and build difficulty may vary by image characteristics.",
} as const;

export function SiteFooter() {
  const { language } = useLanguage();

  return (
    <footer className="border-t border-zinc-200 bg-white/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-zinc-600 md:flex-row md:items-center md:justify-between md:px-8">
        <p className="font-semibold text-zinc-700">Brickify AI</p>
        <div className="flex flex-wrap items-center gap-4">
          <nav className="flex flex-wrap items-center gap-4">
            {policyLinks[language].map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-zinc-900">
                {item.label}
              </Link>
            ))}
          </nav>
          <LanguageSwitcher />
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-6 pb-8 text-xs text-zinc-500 md:px-8">
        <p>{description[language]}</p>
      </div>
    </footer>
  );
}

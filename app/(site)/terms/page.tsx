"use client";

import { useLanguage } from "@/components/LanguageProvider";

export default function TermsPage() {
  const { language } = useLanguage();

  return (
    <main className="mx-auto max-w-4xl px-6 pb-16 pt-10 md:px-8">
      <h1 className="text-3xl font-black tracking-tight">{language === "ko" ? "이용약관" : "Terms of Service"}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-700">
        {language === "ko" ? (
          <>
            <p>본 서비스는 사진 기반 브릭 도안 생성 기능을 제공합니다.</p>
            <p>
              사용자는 업로드 파일에 대한 권리를 보유하거나 적법한 사용 권한을 가지고 있어야 하며, 제3자의 권리를 침해하는 콘텐츠를
              업로드해서는 안 됩니다.
            </p>
            <p>
              자동 생성 결과는 참고용으로 제공되며, 서비스는 생성물의 완전성, 특정 목적 적합성, 상업적 이용 가능성을 보장하지
              않습니다.
            </p>
            <p>서비스 운영 정책, 기능, 가격은 사전 고지 후 변경될 수 있습니다.</p>
          </>
        ) : (
          <>
            <p>This service provides photo-based brick blueprint generation features.</p>
            <p>
              Users must own the rights to uploaded files or have lawful permission to use them, and must not upload content that infringes third-party
              rights.
            </p>
            <p>
              Auto-generated outputs are provided for reference only, and the service does not guarantee completeness, fitness for a particular purpose, or
              commercial usability of generated content.
            </p>
            <p>Service policies, features, and pricing may change with prior notice.</p>
          </>
        )}
      </div>
    </main>
  );
}

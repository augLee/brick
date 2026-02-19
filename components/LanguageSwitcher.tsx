"use client";

import { useLanguage } from "@/components/LanguageProvider";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500">
      {language === "ko" ? "언어" : "Language"}
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as "ko" | "en")}
        className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold text-zinc-700 outline-none transition focus:border-[#C2410C]"
        aria-label="Select language"
      >
        <option value="ko">한국어</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}

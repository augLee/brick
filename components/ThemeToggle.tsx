"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("theme_mode");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const next = getInitialTheme();
    setTheme(next);
    document.documentElement.classList.toggle("theme-dark", next === "dark");
    setMounted(true);
  }, []);

  const onToggle = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("theme-dark", next === "dark");
    window.localStorage.setItem("theme_mode", next);
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
      aria-label="다크모드 전환"
    >
      {mounted && theme === "dark" ? "☀️ 화이트" : "🌙 다크"}
    </button>
  );
}

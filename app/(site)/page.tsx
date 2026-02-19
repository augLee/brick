"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Box, Image as ImageIcon, Layers, ListChecks, Sparkles, Zap } from "lucide-react";
import { useLanguage, type SiteLanguage } from "@/components/LanguageProvider";

const copy = {
  ko: {
    badge: "The Art of Building",
    heroTitleLine1: "당신의 사진,",
    heroTitleHighlight: "브릭 작품",
    heroTitleLine2: "이 되다.",
    heroDescLine1: "복잡한 설계는 AI에게 맡기고,",
    heroDescLine2: "당신은 조립의 즐거움만 만끽하세요.",
    cta: "지금 시작하기",
    howTitle: "작동 방식은 간단해요",
    howDesc: "업로드 → 설계 → 다운로드. 딱 3단계로 끝납니다.",
    features: [
      {
        title: "AI 정밀 설계",
        desc: "이미지의 명암과 색감을 분석해 조립 가능한 최적 도안을 만듭니다.",
      },
      {
        title: "실물 부품 매칭",
        desc: "시중 브릭 규격과 매칭되는 부품 종류와 수량을 자동 산출합니다.",
      },
      {
        title: "즉시 다운로드",
        desc: "결제와 동시에 도안, 리스트, 가이드가 담긴 패키지를 받습니다.",
      },
    ],
    packageTitle: "결제 즉시 받는 디지털 패키지",
    packageDesc: "당신의 창작을 도와줄 4가지 핵심 결과물을 한 번에 제공합니다.",
    packages: [
      {
        title: "고화질 브릭 도안 (PNG)",
        desc: "명암과 색감을 브릭 느낌으로 정리한 출력용 이미지 도안입니다.",
        meta: "brickify-art.png",
      },
      {
        title: "부품 리스트 (CSV)",
        desc: "필요한 브릭 종류와 수량을 한눈에 확인할 수 있는 목록입니다.",
        meta: "parts-list.csv",
      },
      {
        title: "AI 스토리 카드",
        desc: "사진의 분위기에 맞춘 짧은 스토리와 조립 팁을 제공합니다.",
        meta: "story-card.txt",
      },
      {
        title: "조립 가이드 (PDF)",
        desc: "순서와 주의사항을 담은 간단하고 깔끔한 가이드북입니다.",
        meta: "build-guide.pdf",
      },
    ],
    packageFootnote: "* 결과물 형식 및 구성은 서비스 업데이트에 따라 변경될 수 있습니다.",
  },
  en: {
    badge: "The Art of Building",
    heroTitleLine1: "Your photo,",
    heroTitleHighlight: "a brick artwork",
    heroTitleLine2: "rebuilt.",
    heroDescLine1: "Let AI handle the complex design,",
    heroDescLine2: "and enjoy the fun of building.",
    cta: "Start Now",
    howTitle: "How it works",
    howDesc: "Upload -> Design -> Download. Just 3 steps.",
    features: [
      {
        title: "AI Precision Design",
        desc: "We analyze tone and color to create an optimized, buildable brick blueprint.",
      },
      {
        title: "Real Part Matching",
        desc: "Part types and quantities are calculated automatically against market brick standards.",
      },
      {
        title: "Instant Download",
        desc: "After checkout, get the full package with blueprint, parts list, and guide.",
      },
    ],
    packageTitle: "Digital package delivered instantly",
    packageDesc: "Get four essential outputs to move from photo to build in one go.",
    packages: [
      {
        title: "High-Res Brick Art (PNG)",
        desc: "A print-ready image blueprint refined into a brick-like visual style.",
        meta: "brickify-art.png",
      },
      {
        title: "Parts List (CSV)",
        desc: "A clear list of required brick types and quantities.",
        meta: "parts-list.csv",
      },
      {
        title: "AI Story Card",
        desc: "A short themed story and building tips tailored to your photo.",
        meta: "story-card.txt",
      },
      {
        title: "Build Guide (PDF)",
        desc: "A concise guidebook with step order and key cautions.",
        meta: "build-guide.pdf",
      },
    ],
    packageFootnote: "* Output formats and bundle composition may change as the service evolves.",
  },
} satisfies Record<
  SiteLanguage,
  {
    badge: string;
    heroTitleLine1: string;
    heroTitleHighlight: string;
    heroTitleLine2: string;
    heroDescLine1: string;
    heroDescLine2: string;
    cta: string;
    howTitle: string;
    howDesc: string;
    features: Array<{ title: string; desc: string }>;
    packageTitle: string;
    packageDesc: string;
    packages: Array<{ title: string; desc: string; meta: string }>;
    packageFootnote: string;
  }
>;

export default function LandingPage() {
  const { language } = useLanguage();
  const t = copy[language];

  return (
    <main className="relative overflow-hidden bg-[#FFFEFA]">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_45%_at_50%_10%,rgba(194,65,12,0.12)_0%,rgba(250,249,246,0)_60%)]" />

      <section className="relative z-10 mx-auto max-w-5xl px-6 py-24 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#C2410C] shadow-sm">
          {t.badge}
        </div>

        <h1 className="mb-8 text-5xl font-black leading-[1.1] tracking-tight text-zinc-900 md:text-7xl">
          {t.heroTitleLine1} <br />
          <span className="text-[#C2410C]">{t.heroTitleHighlight}</span> {t.heroTitleLine2}
        </h1>

        <p className="mx-auto mb-14 max-w-xl text-lg font-medium leading-relaxed text-zinc-500 md:text-xl">
          {t.heroDescLine1} <br />
          {t.heroDescLine2}
        </p>

        <div className="flex justify-center">
          <Link
            href="/create"
            className="group flex items-center gap-3 rounded-full bg-[#C2410C] px-10 py-5 text-lg font-bold text-white transition-all hover:bg-[#B8430A] hover:shadow-[0_20px_50px_rgba(194,65,12,0.3)] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-orange-200"
          >
            {t.cta}
            <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 mx-auto max-w-6xl px-8 pb-16">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 md:text-4xl">{t.howTitle}</h2>
          <p className="mt-4 text-base font-medium leading-relaxed text-zinc-600 md:text-lg">{t.howDesc}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard icon={<Layers size={22} />} step="01" title={t.features[0].title} desc={t.features[0].desc} />
          <FeatureCard icon={<Box size={22} />} step="02" title={t.features[1].title} desc={t.features[1].desc} />
          <FeatureCard icon={<Zap size={22} />} step="03" title={t.features[2].title} desc={t.features[2].desc} />
        </div>
      </section>

      <section id="package" className="relative z-10 mx-auto max-w-6xl px-8 pb-32">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 md:text-4xl">{t.packageTitle}</h2>
          <p className="mt-4 text-base font-medium leading-relaxed text-zinc-600">{t.packageDesc}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <PackageCard icon={<ImageIcon size={22} />} title={t.packages[0].title} desc={t.packages[0].desc} meta={t.packages[0].meta} />
          <PackageCard icon={<ListChecks size={22} />} title={t.packages[1].title} desc={t.packages[1].desc} meta={t.packages[1].meta} />
          <PackageCard icon={<Sparkles size={22} />} title={t.packages[2].title} desc={t.packages[2].desc} meta={t.packages[2].meta} />
          <PackageCard icon={<BookOpen size={22} />} title={t.packages[3].title} desc={t.packages[3].desc} meta={t.packages[3].meta} />
        </div>

        <div className="mt-12 text-center text-xs font-medium text-zinc-400">{t.packageFootnote}</div>
      </section>
    </main>
  );
}

function FeatureCard({ icon, step, title, desc }: { icon: ReactNode; step: string; title: string; desc: string }) {
  return (
    <div className="group cursor-default rounded-[2.25rem] border border-zinc-100 bg-[#FBFBFA] p-10 transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:bg-white hover:shadow-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-100 bg-white text-[#C2410C] shadow-sm transition-all group-hover:scale-110 group-hover:border-orange-100 group-hover:bg-orange-50">
          {icon}
        </div>
        <div className="text-xs font-black uppercase tracking-widest text-zinc-300">Step {step}</div>
      </div>
      <h3 className="mb-2 text-xl font-bold text-zinc-900">{title}</h3>
      <p className="text-sm font-medium leading-relaxed text-zinc-500">{desc}</p>
    </div>
  );
}

function PackageCard({ icon, title, desc, meta }: { icon: ReactNode; title: string; desc: string; meta: string }) {
  return (
    <div className="group cursor-default rounded-[2.25rem] border border-zinc-100 bg-[#FBFBFA] p-10 transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:bg-white hover:shadow-2xl">
      <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-100 bg-white text-[#C2410C] shadow-sm transition-all group-hover:scale-110 group-hover:border-orange-100 group-hover:bg-orange-50">
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-bold text-zinc-900">{title}</h3>
      <p className="mb-6 text-sm font-medium leading-relaxed text-zinc-500">{desc}</p>
      <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-[10px] font-bold tracking-tight text-zinc-400">
        {meta}
      </div>
    </div>
  );
}

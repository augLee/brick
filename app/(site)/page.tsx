// app/(site)/page.tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Box, Layers, Zap, Image as ImageIcon, ListChecks, BookOpen, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FFFEFA]">
      {/* 배경 상단 은은한 오렌지 글로우 효과 */}
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_45%_at_50%_10%,rgba(194,65,12,0.12)_0%,rgba(250,249,246,0)_60%)]" />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center px-8 py-8 md:px-12">
        <Link href="/">
          <Logo />
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-1.5 text-xs font-bold text-[#C2410C] mb-8 uppercase tracking-widest border border-orange-100 shadow-sm">
          The Art of Building
        </div>

        <h1 className="mb-8 text-5xl font-black leading-[1.1] tracking-tight text-zinc-900 md:text-7xl">
          당신의 사진, <br />
          <span className="text-[#C2410C]">브릭 작품</span>이 되다.
        </h1>
        
        <p className="mx-auto mb-14 max-w-xl text-lg leading-relaxed text-zinc-500 md:text-xl font-medium">
          복잡한 설계는 AI에게 맡기고, <br />
          당신은 조립의 즐거움만 만끽하세요.
        </p>

        <div className="flex justify-center">
          <Link
            href="/create"
            className="group flex items-center gap-3 rounded-full bg-[#C2410C] 
            px-10 py-5 text-lg font-bold text-white transition-all 
            hover:bg-[#B8430A] hover:shadow-[0_20px_50px_rgba(194,65,12,0.3)] 
            active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-orange-200"
          >
            지금 시작하기
            <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* How it works Section */}
      <section className="relative z-10 mx-auto max-w-6xl px-8 pb-16">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 md:text-4xl">
            작동 방식은 간단해요
          </h2>
          <p className="mt-4 text-base font-medium leading-relaxed text-zinc-600 md:text-lg">
            업로드 → 설계 → 다운로드. 딱 3단계로 끝납니다.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<Layers size={22} />}
            step="01"
            title="AI 정밀 설계"
            desc="이미지의 명암과 색감을 분석해 조립 가능한 최적 도안을 만듭니다."
          />
          <FeatureCard
            icon={<Box size={22} />}
            step="02"
            title="실물 부품 매칭"
            desc="시중 브릭 규격과 매칭되는 부품 종류와 수량을 자동 산출합니다."
          />
          <FeatureCard
            icon={<Zap size={22} />}
            step="03"
            title="즉시 다운로드"
            desc="결제와 동시에 도안, 리스트, 가이드가 담긴 패키지를 받습니다."
          />
        </div>
      </section>

      {/* Package Preview Section */}
      <section className="relative z-10 mx-auto max-w-6xl px-8 pb-32">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 md:text-4xl">
            결제 즉시 받는 디지털 패키지
          </h2>
          <p className="mt-4 text-base font-medium leading-relaxed text-zinc-600">
            당신의 창작을 도와줄 4가지 핵심 결과물을 한 번에 제공합니다.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <PackageCard
            icon={<ImageIcon size={22} />}
            title="고화질 브릭 도안 (PNG)"
            desc="명암과 색감을 브릭 느낌으로 정리한 출력용 이미지 도안입니다."
            meta="brickify-art.png"
          />
          <PackageCard
            icon={<ListChecks size={22} />}
            title="부품 리스트 (CSV)"
            desc="필요한 브릭 종류와 수량을 한눈에 확인할 수 있는 목록입니다."
            meta="parts-list.csv"
          />
          <PackageCard
            icon={<Sparkles size={22} />}
            title="AI 스토리 카드"
            desc="사진의 분위기에 맞춘 짧은 스토리와 조립 팁을 제공합니다."
            meta="story-card.txt"
          />
          <PackageCard
            icon={<BookOpen size={22} />}
            title="조립 가이드 (PDF)"
            desc="순서와 주의사항을 담은 간단하고 깔끔한 가이드북입니다."
            meta="build-guide.pdf"
          />
        </div>

        <div className="mt-12 text-center text-xs font-medium text-zinc-400">
          * 결과물 형식 및 구성은 서비스 업데이트에 따라 변경될 수 있습니다.
        </div>
      </section>
    </main>
  );
}

// 재사용 가능한 특징 카드 컴포넌트
function FeatureCard({ icon, step, title, desc }: { icon: ReactNode, step: string, title: string, desc: string }) {
  return (
    <div className="group cursor-default rounded-[2.25rem] bg-[#FBFBFA] p-10 border border-zinc-100 transition-all duration-300 hover:bg-white hover:border-orange-200 hover:shadow-2xl hover:-translate-y-1">
      <div className="mb-6 flex items-center justify-between">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-zinc-100 text-[#C2410C] shadow-sm transition-all group-hover:scale-110 group-hover:bg-orange-50 group-hover:border-orange-100">
          {icon}
        </div>
        <div className="text-xs font-black tracking-widest text-zinc-300 uppercase">
          Step {step}
        </div>
      </div>
      <h3 className="mb-2 text-xl font-bold text-zinc-900">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-500 font-medium">{desc}</p>
    </div>
  );
}

// 재사용 가능한 패키지 아이템 카드 컴포넌트
function PackageCard({ icon, title, desc, meta }: { icon: ReactNode, title: string, desc: string, meta: string }) {
  return (
    <div className="group cursor-default rounded-[2.25rem] bg-[#FBFBFA] p-10 border border-zinc-100 transition-all duration-300 hover:bg-white hover:border-orange-200 hover:shadow-2xl hover:-translate-y-1">
      <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-zinc-100 text-[#C2410C] shadow-sm transition-all group-hover:scale-110 group-hover:bg-orange-50 group-hover:border-orange-100">
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-bold text-zinc-900">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-500 font-medium mb-6">{desc}</p>
      <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-[10px] font-bold text-zinc-400 tracking-tight">
        {meta}
      </div>
    </div>
  );
}
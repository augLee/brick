// app/(flow)/create/page.tsx
"use client";

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Upload, Sparkles, Loader2, ArrowRight, RefreshCcw, CheckCircle2, Info } from 'lucide-react';
import { Logo } from '@/components/Logo';

export default function CreatePage() {
  // 상태 관리
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{
    previewImageUrl: string;
    partsSummary: string;
    storyText: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 파일 선택 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setResult(null); // 새로운 사진 올리면 이전 결과 초기화
    }
  };

  // 생성 프로세스 실행
  const generateBrickArt = async () => {
    if (!file) return;

    try {
      setIsUploading(true);
      
      // 1. 이미지 업로드 API 호출
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error);

      // 2. 브릭 변환 API 호출
      setIsUploading(false);
      setIsGenerating(true);

      const generateRes = await fetch('/api/generate-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputImageUrl: uploadData.url }),
      });
      const generateData = await generateRes.json();
      if (!generateRes.ok) throw new Error(generateData.error);

      // 3. 결과 설정
      setResult(generateData);
    } catch (error: any) {
      alert(`오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsUploading(false);
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFEFA] text-zinc-900">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6">
        <Link href="/"><Logo /></Link>
        <div className="hidden md:block text-sm font-medium text-zinc-400">
          Step 2: Create your masterpiece
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-12 md:grid-cols-2">
          
          {/* Left: Upload Section */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight">사진 업로드</h1>
              <p className="text-zinc-500 font-medium">변환하고 싶은 사물이나 인물 사진을 올려주세요.</p>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`relative aspect-square cursor-pointer overflow-hidden rounded-[2.5rem] border-2 border-dashed transition-all
                ${previewUrl ? 'border-[#C2410C] bg-white' : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100'}`}
            >
              {previewUrl ? (
                <Image src={previewUrl} alt="Preview" fill className="object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center space-y-4">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <Upload className="text-[#C2410C]" size={28} />
                  </div>
                  <p className="text-sm font-bold text-zinc-400">클릭하여 사진 선택</p>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*" 
              />
            </div>

            <button
              onClick={generateBrickArt}
              disabled={!file || isUploading || isGenerating}
              className="w-full group flex items-center justify-center gap-3 rounded-3xl bg-[#C2410C] py-5 text-lg font-bold text-white transition-all 
              hover:bg-[#B8430A] disabled:bg-zinc-200 disabled:cursor-not-allowed shadow-lg hover:shadow-orange-200"
            >
              {isUploading ? <><Loader2 className="animate-spin" /> 업로드 중...</> :
               isGenerating ? <><Loader2 className="animate-spin" /> AI 설계 중...</> :
               <><Sparkles size={20} /> 브릭으로 변환하기</>}
            </button>
          </div>

          {/* Right: Result Section */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-black tracking-tight">AI 결과물</h2>
              <p className="text-zinc-500 font-medium">AI가 생성한 3D 브릭 미리보기입니다.</p>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-[2.5rem] bg-zinc-100 border border-zinc-200 shadow-inner">
              {result ? (
                <Image src={result.previewImageUrl} alt="Result" fill className="object-cover animate-in fade-in duration-1000" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-12 text-center space-y-4">
                  <div className="rounded-2xl bg-zinc-200/50 p-4">
                    <BoxIcon className="text-zinc-300" size={32} />
                  </div>
                  <p className="text-sm font-medium text-zinc-400">왼쪽에서 사진을 변환하면<br />여기에 결과가 나타납니다.</p>
                </div>
              )}
            </div>

            {result && (
              <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                <div className="rounded-[1.5rem] bg-orange-50 p-6 border border-orange-100">
                  <div className="flex items-center gap-2 mb-2 text-[#C2410C]">
                    <CheckCircle2 size={18} />
                    <span className="font-bold">분석 완료</span>
                  </div>
                  <p className="text-sm text-[#B8430A] font-medium leading-relaxed whitespace-pre-wrap">
                    {result.storyText}
                  </p>
                </div>
                
                <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold">
                        <Info size={14} />
                        {result.partsSummary}
                    </div>
                    <Link href="/checkout" className="flex items-center gap-2 text-[#C2410C] font-extrabold text-sm hover:underline">
                        전체 패키지 구매하기 <ArrowRight size={16} />
                    </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function BoxIcon({ size, className }: { size: number, className: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    </svg>
  );
}
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // 세련된 샌드세리프 폰트
import Script from "next/script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "700", "900"] });

export const metadata: Metadata = {
  title: "Brickify AI | 당신의 사진을 브릭 작품으로",
  description: "OpenAI와 Gemini를 이용해 사진을 정교한 3D 브릭 조형물 미리보기로 변환하고 조립 도안을 받으세요.",
  icons: {
    icon: "/favicon.ico", // 나중에 아이콘 넣으실 때를 위해
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="google-adsense-account" content="ca-pub-3111052801805664" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var saved=localStorage.getItem("theme_mode");var dark=saved?saved==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(dark){document.documentElement.classList.add("theme-dark");}}catch(e){}})();`,
          }}
        />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3111052801805664"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}

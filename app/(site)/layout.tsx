import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FFFEFA] text-zinc-900">
      <SiteHeader />
      {children}
    </div>
  );
}

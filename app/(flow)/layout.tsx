import type { ReactNode } from "react";
import { FlowHeader } from "@/components/FlowHeader";

export default function FlowLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FFFEFA] text-zinc-900">
      <FlowHeader />
      {children}
    </div>
  );
}

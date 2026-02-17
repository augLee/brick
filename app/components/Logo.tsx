// components/Logo.tsx
import React from 'react';

export const Logo = () => (
  <div className="group flex items-center gap-2.5 cursor-pointer select-none">
    <svg 
      width="34" height="34" viewBox="0 -4 24 28" fill="none" xmlns="http://www.w3.org/2000/svg"
      className="transition-transform duration-300"
    >
      <rect x="2" y="14" width="9" height="7" rx="1.5" fill="#27272A" />
      <rect x="13" y="14" width="9" height="7" rx="1.5" fill="#27272A" opacity="0.6" />
      <g className="transition-all duration-300 ease-out group-hover:-translate-y-2 group-hover:rotate-6 origin-[12px_8px]">
        <rect x="7.5" y="5" width="9" height="7" rx="1.5" fill="#C2410C" />
        <circle cx="10" cy="5" r="1" fill="#C2410C" />
        <circle cx="14" cy="5" r="1" fill="#C2410C" />
      </g>
    </svg>
    <span className="text-xl font-black tracking-tighter text-zinc-900 transition-colors duration-300 group-hover:text-[#C2410C]">
      BRICKIFY AI
    </span>
  </div>
);
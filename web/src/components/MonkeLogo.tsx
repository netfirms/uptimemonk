import React from "react";

interface MonkeLogoProps {
  size?: number;
  className?: string;
}

export function MonkeLogo({ size = 20, className = "" }: MonkeLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="UptimeMonke Logo"
    >
      {/* Ears */}
      <circle cx="4" cy="12" r="3.2" />
      <circle cx="20" cy="12" r="3.2" />

      {/* Head shape */}
      <path d="M12 4.5C7.8 4.5 5.5 8 5.5 13c0 4.2 2.8 7 6.5 7s6.5-2.8 6.5-7c0-5-2.3-8.5-6.5-8.5z" />

      {/* Antenna / Monitoring Probe on Head */}
      <rect x="11" y="1.5" width="2" height="3.5" rx="1" />
      <circle cx="12" cy="1.5" r="1.5" />

      {/* Inner Ear accents (green / cutout) */}
      <circle cx="4" cy="12" r="1.5" fill="#6fc3df" />
      <circle cx="20" cy="12" r="1.5" fill="#6fc3df" />

      {/* Eyes (green / cutout) */}
      <circle cx="9.3" cy="11.2" r="1.5" fill="#6fc3df" />
      <circle cx="14.7" cy="11.2" r="1.5" fill="#6fc3df" />

      {/* Muzzle / Mouth Area (green / cutout) */}
      <ellipse cx="12" cy="16" rx="3.5" ry="2.2" fill="#6fc3df" />

      {/* Monke nose dots */}
      <circle cx="11.2" cy="15.4" r="0.45" fill="#070b10" />
      <circle cx="12.8" cy="15.4" r="0.45" fill="#070b10" />

      {/* Monke smile */}
      <path
        d="M10.7 16.6c.8.6 1.8.6 2.6 0"
        stroke="#070b10"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

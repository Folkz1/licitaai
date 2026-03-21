/**
 * LicitaIA Brand Logo
 * Ícone: documento com radar/pulse (representa monitoramento inteligente de editais)
 * Cores: indigo (#6366f1) para IA + emerald (#10b981) para o pulse/radar ativo
 */

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const SIZES = {
  sm: { icon: 28, text: "text-base", gap: "gap-2" },
  md: { icon: 36, text: "text-xl", gap: "gap-2.5" },
  lg: { icon: 44, text: "text-2xl", gap: "gap-3" },
  xl: { icon: 56, text: "text-3xl", gap: "gap-3.5" },
};

export function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  const s = SIZES[size];

  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <LogoIcon size={s.icon} />
      {showText && (
        <span className={`font-bold ${s.text} tracking-tight`}>
          <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            Licita
          </span>
          <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            IA
          </span>
        </span>
      )}
    </span>
  );
}

export function LogoIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="LicitaIA"
    >
      {/* Background rounded square */}
      <rect
        width="48"
        height="48"
        rx="12"
        fill="url(#bg-gradient)"
      />

      {/* Document shape */}
      <path
        d="M16 10h10l8 8v20a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z"
        fill="rgba(255,255,255,0.12)"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1.5"
      />
      {/* Document fold */}
      <path
        d="M26 10v6a2 2 0 0 0 2 2h6"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1.5"
      />

      {/* Text lines on document */}
      <line x1="18" y1="24" x2="28" y2="24" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="28" x2="26" y2="28" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="32" x2="24" y2="32" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" />

      {/* Radar/pulse rings (emerald, bottom-right) */}
      <circle cx="33" cy="33" r="4" fill="url(#pulse-gradient)" />
      <circle cx="33" cy="33" r="7" fill="none" stroke="#34d399" strokeWidth="1.2" opacity="0.5" />
      <circle cx="33" cy="33" r="10.5" fill="none" stroke="#34d399" strokeWidth="0.8" opacity="0.25" />

      {/* Active dot (center of radar) */}
      <circle cx="33" cy="33" r="2" fill="#ffffff" />

      <defs>
        <linearGradient id="bg-gradient" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <radialGradient id="pulse-gradient" cx="33" cy="33" r="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Favicon-optimized version (simpler, works at 16x16) */
export function LogoFavicon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#fav-bg)" />
      <path d="M10 7h7l5 5v13a1.5 1.5 0 0 1-1.5 1.5h-10.5a1.5 1.5 0 0 1-1.5-1.5V8.5A1.5 1.5 0 0 1 10 7z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      <circle cx="22" cy="22" r="3" fill="#10b981" />
      <circle cx="22" cy="22" r="1.2" fill="#ffffff" />
      <defs>
        <linearGradient id="fav-bg" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
    </svg>
  );
}

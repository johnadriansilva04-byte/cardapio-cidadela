export default function RobotWaiter() {
  return (
    <svg viewBox="0 0 200 240" className="size-40" role="img" aria-label="Robô garçom animado">
      <defs>
        <radialGradient id="head3D" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#bfe3f7" />
          <stop offset="100%" stopColor="#2f6f9e" />
        </radialGradient>
        <linearGradient id="body3D" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#cfe9fa" />
          <stop offset="75%" stopColor="#4682b4" />
          <stop offset="100%" stopColor="#1e3a5f" />
        </linearGradient>
        <linearGradient id="suitGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3a3a3a" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
        <linearGradient id="shirtGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d8d8d8" />
        </linearGradient>
        <linearGradient id="trayGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e6e6e6" />
          <stop offset="50%" stopColor="#a9a9a9" />
          <stop offset="100%" stopColor="#6e6e6e" />
        </linearGradient>
        <linearGradient id="glassGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#cfe9fa" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7fd3ff" />
          <stop offset="100%" stopColor="#1f7fbf" />
        </linearGradient>
        <filter id="shadow3D" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.55" />
        </filter>
        <filter id="glow3D" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Corpo */}
      <g filter="url(#shadow3D)">
        <rect x="90" y="72" width="20" height="14" rx="6" fill="url(#body3D)" />
        <ellipse cx="100" cy="160" rx="46" ry="62" fill="url(#body3D)" />
        <path d="M62 128 Q100 108 138 128 L138 214 Q100 226 62 214 Z" fill="url(#suitGradient)" />
        <path d="M84 118 L100 138 L116 118 L116 190 L84 190 Z" fill="url(#shirtGradient)" />
        <path d="M84 118 L100 138 L116 118 L112 200 L88 200 Z" fill="#111" opacity="0.85" />
        <path d="M96 132 L104 132 L108 172 L100 182 L92 172 Z" fill="#0a0a0a" />
        <circle cx="100" cy="140" r="2.5" fill="#4aa8ff" />
      </g>

      {/* Cabeça */}
      <g filter="url(#shadow3D)">
        <ellipse cx="100" cy="48" rx="40" ry="36" fill="url(#head3D)" />
        <rect x="70" y="30" width="60" height="36" rx="16" fill="#050505" stroke="#4aa8ff" strokeWidth="2" />
        <g filter="url(#glow3D)">
          <circle className="animate-eye-color" cx="86" cy="46" r="6" fill="#00ffff" />
          <circle className="animate-eye-color" cx="114" cy="46" r="6" fill="#00ffff" />
        </g>
        <circle cx="84" cy="44" r="1.8" fill="#ffffff" />
        <circle cx="112" cy="44" r="1.8" fill="#ffffff" />
        <path
          d="M88 56 Q100 64 112 56"
          stroke="#00ffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          filter="url(#glow3D)"
        />
      </g>

      {/* Braço esquerdo com bandeja */}
      <g filter="url(#shadow3D)">
        <path d="M62 140 Q40 150 36 168" stroke="url(#body3D)" strokeWidth="11" strokeLinecap="round" fill="none" />
        <ellipse cx="34" cy="170" rx="30" ry="7" fill="url(#trayGradient)" />
        <g>
          <rect x="18" y="150" width="10" height="18" rx="2" fill="url(#glassGradient)" stroke="#cfe9fa" strokeWidth="0.6" />
          <rect x="18" y="158" width="10" height="10" rx="2" fill="url(#waterGradient)" />
          <rect x="30" y="148" width="10" height="20" rx="2" fill="url(#glassGradient)" stroke="#cfe9fa" strokeWidth="0.6" />
          <rect x="30" y="157" width="10" height="11" rx="2" fill="url(#waterGradient)" />
          <rect x="42" y="151" width="10" height="17" rx="2" fill="url(#glassGradient)" stroke="#cfe9fa" strokeWidth="0.6" />
          <rect x="42" y="159" width="10" height="9" rx="2" fill="url(#waterGradient)" />
        </g>
      </g>

      {/* Braço direito com toalha */}
      <g filter="url(#shadow3D)">
        <path d="M138 140 Q160 152 162 174" stroke="url(#body3D)" strokeWidth="11" strokeLinecap="round" fill="none" />
        <rect x="150" y="150" width="22" height="34" rx="4" fill="#ffffff" opacity="0.92" />
        <rect x="150" y="160" width="22" height="4" fill="#d81b1b" opacity="0.8" />
      </g>
    </svg>
  );
}

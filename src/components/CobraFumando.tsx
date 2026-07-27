export function CobraFumando({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Insígnia da Cobra Fumando — Força Expedicionária Brasileira"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="32" cy="32" r="29" opacity="0.55" />
      <circle cx="32" cy="32" r="24" opacity="0.25" />
      <path d="M18 44c0-9 6-12 12-12s10-2 10-6-3-6-6-6-5 2-5 4" />
      <path d="M18 44c6 3 14 3 20 0" opacity="0.7" />
      <circle cx="39" cy="20" r="1.6" fill="currentColor" stroke="none" />
      <path d="M44 20h7" />
      <path d="M52 19c1.6-1.4 1.6-3.4 0-4.8" opacity="0.7" />
      <path d="M49 15c1.6-1.4 1.6-3.4 0-4.8" opacity="0.5" />
      <path d="M46 12c1.6-1.4 1.6-3.4 0-4.8" opacity="0.3" />
    </svg>
  );
}

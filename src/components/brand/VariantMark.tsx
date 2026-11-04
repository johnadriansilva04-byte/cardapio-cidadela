import { cn } from "@/lib/utils";

/**
 * Marca da Variant: um "V" que É o corpo de uma cobra fumando.
 *
 * A cobra fumando é o emblema da FEB — "é mais fácil uma cobra fumar do que o
 * Brasil ir à guerra". Quando foi, ela fumou. É a ideia de fazer o que diziam
 * ser impossível, que é exatamente a missão da Variant: reduzir a mortalidade
 * das pequenas empresas. O "V" é o corpo da cobra; a cabeça, o cachimbo e a
 * fumaça vivem na ponta direita.
 *
 * `plain` = só o V (navbar, tamanhos pequenos, onde o detalhe viraria borrão).
 * `full` = V + cabeça + cachimbo + fumaça animada (herói, painel "Quem faz").
 *
 * Tudo é desenhado dentro do quadrado e recortado por um `clipPath` com o mesmo
 * raio do tile, então nenhum traço vaza da marca em qualquer fundo.
 */
export function VariantMark({
  className,
  variant = "plain",
  label = "Variant",
}: {
  className?: string;
  variant?: "plain" | "full";
  label?: string;
}) {
  const uid = variant === "full" ? "vm-full" : "vm-plain";
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)}>
      <svg viewBox="0 0 48 48" className="size-full" role="img" aria-label={label}>
        <defs>
          <linearGradient id={`${uid}-grad`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="55%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <clipPath id={`${uid}-clip`}>
            <rect x="2" y="2" width="44" height="44" rx="14" />
          </clipPath>
        </defs>

        <rect x="2" y="2" width="44" height="44" rx="14" fill={`url(#${uid}-grad)`} />

        <g clipPath={`url(#${uid}-clip)`}>
          {/* Corpo da cobra: o "V". Traço grosso, pontas arredondadas. */}
          <path
            d="M13 12 L23.4 33.2 Q24 34.4 24.6 33.2 L35 12"
            fill="none"
            stroke="#05070c"
            strokeWidth="5.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {variant === "full" && (
            <g>
              {/* Cabeça na ponta direita do V. */}
              <ellipse
                cx="36.2"
                cy="10.4"
                rx="5"
                ry="3.8"
                transform="rotate(20 36.2 10.4)"
                fill="#05070c"
              />
              {/* Olho. */}
              <circle cx="35.6" cy="8.6" r="1.3" fill="#22d3ee" />
              {/* Língua bífida. */}
              <path
                d="M40.8 9.4 L43.6 8.7 M43.6 8.7 L45 7.6 M43.6 8.7 L45.1 9.9"
                fill="none"
                stroke="#05070c"
                strokeWidth="1.2"
                strokeLinecap="round"
              />

              {/* Cachimbo apoiado na boca. */}
              <path
                d="M38.6 13.6 L40.9 15.6"
                stroke="#05070c"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <ellipse cx="42.2" cy="16.8" rx="1.9" ry="1.6" fill="#05070c" />

              {/* Fumaça em volutas, subindo devagar. */}
              <g
                className="vm-smoke"
                fill="none"
                stroke="#bae6fd"
                strokeWidth="1.25"
                strokeLinecap="round"
              >
                <path d="M42 14.4 q2.2 -1.6 0.5 -3.1 q-1.6 -1.5 0.3 -2.9" />
                <path
                  d="M44 15.6 q2.3 -1.8 0.6 -3.3 q-1.5 -1.4 0.2 -2.6"
                  opacity="0.6"
                  style={{ animationDelay: "0.9s" }}
                />
              </g>
            </g>
          )}
        </g>
      </svg>
    </span>
  );
}

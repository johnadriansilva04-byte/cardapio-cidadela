import { useEffect, useRef } from "react";
import { Swords, BrainCircuit, FlaskConical, Bot, Target } from "lucide-react";
import { MapBuilding } from "./map/MapBuilding";

type ActiveModule =
  | "battle-arena"
  | "iq-test"
  | "robot-lab"
  | "chat-ai"
  | "dashboard"
  | "config"
  | "pedidos"
  | "trilha"
  | null;

export function TemporalLobby({ onNavigate }: { onNavigate: (module: ActiveModule) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // abre o mapa no marco zero: 1944, base da estrada, com a pista centralizada
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: (el.scrollWidth - el.clientWidth) / 2, top: el.scrollHeight });
  }, []);

  const handleModuleClick = (moduleId: ActiveModule) => {
    console.log("[TemporalLobby] Botão clicado:", moduleId);
    console.log("[TemporalLobby] onNavigate existe?", typeof onNavigate);
    onNavigate(moduleId);
    console.log("[TemporalLobby] onNavigate chamado");
  };

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[var(--future-deep)] font-body">
      {/* ---------------- MUNDO (rolável nos dois eixos) ---------------- */}
      <div ref={scrollRef} className="h-full w-full overflow-auto">
        <div
          className="era-panel scanlines relative"
          style={{
            width: "max(100%, 1800px)",
            height: "2800px",
            background:
              "linear-gradient(to top, var(--war-deep) 0%, var(--war) 16%, var(--modern-deep) 42%, var(--modern) 56%, var(--future) 80%, var(--future-deep) 100%)",
          }}
        >
          {/* grade isométrica do chão */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, oklch(1 0 0 / .5) 0 1px, transparent 1px 64px), repeating-linear-gradient(-45deg, oklch(1 0 0 / .5) 0 1px, transparent 1px 64px)",
            }}
          />
          {/* clima */}
          <div
            aria-hidden
            className="dust-veil era-panel pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
          />
          <div
            aria-hidden
            className="neon-veil era-panel pointer-events-none absolute inset-x-0 top-0 h-1/3"
          />

          {/* ---------------- ESTRADA CENTRAL (de baixo p/ cima) ---------------- */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2"
          >
            <div
              className="h-full w-[130px]"
              style={{
                background:
                  "linear-gradient(to top, oklch(0.42 0.05 80), var(--road) 45%, oklch(0.3 0.05 285) 78%, oklch(0.4 0.12 300))",
              }}
            />
            {/* acostamentos */}
            <div className="absolute inset-y-0 left-0 w-[3px] bg-foreground/10" />
            <div className="absolute inset-y-0 right-0 w-[3px] bg-foreground/10" />
            {/* faixa central tracejada (some no barro) */}
            <div
              className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 opacity-70"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, color-mix(in oklab, var(--war-dust) 30%, transparent) 0 46px, transparent 46px 96px)",
                maskImage: "linear-gradient(to top, transparent 0%, black 22%, black 100%)",
                animation: "dashUp 5s linear infinite",
              }}
            />
            {/* neon da pista futura */}
            <div
              className="absolute top-0 left-0 h-[22%] w-[3px]"
              style={{
                background: "color-mix(in oklab, var(--neon) 85%, transparent)",
                boxShadow: "var(--shadow-neon)",
                animation: "flicker 5s ease-in-out infinite",
              }}
            />
            <div
              className="absolute top-0 right-0 h-[22%] w-[3px]"
              style={{
                background: "color-mix(in oklab, var(--neon-2) 85%, transparent)",
                boxShadow: "var(--shadow-neon)",
                animation: "flicker 6s ease-in-out infinite",
              }}
            />
          </div>

          {/* ---------------- FAIXAS DE ERA (etiquetas laterais) ---------------- */}
          <EraTag top="88%" label="1944 · A Era da Guerra" cls="text-war-dust" />
          <EraTag top="52%" label="Hoje · A Modernidade" cls="text-modern-glow" />
          <EraTag top="14%" label="2100 · O Futuro" cls="text-neon" />

          {/* ---------------- CENÁRIO: GUERRA (base do mapa) ---------------- */}
          <Prop top="95%" left="calc(50% - 230px)">
            <DryTree className="h-14 text-war-dust/80" />
          </Prop>
          <Prop top="90%" left="calc(50% + 210px)">
            <DryTree className="h-10 text-war-dust/70" />
          </Prop>
          <Prop top="83%" left="calc(50% - 300px)">
            <DryTree className="h-12 text-war-dust/70" />
          </Prop>
          <Prop top="79%" left="calc(50% + 300px)">
            <Fence className="h-6 w-56 text-war-dust/70" />
          </Prop>
          <Prop top="93%" left="calc(50% - 420px)">
            <Fence className="h-6 w-64 text-war-dust/60" />
          </Prop>

          <MapBuilding
            title="A Arena"
            era="war"
            top="86%"
            left="calc(50% - 130px)"
            onClick={() => handleModuleClick("battle-arena")}
            icon={<Swords size={16} strokeWidth={1.75} />}
          />

          <MapBuilding
            title="A Trilha"
            era="war"
            top="82%"
            left="calc(50% + 130px)"
            onClick={() => handleModuleClick("trilha")}
            icon={<Target size={16} strokeWidth={1.75} />}
          />

          {/* ---------------- CENÁRIO: MODERNIDADE (meio) ---------------- */}
          <Prop top="58%" left="calc(50% - 290px)">
            <Favela className="h-20 w-56 text-modern-deep/85" />
          </Prop>
          <Prop top="47%" left="calc(50% + 300px)">
            <Skyline className="h-28 w-64 text-modern-deep/90" />
          </Prop>
          <Prop top="63%" left="calc(50% + 250px)">
            <Skyline className="h-20 w-48 text-modern-deep/70" />
          </Prop>

          <MapBuilding
            title="Testes de QI"
            era="modern"
            top="53%"
            left="calc(50% + 130px)"
            onClick={() => handleModuleClick("iq-test")}
            icon={<BrainCircuit size={16} strokeWidth={1.75} />}
          />

          {/* ---------------- CENÁRIO: FUTURO (topo) ---------------- */}
          <Prop top="20%" left="calc(50% - 320px)">
            <FutureCity className="h-32 w-72 text-future-deep" />
          </Prop>
          <Prop top="12%" left="calc(50% + 320px)">
            <FutureCity className="h-28 w-64 text-future-deep" />
          </Prop>

          <MapBuilding
            title="O Laboratório"
            era="future"
            top="26%"
            left="calc(50% - 135px)"
            onClick={() => handleModuleClick("robot-lab")}
            icon={<FlaskConical size={16} strokeWidth={1.75} />}
          />
          <MapBuilding
            title="Chat da IA"
            era="future"
            top="10%"
            left="calc(50% + 135px)"
            onClick={() => handleModuleClick("chat-ai")}
            icon={<Bot size={16} strokeWidth={1.75} />}
          />
        </div>
      </div>

      {/* ---------------- TÍTULO FLUTUANTE ---------------- */}
      <header className="pointer-events-none absolute top-4 left-1/2 z-30 -translate-x-1/2 text-center">
        <h1 className="font-display text-lg font-bold tracking-[0.25em] text-war-dust uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] sm:text-2xl">
          Cidadela Temporal
        </h1>
        <p className="mt-1 text-[0.65rem] tracking-[0.3em] text-war-dust/70 uppercase">
          Role o mapa · a estrada sobe de 1944 até 2100
        </p>
      </header>

      {/* ---------------- HUD INFERIOR ---------------- */}
      <nav className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 px-3">
        <ul className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-foreground/15 bg-[color-mix(in_oklab,var(--future-deep)_88%,black)]/90 p-2 shadow-lg backdrop-blur-md">
          {[
            {
              label: "Arena",
              module: "battle-arena" as ActiveModule,
              icon: Swords,
              cls: "text-war-dust border-war-dust/50",
            },
            {
              label: "Trilha",
              module: "trilha" as ActiveModule,
              icon: Target,
              cls: "text-war-dust border-war-dust/50",
            },
            {
              label: "Testes",
              module: "iq-test" as ActiveModule,
              icon: BrainCircuit,
              cls: "text-modern-glow border-modern-glow/50",
            },
            {
              label: "Laboratório",
              module: "robot-lab" as ActiveModule,
              icon: FlaskConical,
              cls: "text-neon border-neon/50",
            },
            {
              label: "Chat",
              module: "chat-ai" as ActiveModule,
              icon: Bot,
              cls: "text-neon border-neon/50",
            },
          ].map(({ label, module, icon: Icon, cls }) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => handleModuleClick(module)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[0.7rem] font-semibold tracking-[0.18em] uppercase transition-all duration-200 hover:-translate-y-0.5 hover:bg-foreground/5 ${cls}`}
              >
                <Icon size={15} strokeWidth={1.75} />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}

function EraTag({ top, label, cls }: { top: string; label: string; cls: string }) {
  return (
    <div style={{ top }} className={`absolute left-[calc(50%-560px)] z-10 -translate-y-1/2 ${cls}`}>
      <span className="font-display text-sm font-semibold tracking-[0.3em] uppercase opacity-80">
        {label}
      </span>
      <div className="mt-1 h-px w-40 bg-current opacity-25" />
    </div>
  );
}

function Prop({ top, left, children }: { top: string; left: string; children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      style={{ top, left }}
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
    >
      {children}
    </div>
  );
}

/* ---------- Silhuetas do cenário (SVG) ---------- */

function DryTree({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 100" className={className} fill="none">
      <path
        d="M20 100V38M20 52 6 34M20 60l14-18M20 40 12 22M20 44l10-16M20 30l-5-12M20 32l6-14"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Fence({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 40" preserveAspectRatio="none" className={className}>
      <g stroke="currentColor" strokeWidth="3">
        {Array.from({ length: 21 }).map((_, i) => (
          <line key={i} x1={i * 20 + 4} y1={40} x2={i * 20 + 4} y2={10} />
        ))}
        <line x1={0} y1={18} x2={400} y2={18} />
        <line x1={0} y1={30} x2={400} y2={30} />
      </g>
    </svg>
  );
}

function Favela({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 110" preserveAspectRatio="none" className={className}>
      <g fill="currentColor">
        <rect x="0" y="60" width="46" height="50" />
        <rect x="34" y="42" width="40" height="68" />
        <rect x="70" y="72" width="36" height="38" />
        <rect x="100" y="50" width="44" height="60" />
        <rect x="138" y="78" width="34" height="32" />
        <rect x="166" y="58" width="54" height="52" />
      </g>
      <g fill="color-mix(in oklab, var(--modern-glow) 75%, transparent)">
        {[
          [10, 70],
          [44, 54],
          [80, 84],
          [112, 62],
          [148, 88],
          [178, 70],
          [200, 88],
        ].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="7" height="9" />
        ))}
      </g>
    </svg>
  );
}

function Skyline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 160" preserveAspectRatio="none" className={className}>
      <g fill="currentColor">
        <rect x="0" y="60" width="42" height="100" />
        <rect x="48" y="20" width="46" height="140" />
        <rect x="100" y="76" width="38" height="84" />
        <rect x="144" y="40" width="44" height="120" />
        <rect x="194" y="88" width="46" height="72" />
      </g>
      <g fill="color-mix(in oklab, var(--modern-glow) 60%, transparent)">
        {Array.from({ length: 40 }).map((_, i) => (
          <rect
            key={i}
            x={8 + (i % 8) * 29}
            y={40 + Math.floor(i / 8) * 24}
            width="6"
            height="10"
            opacity={i % 3 === 0 ? 0.35 : 0.85}
          />
        ))}
      </g>
    </svg>
  );
}

function FutureCity({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 180" preserveAspectRatio="none" className={className}>
      <g fill="currentColor">
        <path d="M6 180V70l24-16 24 16v110z" />
        <path d="M66 180V34l20-14 20 14v146z" />
        <rect x="118" y="86" width="42" height="94" rx="6" />
        <path d="M176 180V56l26-18 26 18v124z" />
        <rect x="234" y="104" width="26" height="76" rx="5" />
      </g>
      <g
        stroke="color-mix(in oklab, var(--neon) 85%, transparent)"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ animation: "pulseGlow 4s ease-in-out infinite" }}
      >
        <line x1="10" y1="86" x2={50} y2={86} />
        <line x1="70" y1="52" x2={102} y2={52} />
        <line x1="122" y1="100" x2={156} y2={100} />
        <line x1="180" y1="74" x2={224} y2={74} />
        <line x1="238" y1="118" x2={256} y2={118} />
      </g>
      <g stroke="color-mix(in oklab, var(--neon-2) 80%, transparent)" strokeWidth="2">
        <line x1={0} y1={30} x2={120} y2={14} />
        <line x1={140} y1={10} x2={260} y2={28} />
      </g>
    </svg>
  );
}

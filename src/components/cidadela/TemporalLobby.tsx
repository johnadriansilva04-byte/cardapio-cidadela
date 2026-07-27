import { useState } from "react";
import {
  Compass,
  Coins,
  Hourglass,
  BarChart3,
  Brain,
  ArrowLeft,
  ArrowRight,
  Home,
  User,
  Trophy,
  MessageSquare,
  Settings,
  Waves,
} from "lucide-react";

import { useStore } from "@/modules/cidadela-core/store";
import { BattleArena } from "./BattleArena";
import { IQTest } from "./IQTest";
import { RobotLab } from "./RobotLab";
import { PracinhaIA } from "./Praxinha";
import { CidadelaDashboard } from "./Dashboard";
import { ConfigOperacional } from "./Config";
import { GerenciadorPedidos } from "./Pedidos";

type TemporalLayer = "1940s" | "2020s" | "2077+";
type ActiveModule =
  "battle-arena" | "iq-test" | "robot-lab" | "chat-ai" | "dashboard" | "config" | "pedidos" | null;

const MODULES = {
  "1940s": [{ id: "battle-arena", name: "ARENA DE BATALHA", component: BattleArena }],
  "2020s": [
    { id: "iq-test", name: "TESTE DE QI", component: IQTest },
    { id: "chat-ai", name: "CHAT I.A.", component: PracinhaIA },
  ],
  "2077+": [
    { id: "robot-lab", name: "LABORATÓRIO", component: RobotLab },
    { id: "chat-hub-ai", name: "CHAT HUB I.A.", component: PracinhaIA },
  ],
};

const MENU_ITEMS = [
  { id: "home", label: "PÁGINA INICIAL", icon: Home },
  { id: "profile", label: "MEU PERFIL", icon: User },
  { id: "rankings", label: "RANKINGS", icon: Trophy },
  { id: "messages", label: "MENSAGENS", icon: MessageSquare },
  { id: "settings", label: "CONFIGURAÇÕES", icon: Settings },
];

const STATUS_ITEMS = [
  { id: "resources", label: "RECURSOS", icon: Coins },
  { id: "time", label: "TEMPO GASTO", icon: Hourglass },
  { id: "stats", label: "ESTATÍSTICAS", icon: BarChart3 },
  { id: "ai-progress", label: "PROGRESSO DE I.A.", icon: Brain },
];

export function TemporalLobby({ onNavigate }: { onNavigate: (module: ActiveModule) => void }) {
  const { state } = useStore();
  const [activeLayer, setActiveLayer] = useState<TemporalLayer>("2020s");
  const [activeModule, setActiveModule] = useState<ActiveModule>(null);

  const handleModuleClick = (moduleId: string) => {
    setActiveModule(moduleId as ActiveModule);
    onNavigate(moduleId as ActiveModule);
  };

  const handleLayerChange = (direction: "up" | "down") => {
    const layers: TemporalLayer[] = ["1940s", "2020s", "2077+"];
    const currentIndex = layers.indexOf(activeLayer);
    const newIndex =
      direction === "up"
        ? Math.min(currentIndex + 1, layers.length - 1)
        : Math.max(currentIndex - 1, 0);
    setActiveLayer(layers[newIndex]);
  };

  if (activeModule) {
    const module = [...MODULES["1940s"], ...MODULES["2020s"], ...MODULES["2077+"]].find(
      (m) => m.id === activeModule,
    );
    if (module) {
      const ModuleComponent = module.component;
      return (
        <div className="h-full">
          <button
            type="button"
            onClick={() => setActiveModule(null)}
            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Voltar ao Lobby
          </button>
          <ModuleComponent />
        </div>
      );
    }
  }

  return (
    <div className="relative h-full overflow-hidden bg-black">
      {/* SVG Perspective Scene */}
      <svg
        viewBox="0 0 1200 800"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* 1940s Gradient - Afternoon Sun */}
          <linearGradient id="sky1940s" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff9800" />
            <stop offset="50%" stopColor="#ffcc80" />
            <stop offset="100%" stopColor="#8d6e63" />
          </linearGradient>

          {/* 2020s Gradient - Daylight */}
          <linearGradient id="sky2020s" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#87ceeb" />
            <stop offset="50%" stopColor="#b0e0e6" />
            <stop offset="100%" stopColor="#e0e0e0" />
          </linearGradient>

          {/* 2077+ Gradient - Night Neon */}
          <linearGradient id="sky2077" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0a0a1a" />
            <stop offset="50%" stopColor="#1a1a3a" />
            <stop offset="100%" stopColor="#2a0a3a" />
          </linearGradient>

          {/* Road Gradient */}
          <linearGradient id="roadGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5d4037" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#424242" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#212121" stopOpacity="0.9" />
          </linearGradient>

          {/* Neon Glow */}
          <filter id="neonGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background Layers */}
        {/* 2077+ Layer - Top */}
        <rect x="0" y="0" width="1200" height="266" fill="url(#sky2077)" />

        {/* 2020s Layer - Middle */}
        <rect x="0" y="266" width="1200" height="266" fill="url(#sky2020s)" />

        {/* 1940s Layer - Bottom */}
        <rect x="0" y="532" width="1200" height="268" fill="url(#sky1940s)" />

        {/* Central Road - Perspective */}
        <path d="M600 800 L400 400 L800 400 L600 800" fill="url(#roadGradient)" opacity="0.8" />

        {/* Road Lines */}
        <line
          x1="600"
          y1="800"
          x2="600"
          y2="400"
          stroke="#ffeb3b"
          strokeWidth="2"
          strokeDasharray="20,10"
        />

        {/* 1940s - Military Camp */}
        <g className="cursor-pointer" onClick={() => handleModuleClick("battle-arena")}>
          {/* Tent */}
          <path
            d="M200 600 L250 550 L300 600 L300 650 L200 650 Z"
            fill="#8b4513"
            stroke="#5d4037"
            strokeWidth="2"
          />
          <path d="M250 550 L250 500" stroke="#5d4037" strokeWidth="3" />
          <circle cx="250" cy="495" r="5" fill="#ff9800" />

          {/* Wooden Sign */}
          <rect
            x="220"
            y="580"
            width="60"
            height="30"
            fill="#deb887"
            stroke="#8b4513"
            strokeWidth="2"
          />
          <text x="250" y="595" textAnchor="middle" fontSize="8" fill="#3e2723" fontWeight="bold">
            ARENA
          </text>
          <text x="250" y="605" textAnchor="middle" fontSize="6" fill="#3e2723">
            DE BATALHA
          </text>

          {/* Crossed Swords Emblem */}
          <line x1="245" y1="570" x2="255" y2="580" stroke="#ffd700" strokeWidth="2" />
          <line x1="255" y1="570" x2="245" y2="580" stroke="#ffd700" strokeWidth="2" />

          {/* Amber Glow */}
          <ellipse
            cx="250"
            cy="600"
            rx="50"
            ry="30"
            fill="#ff9800"
            opacity="0.2"
            filter="url(#neonGlow)"
          />
        </g>

        {/* 2020s - Modern Buildings */}
        <g className="cursor-pointer" onClick={() => handleModuleClick("iq-test")}>
          {/* Glass Building */}
          <rect
            x="150"
            y="300"
            width="80"
            height="150"
            fill="#87ceeb"
            stroke="#4682b4"
            strokeWidth="2"
            opacity="0.8"
          />
          <rect x="155" y="305" width="70" height="140" fill="#add8e6" opacity="0.5" />

          {/* LED Panel */}
          <rect
            x="160"
            y="320"
            width="60"
            height="40"
            fill="#000080"
            stroke="#00ffff"
            strokeWidth="1"
          />
          <text x="190" y="335" textAnchor="middle" fontSize="10" fill="#00ffff">
            🧠⚙️
          </text>
          <text x="190" y="350" textAnchor="middle" fontSize="6" fill="#ffffff">
            TESTE DE QI
          </text>
        </g>

        <g className="cursor-pointer" onClick={() => handleModuleClick("chat-ai")}>
          {/* Kiosk */}
          <rect
            x="950"
            y="380"
            width="50"
            height="70"
            fill="#e0e0e0"
            stroke="#9e9e9e"
            strokeWidth="2"
          />
          <rect x="955" y="385" width="40" height="30" fill="#00ffff" opacity="0.8" />

          {/* Hologram */}
          <ellipse
            cx="975"
            cy="420"
            rx="25"
            ry="15"
            fill="#00ffff"
            opacity="0.3"
            filter="url(#neonGlow)"
          />
          <text x="975" y="422" textAnchor="middle" fontSize="6" fill="#ffffff">
            💬...
          </text>
          <text x="975" y="435" textAnchor="middle" fontSize="5" fill="#00ffff">
            CHAT I.A.
          </text>
        </g>

        {/* 2077+ - Futuristic Buildings */}
        <g className="cursor-pointer" onClick={() => handleModuleClick("robot-lab")}>
          {/* Hexagonal Complex */}
          <polygon
            points="300,200 350,170 400,200 400,260 350,290 300,260"
            fill="#1a237e"
            stroke="#00ffff"
            strokeWidth="2"
            opacity="0.9"
          />
          <polygon
            points="320,210 350,190 380,210 380,250 350,270 320,250"
            fill="#283593"
            opacity="0.7"
          />

          {/* Floating Neon Hexagon */}
          <polygon
            points="350,150 370,140 390,150 390,170 370,180 350,170"
            fill="none"
            stroke="#00ffff"
            strokeWidth="2"
            filter="url(#neonGlow)"
          />
          <text x="370" y="165" textAnchor="middle" fontSize="6" fill="#00ffff">
            ⚛️
          </text>
          <text x="370" y="175" textAnchor="middle" fontSize="5" fill="#ffffff">
            LABORATÓRIO
          </text>
        </g>

        <g className="cursor-pointer" onClick={() => handleModuleClick("chat-hub-ai")}>
          {/* Megatower */}
          <rect
            x="850"
            y="100"
            width=" 60"
            height="200"
            fill="#4a148c"
            stroke="#ff00ff"
            strokeWidth="2"
          />
          <rect x="855" y="105" width="50" height="190" fill="#7b1fa2" opacity="0.6" />

          {/* Data Core */}
          <circle cx="880" cy="150" r="15" fill="#ff00ff" opacity="0.5" filter="url(#neonGlow)" />
          <text x="880" y="153" textAnchor="middle" fontSize="8" fill="#ffffff">
            🤖
          </text>
          <text x="880" y="180" textAnchor="middle" fontSize="5" fill="#ff00ff">
            CHAT HUB I.A.
          </text>
        </g>

        {/* Flying Cars (2077+) */}
        <rect x="700" y="120" width="20" height="8" fill="#ff00ff" opacity="0.8">
          <animate attributeName="x" values="700;900;700" dur="5s" repeatCount="indefinite" />
        </rect>
        <rect x="400" y="180" width="15" height="6" fill="#00ffff" opacity="0.8">
          <animate attributeName="x" values="400;600;400" dur="4s" repeatCount="indefinite" />
        </rect>

        {/* Trees (1940s) */}
        <polygon points="100,700 110,650 120,700" fill="#2e7d32" />
        <polygon points="105,680 115,640 125,680" fill="#388e3c" />
        <rect x="112" y="700" width="6" height="20" fill="#5d4037" />

        <polygon points="1050,700 1060,640 1070,700" fill="#2e7d32" />
        <polygon points="1055,680 1065,630 1075,680" fill="#388e3c" />
        <rect x="1062" y="700" width="6" height="20" fill="#5d4037" />
      </svg>

      {/* Left Menu Bar */}
      <div className="absolute left-0 top-0 bottom-0 w-16 border-r border-cyan-500/20 bg-black/40 backdrop-blur-sm flex flex-col items-center py-4 gap-4 z-20">
        <div className="mb-4">
          <Waves className="size-6 text-cyan-400" />
        </div>
        {MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="p-2 text-muted-foreground hover:text-cyan-400 transition-colors"
            title={item.label}
          >
            <item.icon className="size-5" />
          </button>
        ))}
      </div>

      {/* Right Status Bar */}
      <div className="absolute right-0 top-0 bottom-0 w-16 border-l border-cyan-500/20 bg-black/40 backdrop-blur-sm flex flex-col items-center py-4 gap-4 z-20">
        <div className="mb-4">
          <Compass className="size-6 text-yellow-500" />
        </div>
        {STATUS_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="p-2 text-muted-foreground hover:text-cyan-400 transition-colors"
            title={item.label}
          >
            <item.icon className="size-5" />
          </button>
        ))}
      </div>

      {/* Bottom Temporal Control Bar */}
      <div className="absolute bottom-0 left-16 right-16 h-16 border-t border-cyan-500/20 bg-black/60 backdrop-blur-sm flex items-center justify-center gap-4 z-20">
        <button
          type="button"
          onClick={() => handleLayerChange("down")}
          className="p-2 text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex items-center gap-2 px-4">
          <span
            className={`text-xs font-mono transition-colors ${
              activeLayer === "1940s" ? "text-amber-400" : "text-muted-foreground"
            }`}
          >
            1940s
          </span>
          <div className="w-8 h-0.5 bg-gradient-to-r from-amber-500 via-blue-500 to-cyan-500" />
          <span
            className={`text-xs font-mono transition-colors ${
              activeLayer === "2020s" ? "text-blue-400" : "text-muted-foreground"
            }`}
          >
            2020s
          </span>
          <div className="w-8 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500" />
          <span
            className={`text-xs font-mono transition-colors ${
              activeLayer === "2077+" ? "text-cyan-400" : "text-muted-foreground"
            }`}
          >
            2077+
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleLayerChange("up")}
          className="p-2 text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowRight className="size-5" />
        </button>
        <button
          type="button"
          className="ml-4 px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition-colors"
        >
          VIAGEM
        </button>
      </div>
    </div>
  );
}

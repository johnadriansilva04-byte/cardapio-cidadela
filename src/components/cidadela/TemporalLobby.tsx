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
  "2077+": [{ id: "robot-lab", name: "LABORATÓRIO", component: RobotLab }],
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
    <div className="relative h-screen overflow-hidden bg-black">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a] via-[#1a1a3a] to-[#2a0a3a]" />

      {/* Map Container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full">
          {/* Central Road - Vertical with 3D effect and perspective */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-32">
            {/* 1940s - Dirt Road (Bottom) */}
            <div
              className="absolute bottom-0 w-full h-1/3 bg-gradient-to-r from-[#5d4037] via-[#6d5047] to-[#5d4037] shadow-2xl"
              style={{ clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)" }}
            />

            {/* 2020s - Asphalt (Middle) */}
            <div
              className="absolute bottom-1/3 w-full h-1/3 bg-gradient-to-r from-[#424242] via-[#505050] to-[#424242] shadow-2xl"
              style={{ clipPath: "polygon(25% 0%, 75% 0%, 85% 100%, 15% 100%)" }}
            />

            {/* 2077+ - Futuristic (Top) */}
            <div
              className="absolute top-0 w-full h-1/3 bg-gradient-to-r from-cyan-900 via-purple-900 to-cyan-900 shadow-2xl shadow-cyan-500/30"
              style={{ clipPath: "polygon(35% 0%, 65% 0%, 75% 100%, 25% 100%)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-magenta-500/20 animate-pulse" />
            </div>
          </div>

          {/* Road Center Line */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-2 bg-gradient-to-b from-yellow-400/40 via-yellow-400/30 to-cyan-400/40 shadow-lg"
            style={{ clipPath: "polygon(40% 0%, 60% 0%, 50% 100%, 50% 100%)" }}
          />

          {/* Road Edges */}
          <div
            className="absolute left-[calc(50%-64px)] top-0 bottom-0 w-1 bg-gradient-to-b from-amber-600/50 via-gray-500/50 to-cyan-500/50"
            style={{ clipPath: "polygon(20% 0%, 80% 0%, 90% 100%, 10% 100%)" }}
          />
          <div
            className="absolute left-[calc(50%+64px)] top-0 bottom-0 w-1 bg-gradient-to-b from-amber-600/50 via-gray-500/50 to-cyan-500/50"
            style={{ clipPath: "polygon(20% 0%, 80% 0%, 90% 100%, 10% 100%)" }}
          />

          {/* 1940s Village - Left Side */}
          <div className="absolute bottom-[10%] left-[20%]">
            <button
              type="button"
              onClick={() => handleModuleClick("battle-arena")}
              className="relative w-20 h-16 bg-gradient-to-b from-amber-700 to-amber-900 border-2 border-amber-600 rounded-t-lg hover:from-amber-600 hover:to-amber-800 transition-all cursor-pointer flex items-center justify-center shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105"
            >
              <span className="text-amber-400 text-2xl drop-shadow-lg">⚔️</span>
              <div className="absolute -bottom-2 left-0 right-0 h-2 bg-black/30 rounded-b blur-sm" />
            </button>
            <div className="text-amber-400 text-xs mt-2 text-center font-bold drop-shadow-md">
              ARENA
            </div>
          </div>

          {/* 1940s Trees with shadows */}
          <div className="absolute bottom-[15%] left-[8%] relative">
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/40 rounded-full blur-sm" />
            <div className="text-4xl drop-shadow-lg">🌲</div>
          </div>
          <div className="absolute bottom-[5%] left-[12%] relative">
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/40 rounded-full blur-sm" />
            <div className="text-3xl drop-shadow-lg">🌲</div>
          </div>

          {/* 2020s Village - Left Side */}
          <div className="absolute bottom-[40%] left-[15%]">
            <button
              type="button"
              onClick={() => handleModuleClick("iq-test")}
              className="relative w-16 h-20 bg-gradient-to-b from-blue-700 to-blue-900 border-2 border-blue-500 rounded hover:from-blue-600 hover:to-blue-800 transition-all cursor-pointer flex items-center justify-center shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105"
            >
              <span className="text-cyan-400 text-2xl drop-shadow-lg">🧠</span>
              <div className="absolute -bottom-2 left-0 right-0 h-2 bg-black/30 rounded-b blur-sm" />
            </button>
            <div className="text-blue-400 text-xs mt-2 text-center font-bold drop-shadow-md">
              QI
            </div>
          </div>

          {/* 2020s Village - Right Side */}
          <div className="absolute bottom-[40%] right-[15%]">
            <button
              type="button"
              onClick={() => handleModuleClick("chat-ai")}
              className="relative w-16 h-16 bg-gradient-to-b from-blue-700 to-blue-900 border-2 border-blue-500 rounded hover:from-blue-600 hover:to-blue-800 transition-all cursor-pointer flex items-center justify-center shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105"
            >
              <span className="text-cyan-400 text-2xl drop-shadow-lg">💬</span>
              <div className="absolute -bottom-2 left-0 right-0 h-2 bg-black/30 rounded-b blur-sm" />
            </button>
            <div className="text-blue-400 text-xs mt-2 text-center font-bold drop-shadow-md">
              CHAT
            </div>
          </div>

          {/* 2020s Favela with depth */}
          <div className="absolute bottom-[35%] left-[5%] grid grid-cols-3 gap-2">
            <div className="relative w-4 h-10 bg-gradient-to-t from-orange-600 to-orange-400 rounded-t shadow-lg">
              <div className="absolute -bottom-1 left-0 right-0 h-1 bg-black/30 rounded-b blur-sm" />
            </div>
            <div className="relative w-4 h-12 bg-gradient-to-t from-yellow-600 to-yellow-400 rounded-t shadow-lg">
              <div className="absolute -bottom-1 left-0 right-0 h-1 bg-black/30 rounded-b blur-sm" />
            </div>
            <div className="relative w-4 h-8 bg-gradient-to-t from-pink-600 to-pink-400 rounded-t shadow-lg">
              <div className="absolute -bottom-1 left-0 right-0 h-1 bg-black/30 rounded-b blur-sm" />
            </div>
          </div>

          {/* 2077+ Village - Center */}
          <div className="absolute top-[15%] left-1/2 -translate-x-1/2">
            <button
              type="button"
              onClick={() => handleModuleClick("robot-lab")}
              className="relative w-24 h-16 bg-gradient-to-b from-purple-700 to-purple-900 border-2 border-cyan-400 rounded hover:from-purple-600 hover:to-purple-800 transition-all cursor-pointer flex items-center justify-center shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105"
            >
              <span className="text-cyan-400 text-3xl drop-shadow-lg animate-pulse">⚛️</span>
              <div className="absolute -bottom-2 left-0 right-0 h-2 bg-black/30 rounded-b blur-sm" />
            </button>
            <div className="text-cyan-400 text-xs mt-2 text-center font-bold drop-shadow-md">
              LAB
            </div>
          </div>

          {/* Era Labels with glow */}
          <div className="absolute bottom-[5%] left-[55%] text-amber-400 text-sm font-mono font-bold drop-shadow-lg">
            1940s
          </div>
          <div className="absolute bottom-[35%] left-[55%] text-blue-400 text-sm font-mono font-bold drop-shadow-lg">
            2020s
          </div>
          <div className="absolute top-[10%] left-[55%] text-cyan-400 text-sm font-mono font-bold drop-shadow-lg animate-pulse">
            2077+
          </div>
        </div>
      </div>

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

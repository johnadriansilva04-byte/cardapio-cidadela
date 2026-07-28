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
          {/* Central Road - Vertical */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-24">
            {/* 1940s - Dirt Road (Bottom) */}
            <div className="absolute bottom-0 w-full h-1/3 bg-[#5d4037]" />

            {/* 2020s - Asphalt (Middle) */}
            <div className="absolute bottom-1/3 w-full h-1/3 bg-[#424242]" />

            {/* 2077+ - Futuristic (Top) */}
            <div className="absolute top-0 w-full h-1/3 bg-gradient-to-r from-cyan-900 to-purple-900" />
          </div>

          {/* Road Center Line */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 bg-yellow-400/30" />

          {/* 1940s Village - Left Side */}
          <div className="absolute bottom-[10%] left-[20%]">
            <button
              type="button"
              onClick={() => handleModuleClick("battle-arena")}
              className="w-16 h-12 bg-amber-800 border-2 border-amber-600 rounded-t-lg hover:bg-amber-700 transition-colors cursor-pointer flex items-center justify-center"
            >
              <span className="text-amber-400 text-xl">⚔️</span>
            </button>
            <div className="text-amber-400 text-xs mt-1 text-center">ARENA</div>
          </div>

          {/* 1940s Trees */}
          <div className="absolute bottom-[15%] left-[10%] text-green-700 text-2xl">🌲</div>
          <div className="absolute bottom-[5%] left-[12%] text-green-700 text-xl">🌲</div>

          {/* 2020s Village - Left Side */}
          <div className="absolute bottom-[40%] left-[15%]">
            <button
              type="button"
              onClick={() => handleModuleClick("iq-test")}
              className="w-14 h-16 bg-blue-800 border-2 border-blue-500 rounded hover:bg-blue-700 transition-colors cursor-pointer flex items-center justify-center"
            >
              <span className="text-cyan-400 text-xl">🧠</span>
            </button>
            <div className="text-blue-400 text-xs mt-1 text-center">QI</div>
          </div>

          {/* 2020s Village - Right Side */}
          <div className="absolute bottom-[40%] right-[15%]">
            <button
              type="button"
              onClick={() => handleModuleClick("chat-ai")}
              className="w-14 h-14 bg-blue-800 border-2 border-blue-500 rounded hover:bg-blue-700 transition-colors cursor-pointer flex items-center justify-center"
            >
              <span className="text-cyan-400 text-xl">💬</span>
            </button>
            <div className="text-blue-400 text-xs mt-1 text-center">CHAT</div>
          </div>

          {/* 2020s Favela */}
          <div className="absolute bottom-[35%] left-[5%] grid grid-cols-3 gap-1">
            <div className="w-3 h-8 bg-orange-500 rounded-t" />
            <div className="w-3 h-10 bg-yellow-500 rounded-t" />
            <div className="w-3 h-6 bg-pink-500 rounded-t" />
          </div>

          {/* 2077+ Village - Center */}
          <div className="absolute top-[15%] left-1/2 -translate-x-1/2">
            <button
              type="button"
              onClick={() => handleModuleClick("robot-lab")}
              className="w-20 h-14 bg-purple-900 border-2 border-cyan-400 rounded hover:bg-purple-800 transition-colors cursor-pointer flex items-center justify-center"
            >
              <span className="text-cyan-400 text-2xl animate-pulse">⚛️</span>
            </button>
            <div className="text-cyan-400 text-xs mt-1 text-center">LAB</div>
          </div>

          {/* Era Labels */}
          <div className="absolute bottom-[5%] left-[55%] text-amber-400 text-sm font-mono">
            1940s
          </div>
          <div className="absolute bottom-[35%] left-[55%] text-blue-400 text-sm font-mono">
            2020s
          </div>
          <div className="absolute top-[10%] left-[55%] text-cyan-400 text-sm font-mono">2077+</div>
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

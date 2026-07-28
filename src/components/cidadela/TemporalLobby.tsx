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
      {/* Sky Gradient - 1940s afternoon to 2077+ night */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#8d6e63] via-[#87ceeb] to-[#0a0a1a]" />

      {/* Perspective Road Container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full">
          {/* Road - Single perspective path connecting all eras */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[300px] border-r-[300px] border-b-[800px] border-l-transparent border-r-transparent border-b-[#424242] opacity-90" />

          {/* Road center line */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-[800px] bg-gradient-to-b from-yellow-400/50 via-yellow-400/30 to-transparent" />

          {/* 1940s - Dirt Road Section (Front) */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-gradient-to-t from-[#5d4037] to-[#8d6e63] opacity-60"
            style={{ clipPath: "polygon(10% 100%, 90% 100%, 80% 0%, 20% 0%)" }}
          />

          {/* 2020s - Asphalt Section (Middle) */}
          <div
            className="absolute bottom-[200px] left-1/2 -translate-x-1/2 w-[350px] h-[200px] bg-gradient-to-t from-[#424242] to-[#616161] opacity-70"
            style={{ clipPath: "polygon(15% 100%, 85% 100%, 80% 0%, 20% 0%)" }}
          />

          {/* 2077+ - Futuristic Section (Back) */}
          <div
            className="absolute bottom-[350px] left-1/2 -translate-x-1/2 w-[200px] h-[150px] bg-gradient-to-t from-[#1a1a3a] to-[#0a0a1a] opacity-80"
            style={{ clipPath: "polygon(20% 100%, 80% 100%, 75% 0%, 25% 0%)" }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 via-magenta-500/30 to-cyan-500/30" />
          </div>

          {/* 1940s - Military Camp (Front, Large) */}
          <button
            type="button"
            onClick={() => handleModuleClick("battle-arena")}
            className="absolute bottom-[30px] left-[10%] w-[180px] h-[140px] bg-amber-900/90 border-2 border-amber-600 rounded-t-lg flex flex-col items-center justify-center gap-2 shadow-lg shadow-amber-500/50 hover:shadow-amber-500/70 transition-all hover:scale-110 cursor-pointer z-10"
          >
            <div className="text-5xl">⚔️</div>
            <div className="text-center">
              <p className="text-sm font-bold text-amber-200">ARENA DE BATALHA</p>
              <div className="mt-2 flex justify-center gap-2">
                <span className="text-amber-400 text-xl">⚔️</span>
                <span className="text-amber-400 text-xl">⚔️</span>
              </div>
            </div>
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-amber-500 text-2xl animate-pulse">
              🔥
            </div>
          </button>

          {/* 1940s Trees */}
          <div className="absolute bottom-[30px] left-[2%] text-green-800 text-5xl z-10">🌲</div>
          <div className="absolute bottom-[30px] right-[2%] text-green-800 text-5xl z-10">🌲</div>

          {/* 2020s - Favela (Left Side) */}
          <div className="absolute bottom-[220px] left-[5%] flex gap-1 z-10">
            <div className="w-6 h-12 bg-gradient-to-t from-orange-400 to-red-500 rounded-t" />
            <div className="w-6 h-16 bg-gradient-to-t from-yellow-400 to-orange-500 rounded-t" />
            <div className="w-6 h-10 bg-gradient-to-t from-pink-400 to-purple-500 rounded-t" />
            <div className="w-6 h-14 bg-gradient-to-t from-blue-400 to-cyan-500 rounded-t" />
          </div>

          {/* 2020s - Modern Buildings (Right Side) */}
          <button
            type="button"
            onClick={() => handleModuleClick("iq-test")}
            className="absolute bottom-[230px] right-[10%] w-[100px] h-[150px] bg-blue-900/90 border-2 border-blue-500 rounded-lg flex flex-col items-center justify-center gap-2 shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 transition-all hover:scale-110 cursor-pointer z-10"
          >
            <div className="text-3xl">🧠</div>
            <p className="text-xs font-bold text-blue-200">TESTE DE QI</p>
            <div className="text-blue-400 text-xl">⚙️</div>
          </button>

          <button
            type="button"
            onClick={() => handleModuleClick("chat-ai")}
            className="absolute bottom-[230px] right-[25%] w-[80px] h-[110px] bg-blue-900/90 border-2 border-blue-500 rounded-lg flex flex-col items-center justify-center gap-2 shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 transition-all hover:scale-110 cursor-pointer z-10"
          >
            <div className="text-2xl">💬</div>
            <p className="text-xs font-bold text-blue-200">CHAT I.A.</p>
            <div className="text-blue-400 text-lg animate-pulse">...</div>
          </button>

          {/* 2077+ - Futuristic City (Back, Small) */}
          <button
            type="button"
            onClick={() => handleModuleClick("robot-lab")}
            className="absolute bottom-[400px] left-1/2 -translate-x-1/2 w-[80px] h-[100px] bg-purple-900/90 border-2 border-cyan-400 rounded-lg flex flex-col items-center justify-center gap-2 shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70 transition-all hover:scale-110 cursor-pointer z-10"
          >
            <div className="text-3xl">⚛️</div>
            <p className="text-xs font-bold text-cyan-200">LABORATÓRIO</p>
            <div className="text-cyan-400 text-xl animate-pulse">⚛️</div>
          </button>

          {/* 2077+ Flying Cars */}
          <div className="absolute bottom-[450px] left-[48%] text-magenta-400 text-xl animate-bounce z-10">
            🚗
          </div>
          <div className="absolute bottom-[480px] left-[52%] text-cyan-400 text-lg animate-pulse z-10">
            🚀
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

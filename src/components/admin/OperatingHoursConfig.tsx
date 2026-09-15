import { useMemo, useState } from "react";
import { Clock, Copy, Check, Power, Zap, Calendar, Sun, Moon, ChevronDown, ChevronUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  DAY_ORDER,
  DAY_LABEL,
  type DayKey,
  type OperatingHours,
  formatRange,
} from "@/lib/operatingHours";

function padTime(v: string): string {
  if (!v) return "17:00";
  if (/^\d{1,2}:\d{2}$/.test(v)) return v.padStart(5, "0");
  return "17:00";
}

export default function OperatingHoursConfig({
  value,
  onChange,
}: {
  value: OperatingHours;
  onChange: (next: OperatingHours) => void;
}) {
  const [bulkOpen, setBulkOpen] = useState("17:00");
  const [bulkClose, setBulkClose] = useState("00:00");
  const [copied, setCopied] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const allEqual = useMemo(() => {
    const first = value[DAY_ORDER[0]];
    return DAY_ORDER.every(
      (k) => value[k].closed === first.closed && value[k].open === first.open && value[k].close === first.close,
    );
  }, [value]);

  function applyToAll() {
    const o = padTime(bulkOpen);
    const c = padTime(bulkClose);
    const next: OperatingHours = { ...value };
    for (const k of DAY_ORDER) {
      next[k] = { closed: false, open: o, close: c };
    }
    onChange(next);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function setDayClosed(key: DayKey, closed: boolean) {
    onChange({ ...value, [key]: { ...value[key], closed } });
  }

  function setDayTime(key: DayKey, patch: Partial<{ open: string; close: string }>) {
    onChange({ ...value, [key]: { ...value[key], ...patch } });
  }

  function toggleDayExpanded(key: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20">
            <Clock className="size-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Horário de funcionamento</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Configure os horários de atendimento
            </p>
          </div>
        </div>
        {allEqual && value[DAY_ORDER[0]] && !value[DAY_ORDER[0]].closed && (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
            <Calendar className="size-3 text-emerald-400" />
            <span className="text-[10px] font-semibold text-emerald-300">
              {formatRange(value[DAY_ORDER[0]])} todos os dias
            </span>
          </div>
        )}
      </div>

      {/* Quick Setup Section */}
      <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] to-cyan-600/[0.04] p-4">
        <div className="flex items-start gap-2 mb-3">
          <div className="grid size-6 shrink-0 place-items-center rounded-lg bg-cyan-500/20">
            <Zap className="size-3 text-cyan-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-cyan-300">Configuração rápida</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Defina o mesmo horário para todos os dias
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] font-medium text-gray-300">
              <Sun className="size-3 text-amber-400" />
              Abertura
            </label>
            <input
              type="time"
              value={bulkOpen}
              onChange={(e) => setBulkOpen(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all [&::-webkit-calendar-picker-indicator]:invert"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] font-medium text-gray-300">
              <Moon className="size-3 text-indigo-400" />
              Fechamento
            </label>
            <input
              type="time"
              value={bulkClose}
              onChange={(e) => setBulkClose(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all [&::-webkit-calendar-picker-indicator]:invert"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={applyToAll}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 transition-all hover:from-cyan-400 hover:to-cyan-500 hover:shadow-cyan-500/40 active:scale-[0.98]"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Aplicado!" : "Aplicar para toda semana"}
        </button>
      </div>

      {/* Individual Days Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Ajuste individual</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <div className="space-y-2">
          {DAY_ORDER.map((key) => {
            const s = value[key];
            const meta = DAY_LABEL[key];
            const isWeekend = key === "saturday" || key === "sunday";
            const isExpanded = expandedDays.has(key);
            
            return (
              <div
                key={key}
                className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                  s.closed
                    ? "border-white/5 bg-white/[0.02]"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                {/* Collapsed Header */}
                <div 
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => toggleDayExpanded(key)}
                >
                  <div className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                    isWeekend 
                      ? "bg-purple-500/10 border border-purple-500/20" 
                      : "bg-cyan-500/10 border border-cyan-500/20"
                  }`}>
                    <span className="text-xs font-bold text-white">
                      {meta.short}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white">{meta.label}</p>
                    <p className="text-[10px] text-gray-500">{isWeekend ? "Final de semana" : "Dia útil"}</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={!s.closed}
                      onCheckedChange={(checked) => setDayClosed(key, !checked)}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                    <span className={`text-[10px] font-medium transition-colors ${
                      s.closed ? "text-gray-500" : "text-emerald-400"
                    }`}>
                      {s.closed ? "Fechado" : "Aberto"}
                    </span>
                  </label>
                  {!s.closed && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                      <Clock className="size-3 text-gray-400" />
                      <span className="text-[10px] font-semibold text-gray-300">
                        {formatRange(s)}
                      </span>
                    </div>
                  )}
                  <button className="shrink-0 p-1 text-gray-500 hover:text-white transition-colors">
                    {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>
                </div>

                {/* Expanded Content */}
                {isExpanded && !s.closed && (
                  <div className="px-3 pb-3 pt-0 border-t border-white/5">
                    <div className="flex items-center gap-2 pt-3">
                      <div className="flex-1">
                        <label className="block text-[10px] font-medium text-gray-400 mb-1">Abertura</label>
                        <input
                          type="time"
                          value={s.open}
                          onChange={(e) => setDayTime(key, { open: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all [&::-webkit-calendar-picker-indicator]:invert"
                          aria-label={`${meta.label} abre`}
                        />
                      </div>
                      <span className="text-gray-500 font-bold pt-4">→</span>
                      <div className="flex-1">
                        <label className="block text-[10px] font-medium text-gray-400 mb-1">Fechamento</label>
                        <input
                          type="time"
                          value={s.close}
                          onChange={(e) => setDayTime(key, { close: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all [&::-webkit-calendar-picker-indicator]:invert"
                          aria-label={`${meta.label} fecha`}
                        />
                      </div>
                    </div>
                    {parseInt(s.close.slice(0, 2)) < parseInt(s.open.slice(0, 2)) && s.close !== "00:00" && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-cyan-400">
                        <span className="bg-cyan-500/10 px-1.5 py-0.5 rounded">+1 dia</span>
                      </div>
                    )}
                    {s.close === "00:00" && parseInt(s.open.slice(0, 2)) >= 12 && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-purple-400">
                        <span className="bg-purple-500/10 px-1.5 py-0.5 rounded">vira madrugada</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

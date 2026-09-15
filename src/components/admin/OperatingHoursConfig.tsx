import { useMemo, useState } from "react";
import { Clock, Copy, Check, Power, Zap, Calendar, Sun, Moon } from "lucide-react";
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20">
            <Clock className="size-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Horário de funcionamento</h3>
            <p className="mt-1 text-sm text-gray-400">
              Configure os horários de atendimento para cada dia da semana
            </p>
          </div>
        </div>
        {allEqual && value[DAY_ORDER[0]] && !value[DAY_ORDER[0]].closed && (
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
            <Calendar className="size-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300">
              {formatRange(value[DAY_ORDER[0]])} todos os dias
            </span>
          </div>
        )}
      </div>

      {/* Quick Setup Section */}
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] to-cyan-600/[0.04] p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-cyan-500/20">
            <Zap className="size-4 text-cyan-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-cyan-300">Configuração rápida</h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Defina o mesmo horário para todos os dias em um único clique
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-300">
              <Sun className="size-3.5 text-amber-400" />
              Abertura
            </label>
            <input
              type="time"
              value={bulkOpen}
              onChange={(e) => setBulkOpen(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all [&::-webkit-calendar-picker-indicator]:invert"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-300">
              <Moon className="size-3.5 text-indigo-400" />
              Fechamento
            </label>
            <input
              type="time"
              value={bulkClose}
              onChange={(e) => setBulkClose(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all [&::-webkit-calendar-picker-indicator]:invert"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={applyToAll}
          className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition-all hover:from-cyan-400 hover:to-cyan-500 hover:shadow-cyan-500/40 active:scale-[0.98]"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Horários aplicados!" : "Aplicar para toda a semana"}
        </button>
      </div>

      {/* Individual Days Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ajuste individual por dia</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <div className="space-y-3">
          {DAY_ORDER.map((key) => {
            const s = value[key];
            const meta = DAY_LABEL[key];
            const isWeekend = key === "saturday" || key === "sunday";
            
            return (
              <div
                key={key}
                className={`group rounded-2xl border transition-all duration-200 ${
                  s.closed
                    ? "border-white/5 bg-white/[0.02] hover:border-white/10"
                    : "border-white/10 bg-white/[0.04] hover:border-white/15 hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-4">
                  {/* Day Info */}
                  <div className="flex items-center gap-4 sm:min-w-[140px]">
                    <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                      isWeekend 
                        ? "bg-purple-500/10 border border-purple-500/20" 
                        : "bg-cyan-500/10 border border-cyan-500/20"
                    }`}>
                      <span className="text-sm font-bold text-white">
                        {meta.short}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{meta.label}</p>
                      <p className="text-xs text-gray-500">{isWeekend ? "Final de semana" : "Dia útil"}</p>
                    </div>
                  </div>

                  {/* Toggle & Status */}
                  <div className="flex items-center gap-4 sm:min-w-[160px]">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Switch
                        checked={!s.closed}
                        onCheckedChange={(checked) => setDayClosed(key, !checked)}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                      <span className={`text-sm font-medium transition-colors ${
                        s.closed ? "text-gray-500" : "text-emerald-400"
                      }`}>
                        {s.closed ? "Fechado" : "Aberto"}
                      </span>
                    </label>
                  </div>

                  {/* Time Inputs or Status */}
                  {!s.closed ? (
                    <div className="flex flex-1 items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="relative flex-1">
                          <input
                            type="time"
                            value={s.open}
                            onChange={(e) => setDayTime(key, { open: e.target.value })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all [&::-webkit-calendar-picker-indicator]:invert"
                            aria-label={`${meta.label} abre`}
                          />
                        </div>
                        <span className="text-gray-500 font-bold">→</span>
                        <div className="relative flex-1">
                          <input
                            type="time"
                            value={s.close}
                            onChange={(e) => setDayTime(key, { close: e.target.value })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all [&::-webkit-calendar-picker-indicator]:invert"
                            aria-label={`${meta.label} fecha`}
                          />
                        </div>
                      </div>
                      
                      {/* Time Display */}
                      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                        <Clock className="size-3.5 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-300">
                          {formatRange(s)}
                        </span>
                        {parseInt(s.close.slice(0, 2)) < parseInt(s.open.slice(0, 2)) && s.close !== "00:00" && (
                          <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">+1 dia</span>
                        )}
                        {s.close === "00:00" && parseInt(s.open.slice(0, 2)) >= 12 && (
                          <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">vira madrugada</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-end">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                        <Power className="size-3.5 text-gray-500" />
                        <span className="text-sm font-medium text-gray-500">Sem atendimento</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

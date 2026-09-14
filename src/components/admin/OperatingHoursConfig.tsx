import { useMemo, useState } from "react";
import { Clock, Copy, Check, Power, AlertCircle } from "lucide-react";
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
    <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Clock className="size-4 text-cyan-400" />
            Horário de funcionamento
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Configure por dia. Suporta virada de madrugada (ex: 17:00 — 00:00). O cliente vê se está aberto.
          </p>
        </div>
        {allEqual && value[DAY_ORDER[0]] && !value[DAY_ORDER[0]].closed && (
          <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
            {formatRange(value[DAY_ORDER[0]])} todos os dias
          </span>
        )}
      </div>

      {/* Bulk: aplicar a semana toda */}
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-300">Aplicar à semana toda (1 clique)</p>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">Define o mesmo horário em todos os dias e marca como aberto.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[110px]">
            <span className="mb-1 block text-[11px] font-medium text-gray-400">Abre às</span>
            <input
              type="time"
              value={bulkOpen}
              onChange={(e) => setBulkOpen(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 [&::-webkit-calendar-picker-indicator]:invert"
            />
          </label>
          <label className="flex-1 min-w-[110px]">
            <span className="mb-1 block text-[11px] font-medium text-gray-400">Fecha às</span>
            <input
              type="time"
              value={bulkClose}
              onChange={(e) => setBulkClose(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 [&::-webkit-calendar-picker-indicator]:invert"
            />
          </label>
          <button
            type="button"
            onClick={applyToAll}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-cyan-400 active:scale-[0.98]"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Aplicado!" : "Aplicar em toda a semana"}
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-500">
          <AlertCircle className="size-3 shrink-0" />
          Depois você pode ajustar dias individuais abaixo, se quiser.
        </p>
      </div>

      {/* Por dia */}
      <div className="space-y-2">
        {DAY_ORDER.map((key) => {
          const s = value[key];
          const meta = DAY_LABEL[key];
          return (
            <div
              key={key}
              className={`flex flex-col gap-2 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:gap-3 ${
                s.closed
                  ? "border-white/5 bg-white/[0.02] opacity-70"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="min-w-[4.5rem]">
                  <p className="text-xs font-bold text-white">{meta.label}</p>
                  <p className="text-[10px] font-semibold tracking-widest text-gray-500">{meta.short}</p>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium">
                  <Switch
                    checked={!s.closed}
                    onCheckedChange={(checked) => setDayClosed(key, !checked)}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                  <span className={s.closed ? "text-gray-500" : "text-emerald-300"}>
                    {s.closed ? (
                      <span className="inline-flex items-center gap-1">
                        <Power className="size-3" /> Fechado
                      </span>
                    ) : (
                      "Aberto"
                    )}
                  </span>
                </label>

                {!s.closed && (
                  <span className="hidden text-[11px] text-gray-500 sm:inline">
                    {formatRange(s)}
                    {parseInt(s.close.slice(0, 2)) < parseInt(s.open.slice(0, 2)) && s.close !== "00:00" && (
                      <span className="ml-1 text-[10px] text-cyan-400">(+1 dia)</span>
                    )}
                    {s.close === "00:00" && parseInt(s.open.slice(0, 2)) >= 12 && (
                      <span className="ml-1 text-[10px] text-cyan-400">• vira madrugada</span>
                    )}
                  </span>
                )}
              </div>

              {!s.closed ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={s.open}
                    onChange={(e) => setDayTime(key, { open: e.target.value })}
                    className="w-[112px] rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 [&::-webkit-calendar-picker-indicator]:invert"
                    aria-label={`${meta.label} abre`}
                  />
                  <span className="text-xs font-bold text-gray-500">—</span>
                  <input
                    type="time"
                    value={s.close}
                    onChange={(e) => setDayTime(key, { close: e.target.value })}
                    className="w-[112px] rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 [&::-webkit-calendar-picker-indicator]:invert"
                    aria-label={`${meta.label} fecha`}
                  />
                </div>
              ) : (
                <span className="text-xs font-semibold text-gray-500 sm:ml-auto">Sem atendimento</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

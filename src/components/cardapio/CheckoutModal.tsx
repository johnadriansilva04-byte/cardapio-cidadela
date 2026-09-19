import { useMemo, useState } from "react";
import {
  X,
  Bike,
  Store as StoreIcon,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  MapPin,
  CreditCard,
} from "lucide-react";
import { brl, hexToRgba } from "@/lib/utils";
import type { DeliveryNeighborhood } from "@/lib/types";

export interface CheckoutForm {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address: string;
  customer_complement: string;
  customer_neighborhood: string;
  customer_city: string;
  delivery_type: "entrega" | "retirada";
  observations: string;
  payment_method: "pix" | "dinheiro" | "cartao";
  change_for: string;
  delivery_fee?: number;
}

const field =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30";

const label = "mb-1.5 block text-xs font-medium text-gray-400";

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

export default function CheckoutModal({
  total,
  accent = "#06b6d4",
  prefillName,
  prefillPhone,
  submitting = false,
  serverError = "",
  deliveryFee = 0,
  neighborhoods = [],
  onClose,
  onConfirm,
}: {
  total: number;
  accent?: string;
  prefillName?: string;
  prefillPhone?: string;
  submitting?: boolean;
  serverError?: string;
  deliveryFee?: number;
  neighborhoods?: DeliveryNeighborhood[];
  onClose: () => void;
  onConfirm: (form: CheckoutForm) => void;
}) {
  const [form, setForm] = useState<CheckoutForm>({
    customer_name: prefillName || "",
    customer_phone: prefillPhone || "",
    customer_email: "",
    delivery_address: "",
    customer_complement: "",
    customer_neighborhood: "",
    customer_city: "",
    delivery_type: "retirada",
    observations: "",
    payment_method: "pix",
    change_for: "",
  });
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const isDelivery = form.delivery_type === "entrega";

  // Taxa de entrega: usa o bairro selecionado quando ele tem taxa própria;
  // caso contrário, usa a taxa fixa do restaurante (ou 0 se nem isso existir).
  const hasNeighborhoods = neighborhoods.length > 0;
  const inNeighborhood = hasNeighborhoods
    ? neighborhoods.find(
        (n) => n.name.toLowerCase() === form.customer_neighborhood.trim().toLowerCase(),
      )
    : undefined;
  const appliedFee = isDelivery ? (inNeighborhood ? inNeighborhood.fee : deliveryFee) : 0;
  const totalWithFee = total + appliedFee;

  const STEPS = [
    { n: 1 as const, label: "Contato", icon: ClipboardList },
    {
      n: 2 as const,
      label: isDelivery ? "Entrega" : "Retirada",
      icon: isDelivery ? Bike : StoreIcon,
    },
    { n: 3 as const, label: "Pagamento", icon: CreditCard },
  ];

  function selectType(t: "entrega" | "retirada") {
    setForm((s) => ({
      ...s,
      delivery_type: t,
      delivery_fee: t === "entrega" ? appliedFee : 0,
    }));
  }

  function validateStep(current: 1 | 2 | 3): string {
    if (current === 1) {
      if (!form.customer_name.trim()) return "Informe seu nome";
      if (onlyDigits(form.customer_phone).length < 10) return "Informe um telefone válido com DDD";
    }
    if (current === 2) {
      if (isDelivery) {
        if (!form.delivery_address.trim()) return "Informe o endereço de entrega";
        if (hasNeighborhoods && !form.customer_neighborhood.trim())
          return "Selecione o bairro da entrega";
      }
    }
    if (current === 3) {
      if (form.payment_method === "dinheiro") {
        const change = Number(form.change_for.replace(",", "."));
        if (form.change_for && !isNaN(change) && change > 0 && change < totalWithFee) {
          return "O valor do troco é menor que o total do pedido";
        }
      }
    }
    return "";
  }

  function next() {
    const msg = validateStep(step);
    setError(msg);
    if (msg) return;
    if (step === 2) {
      setForm((s) => ({ ...s, delivery_fee: appliedFee }));
    }
    setStep((s) => (s === 1 ? 2 : 3));
  }

  function submit() {
    const msg = validateStep(3);
    if (msg) {
      setError(msg);
      return;
    }
    if (submitting) return;
    setError("");
    onConfirm({ ...form, delivery_fee: appliedFee });
  }

  const canAdvance = useMemo(() => {
    if (step === 1) {
      return form.customer_name.trim().length > 1 && onlyDigits(form.customer_phone).length >= 10;
    }
    if (step === 2) {
      return isDelivery
        ? Boolean(form.delivery_address.trim()) &&
            (!hasNeighborhoods || Boolean(form.customer_neighborhood.trim()))
        : true;
    }
    return true;
  }, [step, form, isDelivery, hasNeighborhoods]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[#0b0b12] shadow-2xl sm:rounded-[24px]">
        {/* Header + steps */}
        <div className="shrink-0 border-b border-white/[0.07] bg-[#0b0b12] px-5 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black tracking-tight text-white">Finalizar pedido</h2>
            <button
              onClick={onClose}
              aria-label="Fechar checkout"
              className="grid size-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            {STEPS.map((s, i) => {
              const active = step === s.n;
              const done = step > s.n;
              const Icon = s.icon;
              return (
                <div key={s.n} className="flex flex-1 items-center last:flex-none">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`grid size-6 place-items-center rounded-full border text-[10px] font-black transition-colors ${
                        done
                          ? "border-transparent text-white"
                          : active
                            ? "border-transparent text-white"
                            : "border-white/15 bg-white/[0.04] text-gray-500"
                      }`}
                      style={done || active ? { backgroundColor: accent } : undefined}
                    >
                      <Icon className="size-3" />
                    </span>
                    <span
                      className={`hidden text-[11px] font-semibold sm:block ${
                        active || done ? "text-gray-200" : "text-gray-600"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <span
                      className="mx-2 h-0.5 flex-1 rounded-full"
                      style={{ backgroundColor: step > s.n ? accent : "rgba(255,255,255,0.08)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
              {error}
            </p>
          )}
          {serverError && (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold leading-relaxed text-red-300">
              {serverError}
            </p>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className={label}>Seu nome *</label>
                <input
                  className={field}
                  placeholder="Como podemos te chamar?"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className={label}>WhatsApp / Telefone *</label>
                <input
                  className={field}
                  placeholder="(11) 99999-9999"
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className={label}>
                  E-mail <span className="text-gray-600">(opcional)</span>
                </label>
                <input
                  className={field}
                  placeholder="voce@email.com"
                  value={form.customer_email}
                  onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  inputMode="email"
                  autoComplete="email"
                />
              </div>
              <p className="text-[11px] leading-relaxed text-gray-600">
                Usamos esses dados apenas para confirmar e entregar seu pedido.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(["retirada", "entrega"] as const).map((t) => {
                  const active = form.delivery_type === t;
                  const Icon = t === "entrega" ? Bike : StoreIcon;
                  return (
                    <button
                      key={t}
                      onClick={() => selectType(t)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-xs font-bold transition-all ${
                        active
                          ? "text-white"
                          : "border-white/10 bg-white/[0.03] text-gray-400 hover:bg-white/[0.06]"
                      }`}
                      style={
                        active
                          ? {
                              borderColor: accent,
                              backgroundColor: hexToRgba(accent, 0.12),
                              color: accent,
                            }
                          : undefined
                      }
                    >
                      <Icon className="size-5" />
                      {t === "entrega" ? "Entrega" : "Retirar no local"}
                    </button>
                  );
                })}
              </div>

              {isDelivery ? (
                <>
                  <div>
                    <label className={label}>Endereço (rua e número) *</label>
                    <input
                      className={field}
                      placeholder="Rua das Flores, 123"
                      value={form.delivery_address}
                      onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
                      autoComplete="street-address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={label}>Complemento</label>
                      <input
                        className={field}
                        placeholder="Apto 42"
                        value={form.customer_complement}
                        onChange={(e) => setForm({ ...form, customer_complement: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={label}>Bairro *</label>
                      {hasNeighborhoods ? (
                        <select
                          className={field + " appearance-none"}
                          value={form.customer_neighborhood}
                          onChange={(e) =>
                            setForm({ ...form, customer_neighborhood: e.target.value })
                          }
                        >
                          <option value="">Selecione</option>
                          {[...neighborhoods]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((n) => (
                              <option key={n.id} value={n.name} className="bg-[#0b0b12] text-white">
                                {n.name}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <input
                          className={field}
                          placeholder="Seu bairro"
                          value={form.customer_neighborhood}
                          onChange={(e) =>
                            setForm({ ...form, customer_neighborhood: e.target.value })
                          }
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={label}>Cidade</label>
                    <input
                      className={field}
                      placeholder="Sua cidade"
                      value={form.customer_city}
                      onChange={(e) => setForm({ ...form, customer_city: e.target.value })}
                    />
                  </div>
                  {hasNeighborhoods && isDelivery && form.customer_neighborhood && (
                    <p
                      className="flex items-center gap-1.5 text-[11px] font-semibold"
                      style={{ color: inNeighborhood ? "#34d399" : "#fbbf24" }}
                    >
                      <MapPin className="size-3" />
                      {inNeighborhood
                        ? `Entrega em ${form.customer_neighborhood}: ${brl(inNeighborhood.fee)}`
                        : "Bairro fora da área — será aplicada a taxa padrão."}
                    </p>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                    <StoreIcon className="size-3.5" style={{ color: accent }} /> Retirada no balcão
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                    Sem taxa de entrega. Avisaremos quando seu pedido estiver pronto.
                  </p>
                </div>
              )}

              <div>
                <label className={label}>
                  Observações <span className="text-gray-600">(opcional)</span>
                </label>
                <textarea
                  className={field + " resize-none"}
                  rows={2}
                  placeholder="Ex: ponto de referência, campainha..."
                  value={form.observations}
                  onChange={(e) => setForm({ ...form, observations: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(["pix", "dinheiro", "cartao"] as const).map((p) => {
                  const active = form.payment_method === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setForm({ ...form, payment_method: p })}
                      className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition-all ${
                        active
                          ? ""
                          : "border-white/10 bg-white/[0.03] text-gray-400 hover:bg-white/[0.06]"
                      }`}
                      style={
                        active
                          ? {
                              borderColor: accent,
                              backgroundColor: hexToRgba(accent, 0.12),
                              color: accent,
                            }
                          : undefined
                      }
                    >
                      {p === "pix" ? "PIX" : p === "dinheiro" ? "Dinheiro" : "Cartão"}
                    </button>
                  );
                })}
              </div>

              {form.payment_method === "pix" && (
                <p className="text-[11px] leading-relaxed text-gray-500">
                  O QR Code do PIX aparece assim que o pedido for confirmado.
                </p>
              )}
              {form.payment_method === "dinheiro" && (
                <div>
                  <label className={label}>Troco para quanto?</label>
                  <input
                    className={field}
                    placeholder={`Ex: ${Math.ceil(totalWithFee / 10) * 10}`}
                    value={form.change_for}
                    onChange={(e) => setForm({ ...form, change_for: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
              )}
              {form.payment_method === "cartao" && (
                <p className="text-[11px] leading-relaxed text-gray-500">
                  Pagamento na entrega ou retirada, na maquininha do estabelecimento.
                </p>
              )}

              {/* Resumo do pedido */}
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3 text-xs">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">
                  Resumo
                </p>
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal</span>
                  <span className="text-gray-200">{brl(total)}</span>
                </div>
                <div className="mt-1 flex justify-between text-gray-400">
                  <span>{isDelivery ? "Taxa de entrega" : "Retirada"}</span>
                  <span className={isDelivery ? "text-gray-200" : "text-gray-600"}>
                    {isDelivery ? brl(appliedFee) : "sem taxa"}
                  </span>
                </div>
                <div className="mt-2 flex justify-between border-t border-white/[0.07] pt-2 text-sm font-black text-white">
                  <span>Total</span>
                  <span style={{ color: accent }}>{brl(totalWithFee)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/[0.07] bg-[#0b0b12] px-5 py-3">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => {
                  setError("");
                  setStep((s) => (s === 3 ? 2 : 1));
                }}
                className="grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-gray-300 transition-colors hover:bg-white/[0.08]"
                aria-label="Voltar"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={next}
                disabled={!canAdvance || Boolean(serverError)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-3 text-sm font-black text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: accent,
                  boxShadow: `0 6px 20px ${hexToRgba(accent, 0.35)}`,
                }}
              >
                Continuar <ChevronRight className="size-4" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="flex flex-1 items-center justify-center rounded-full py-3 text-sm font-black text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor: accent,
                  boxShadow: `0 6px 20px ${hexToRgba(accent, 0.35)}`,
                }}
              >
                {submitting ? "Enviando pedido..." : `Confirmar pedido • ${brl(totalWithFee)}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

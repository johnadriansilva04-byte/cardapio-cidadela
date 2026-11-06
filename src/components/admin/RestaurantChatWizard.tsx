import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  Loader2,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
  Store,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CHAT_STEPS,
  COLOR_PRESETS,
  HOURS_PRESETS,
  parseNeighborhoodLine,
  validateAnswer,
  type ChatStep,
  type DraftNeighborhood,
} from "@/lib/restaurantChat";
import type { RestaurantFormValues } from "@/components/admin/restaurantForm";
import { PhotoMenuImport } from "@/components/admin/PhotoMenuImport";

interface Bubble {
  id: number;
  role: "bot" | "user";
  text: string;
}

export interface RestaurantChatWizardProps {
  /** Preenche o formulário por trás, uma resposta por vez. */
  onPatch: (part: Partial<RestaurantFormValues>) => void;
  /** Chamado no passo de revisão, com o formulário já preenchido. */
  onFinish: () => void;
  /** Sai do chat e abre o formulário completo (com o que já foi respondido). */
  onSwitchToForm: () => void;
  /** Valor atual do formulário — a revisão e o preview leem daqui. */
  form: RestaurantFormValues;
  /** Bairros coletados no chat, gravados depois que o restaurante existe. */
  neighborhoods: DraftNeighborhood[];
  onNeighborhoodsChange: (next: DraftNeighborhood[]) => void;
  /** Passos a percorrer. Padrão: todos. Na edição dá para omitir alguns. */
  steps?: ChatStep[];
  /** Passo em que o chat abre. Em edição, pula o que já está preenchido. */
  initialStep?: number;
  /** Texto do CTA final ("Criar cardápio" na criação, "Salvar" na edição). */
  finishLabel?: string;
  /** Título de contexto mostrado no cabeçalho. */
  editMode?: boolean;
  /** Id do restaurante quando ele já existe (edição) — habilita a foto. */
  restaurantId?: string;
  /** `true` quando o ciclo anual libera a leitura por foto. */
  canScan?: boolean;
  /** Leva ao fluxo de assinatura (upsell do anual). */
  onUpgrade?: () => void;
  /** Avisa o diálogo para recarregar o cardápio após importar a foto. */
  onMenuImported?: (count: number) => void;
  submitting?: boolean;
}

/**
 * Pracinha Monta — criação de restaurante em conversa.
 *
 * Em vez de um formulário de 20 campos, a Pracinha conduz o dono por um
 * roteiro: uma pergunta por vez, validação na hora e um preview do cardápio
 * que se monta ao lado conforme ele responde. O formulário completo continua
 * existindo, mas só como conferência no fim (ou se ele pedir).
 *
 * O roteiro é determinístico (sem IA): funciona offline, não gasta cota e o
 * resultado é sempre o mesmo. É o mesmo `RestaurantFormValues` por trás, então
 * nada da validação de servidor muda.
 */
export function RestaurantChatWizard({
  onPatch,
  onFinish,
  onSwitchToForm,
  form,
  neighborhoods,
  onNeighborhoodsChange,
  steps = CHAT_STEPS,
  initialStep = 0,
  finishLabel = "Criar cardápio",
  editMode = false,
  restaurantId,
  canScan = false,
  onUpgrade,
  onMenuImported,
  submitting = false,
}: RestaurantChatWizardProps) {
  const [stepIndex, setStepIndex] = useState(() => Math.min(initialStep, steps.length));
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  const atReview = stepIndex >= steps.length;
  const step: ChatStep | null = atReview ? null : steps[stepIndex];
  const total = steps.length;
  const progress = total > 0 ? Math.round((Math.min(stepIndex, total) / total) * 100) : 100;

  const pushBubble = (role: Bubble["role"], text: string) => {
    setBubbles((prev) => [...prev, { id: nextId.current++, role, text }]);
  };

  useEffect(() => {
    if (bubbles.length === 0 && step) pushBubble("bot", step.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [bubbles]);

  useEffect(() => {
    if (step?.kind === "text" || step?.kind === "number") inputRef.current?.focus();
  }, [stepIndex, step?.kind]);

  function advance(displayText: string) {
    pushBubble("user", displayText);
    const next = stepIndex + 1;
    setStepIndex(next);
    setInput("");
    setError(null);
    if (next < steps.length) {
      window.setTimeout(() => pushBubble("bot", steps[next].question), 220);
    }
  }

  function submitText() {
    if (!step) return;
    const res = validateAnswer(step, input);
    if (!res.ok) {
      setError(res.error ?? "Não entendi. Tente de novo.");
      return;
    }
    const value = res.value ?? "";

    // Passo de lista (bairros): cada linha vira um bairro; termina no "Pronto".
    if (step.kind === "list") {
      const parsed = parseNeighborhoodLine(value);
      if (!parsed) {
        setError("Escreva o nome do bairro. Ex: Centro 5.");
        return;
      }
      onNeighborhoodsChange([...neighborhoods, parsed]);
      pushBubble("user", parsed.fee ? `${parsed.name} — R$ ${parsed.fee}` : parsed.name);
      setInput("");
      setError(null);
      return;
    }

    if (step.field === "name") onPatch({ name: value });
    else if (step.field === "description") onPatch({ description: value });
    else if (step.field === "whatsapp") onPatch({ whatsapp: value });
    else if (step.field === "phone") onPatch({ phone: value });
    else if (step.field === "address") onPatch({ address: value });
    else if (step.field === "delivery_fee") onPatch({ delivery_fee: value });
    else if (step.field === "pix_key") onPatch({ pix_key: value });
    advance(value || "—");
  }

  function pickChoice(choiceValue: string, label: string) {
    if (!step) return;
    if (step.field === "operating_hours" && choiceValue !== "skip") {
      const preset = HOURS_PRESETS[choiceValue];
      if (preset) onPatch({ operating_hours: preset });
    }
    if (step.field === "primary_color") {
      const preset = COLOR_PRESETS[choiceValue];
      if (preset) onPatch({ primary_color: preset.primary, secondary_color: preset.secondary });
    }
    advance(label);
  }

  function finishList() {
    advance(neighborhoods.length === 0 ? "Nenhum bairro" : `${neighborhoods.length} bairro(s)`);
  }

  function skipStep() {
    if (!step) return;
    if (step.kind === "list") {
      finishList();
      return;
    }
    advance("Pular");
  }

  function back() {
    if (stepIndex === 0) return;
    setBubbles((prev) => prev.slice(0, -2));
    setStepIndex((i) => Math.max(0, i - 1));
    setInput("");
    setError(null);
  }

  /** Abreviações do resumo mostrado na revisão. */
  const summary = useMemo(
    () =>
      [
        { label: "Nome", value: form.name },
        { label: "Slogan", value: form.description },
        { label: "WhatsApp", value: form.whatsapp },
        { label: "Telefone", value: form.phone },
        { label: "Endereço", value: form.address },
        { label: "Entrega", value: form.delivery_fee ? `R$ ${form.delivery_fee}` : "" },
        {
          label: "Bairros",
          value: neighborhoods.length
            ? neighborhoods.map((n) => (n.fee ? `${n.name} (R$ ${n.fee})` : n.name)).join(", ")
            : "",
        },
        { label: "PIX", value: form.pix_key },
      ].filter((r) => r.value),
    [form, neighborhoods],
  );

  const accent = form.primary_color || "#06b6d4";

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_360px]">
      {/* Coluna da conversa */}
      <div className="flex min-h-0 flex-col">
        {/* Progresso */}
        <div className="shrink-0 px-5 pt-3">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: accent }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-gray-600">
            {atReview ? "Revisão" : `Pergunta ${stepIndex + 1} de ${total}`}
          </p>
        </div>

        {/* Conversa */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {bubbles.map((b) => (
            <div
              key={b.id}
              className={"flex items-start gap-2 " + (b.role === "user" ? "flex-row-reverse" : "")}
            >
              <span
                className={
                  "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full " +
                  (b.role === "user" ? "bg-white/10 text-gray-300" : "text-white")
                }
                style={b.role === "bot" ? { backgroundColor: accent } : undefined}
              >
                {b.role === "user" ? (
                  <User className="size-3.5" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
              </span>
              <p
                className={
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed " +
                  (b.role === "user"
                    ? "rounded-tr-sm bg-white/10 text-white"
                    : "rounded-tl-sm border border-white/[0.07] bg-white/[0.04] text-gray-200")
                }
              >
                {b.text}
              </p>
            </div>
          ))}

          {atReview && (
            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: `${accent}40`, backgroundColor: `${accent}0f` }}
            >
              <p className="flex items-center gap-2 text-sm font-bold text-white">
                <Check className="size-4" style={{ color: accent }} /> Tudo pronto!
              </p>
              <p className="mt-1 text-[11px] text-gray-400">
                {editMode
                  ? "Confira o resumo e salve. O link público atualiza na hora."
                  : "Confira o resumo. O cardápio nasce publicado com itens de exemplo — você troca depois."}
              </p>
              <dl className="mt-3 space-y-1.5">
                {summary.map((row) => (
                  <div key={row.label} className="flex gap-2 text-xs">
                    <dt className="w-20 shrink-0 text-gray-500">{row.label}</dt>
                    <dd className="min-w-0 flex-1 truncate text-gray-200">{row.value}</dd>
                  </div>
                ))}
              </dl>

              {/* Foto do cardápio: na edição o restaurante já existe, então dá
                  para ler e importar na hora. Na criação fica como convite do
                  anual — a loja ainda não tem id para gravar os itens. */}
              {editMode && restaurantId && onUpgrade ? (
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <PhotoMenuImport
                    restaurantId={restaurantId}
                    canScan={canScan}
                    onUpgrade={onUpgrade}
                    onImported={(count) => onMenuImported?.(count)}
                  />
                </div>
              ) : (
                !editMode &&
                onUpgrade && (
                  <div className="mt-3 border-t border-white/[0.06] pt-3">
                    <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-400">
                      <Camera className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
                      <span>
                        No plano <span className="font-bold text-amber-200">Anual</span> você manda
                        a foto do seu menu e a IA monta o cardápio inteiro. No{" "}
                        <span className="font-semibold text-gray-300">Mensal</span>, a Pracinha
                        monta por conversa (como agora).
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={onUpgrade}
                      className="mt-2 text-[11px] font-semibold text-amber-300 hover:text-amber-200"
                    >
                      Ver o plano Anual →
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Entrada */}
        <div className="shrink-0 border-t border-white/[0.06] px-5 py-4">
          {error && <p className="mb-2 text-[11px] text-red-400">{error}</p>}

          {step?.kind === "choice" && step.choices && (
            <div className="grid gap-2 sm:grid-cols-2">
              {step.choices.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => pickChoice(c.value, c.label)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07]"
                  style={{ borderColor: "rgba(255,255,255,0.1)" }}
                >
                  <span className="block text-sm font-semibold text-white">{c.label}</span>
                  {c.hint && <span className="block text-[11px] text-gray-500">{c.hint}</span>}
                </button>
              ))}
            </div>
          )}

          {(step?.kind === "text" || step?.kind === "number" || step?.kind === "list") && (
            <div className="space-y-2">
              {step.kind === "list" && neighborhoods.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {neighborhoods.map((n, i) => (
                    <li
                      key={`${n.name}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-gray-200"
                    >
                      <MapPin className="size-3" style={{ color: accent }} />
                      {n.name}
                      {n.fee ? ` · R$ ${n.fee}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  type={step.kind === "number" ? "number" : "text"}
                  inputMode={step.kind === "number" ? "decimal" : undefined}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitText();
                    }
                  }}
                  placeholder={step.placeholder}
                  className="border-white/10 bg-white/[0.04] text-white placeholder:text-gray-600 focus-visible:ring-cyan-500/40"
                />
                <Button
                  type="button"
                  onClick={submitText}
                  disabled={!input.trim()}
                  aria-label="Enviar resposta"
                  className="shrink-0 text-black disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  <Send className="size-4" />
                </Button>
              </div>
              {step.kind === "list" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={finishList}
                  className="w-full border-white/10 bg-white/[0.04] text-gray-200 hover:bg-white/[0.08]"
                >
                  <Check className="mr-1.5 size-4" /> {step.doneLabel ?? "Pronto"}
                </Button>
              )}
            </div>
          )}

          {atReview && (
            <Button
              type="button"
              onClick={onFinish}
              disabled={submitting}
              className="w-full text-black disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              {submitting ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Store className="mr-1.5 size-4" />
              )}
              {submitting ? "Salvando…" : finishLabel}
            </Button>
          )}

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={back}
              disabled={stepIndex === 0}
              className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 disabled:invisible"
            >
              <ArrowLeft className="size-3" /> Voltar
            </button>
            <div className="flex items-center gap-3">
              {step?.optional && step.kind !== "list" && (
                <button
                  type="button"
                  onClick={skipStep}
                  className="text-[11px] text-gray-500 hover:text-gray-300"
                >
                  Pular
                </button>
              )}
              <button
                type="button"
                onClick={onSwitchToForm}
                className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-cyan-300"
              >
                <MessageCircle className="size-3" /> Prefiro preencher tudo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview ao vivo do cardápio — o dono vê o resultado se formando */}
      <aside className="hidden min-h-0 flex-col border-l border-white/[0.06] bg-black/20 lg:flex">
        <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Prévia ao vivo
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d13]">
            <div
              className="h-20"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${form.secondary_color || "#8b5cf6"})`,
              }}
            />
            <div className="-mt-7 px-4 pb-4">
              <span
                className="grid size-14 place-items-center rounded-2xl border-4 border-[#0d0d13] text-lg font-black text-white"
                style={{ backgroundColor: accent }}
              >
                {(form.name || "?").slice(0, 1).toUpperCase()}
              </span>
              <p className="mt-2 truncate text-sm font-bold text-white">
                {form.name || "Nome do restaurante"}
              </p>
              <p className="truncate text-[11px] text-gray-500">
                {form.description || "Descrição ou slogan"}
              </p>
              <div className="mt-3 space-y-2">
                {["Prato do dia", "Porção especial"].map((n, i) => (
                  <div
                    key={n}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] p-2"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-md text-[10px] font-bold text-black"
                      style={{ backgroundColor: accent }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-gray-200">{n}</p>
                      <p className="text-[10px] text-gray-600">R$ {(12.9 + i * 5).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
              {form.whatsapp && (
                <p className="mt-3 truncate text-[10px] text-gray-600">Pedidos: {form.whatsapp}</p>
              )}
            </div>
          </div>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-gray-600">
            É assim que seu cliente vai ver. Os itens são exemplos — troque no cardápio depois.
          </p>
        </div>
      </aside>
    </div>
  );
}

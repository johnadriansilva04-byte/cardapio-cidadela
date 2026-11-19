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
import { Textarea } from "@/components/ui/textarea";
import {
  CHAT_STEPS,
  COLOR_PRESETS,
  HOURS_PRESETS,
  normalizeDeliveryFee,
  parseCityInput,
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(0);

  // Passo de bairros: busca por cidade (OpenStreetMap) e seleção com taxa.
  const [lookupBusy, setLookupBusy] = useState(false);
  const [foundNeighborhoods, setFoundNeighborhoods] = useState<string[] | null>(null);
  const [foundCity, setFoundCity] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  /** Busca indisponível (Overpass fora do ar): o dono digita os bairros. */
  const [manualMode, setManualMode] = useState(false);

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

    if (res.skipped) {
      advance("Pular");
      return;
    }

    // Passo de bairros: o texto é a cidade; a busca preenche a lista.
    if (step.kind === "neighborhoods") {
      if (manualMode) {
        submitManualNeighborhoods(value);
        return;
      }
      void searchCity(value);
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

  /** Geocodifica a cidade e busca os bairros no OpenStreetMap. */
  async function searchCity(raw: string) {
    const parsed = parseCityInput(raw);
    if (!parsed) {
      setError("Digite o nome da cidade. Ex: Florianópolis.");
      return;
    }
    setError(null);
    setLookupBusy(true);
    setFoundNeighborhoods(null);
    try {
      // Carregado sob demanda: o buscador arrasta o Nominatim/Overpass e o chat
      // precisa abrir instantaneamente, mesmo sem rede.
      const { searchNeighborhoodsByCity } = await import("@/lib/neighborhoodLookup");
      const res = await searchNeighborhoodsByCity(parsed.city, parsed.uf);
      if (!res.city) {
        setError(
          "Não achei essa cidade. Confira o nome ou tente com a UF, ex: “Florianópolis SC”.",
        );
        return;
      }
      if (res.neighborhoods.length === 0) {
        // Sem lista automática não há beco sem saída: o dono digita os bairros.
        setManualMode(true);
        setInput("");
        setFoundCity(res.city.cityName);
        setError(
          `Não encontrei a lista de bairros de ${res.city.cityName}. Digite os seus abaixo, um por linha.`,
        );
        return;
      }
      setFoundCity(res.city.cityName);
      setFoundNeighborhoods(res.neighborhoods);
      // Já marca todos: o dono desmarca o que não atende.
      setPicked(Object.fromEntries(res.neighborhoods.map((n) => [n, ""])));
    } catch {
      setManualMode(true);
      setInput("");
      setError("A busca automática está fora do ar. Digite os bairros abaixo, um por linha.");
    } finally {
      setLookupBusy(false);
    }
  }

  function togglePicked(name: string) {
    setPicked((prev) => {
      const next = { ...prev };
      if (name in next) delete next[name];
      else next[name] = "";
      return next;
    });
  }

  /**
   * Plano B da busca: "Centro 5", "Trindade 8,50" ou só o nome, um por linha.
   * Usa o mesmo parser do modo antigo, então a taxa é opcional.
   */
  function submitManualNeighborhoods(raw: string) {
    const entries = raw
      .split(/[\n;]+/)
      .map((line) => parseNeighborhoodLine(line))
      .filter((n): n is DraftNeighborhood => Boolean(n));
    if (entries.length === 0) {
      setError("Escreva o nome do bairro. Ex: Centro 5.");
      return;
    }
    onNeighborhoodsChange([...neighborhoods, ...entries]);
    const fees = entries.map((n) => Number(n.fee)).filter((f) => Number.isFinite(f) && f > 0);
    if (fees.length > 0) {
      onPatch({ delivery_fee: normalizeDeliveryFee(String(Math.max(...fees))) ?? "" });
    }
    setError(null);
    setInput("");
    setManualMode(false);
    advance(`${entries.length} bairro(s): ${entries.map((n) => n.name).join(", ")}`);
  }
  function confirmNeighborhoods() {
    const chosen = Object.entries(picked).map(([name, fee]) => ({
      name,
      fee: fee.trim() ? (normalizeDeliveryFee(fee) ?? "") : "",
    }));
    const cleaned = chosen.filter((n) => n.name.trim());
    // Junta com o que já foi escolhido antes (voltar e buscar outra cidade).
    const merged = [
      ...neighborhoods.filter((n) => !cleaned.some((c) => c.name === n.name)),
      ...cleaned,
    ];
    onNeighborhoodsChange(merged);

    // A taxa padrão é a MAIOR entre os bairros escolhidos: quem digitar um
    // bairro fora da lista paga essa, em vez de entrega grátis. Sem isso a
    // taxa padrão ficaria em zero (o passo "quanto cobra de entrega" saiu).
    const fees = merged.map((n) => Number(n.fee)).filter((f) => Number.isFinite(f) && f > 0);
    if (fees.length > 0)
      onPatch({ delivery_fee: normalizeDeliveryFee(String(Math.max(...fees))) ?? "" });

    advance(
      merged.length === 0
        ? "Nenhum bairro"
        : `${merged.length} bairro(s): ${merged.map((n) => n.name).join(", ")}`,
    );
    setFoundNeighborhoods(null);
    setPicked({});
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

  function skipStep() {
    if (!step) return;
    advance("Pular");
    setFoundNeighborhoods(null);
    setPicked({});
    setManualMode(false);
    setError(null);
  }

  function back() {
    if (stepIndex === 0) return;
    setBubbles((prev) => prev.slice(0, -2));
    setStepIndex((i) => Math.max(0, i - 1));
    setInput("");
    setError(null);
    setFoundNeighborhoods(null);
    setPicked({});
    setManualMode(false);
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
        { label: "Taxa padrão", value: form.delivery_fee ? `R$ ${form.delivery_fee}` : "" },
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

          {(step?.kind === "text" || step?.kind === "number" || step?.kind === "neighborhoods") && (
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                {step.kind === "neighborhoods" && manualMode ? (
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setError(null);
                    }}
                    rows={3}
                    placeholder={"Centro 5\nTrindade 8,50\nCampeche"}
                    className="min-h-20 border-white/10 bg-white/[0.04] text-white placeholder:text-gray-600 focus-visible:ring-cyan-500/40"
                  />
                ) : (
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
                )}
                <Button
                  type="button"
                  onClick={submitText}
                  disabled={!input.trim() || lookupBusy}
                  aria-label="Enviar resposta"
                  className="shrink-0 text-black disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  {lookupBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>

              {step.kind === "neighborhoods" && manualMode && (
                <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-200">
                  Escreva os bairros que você atende, um por linha — a taxa é opcional (“Centro 5”
                  ou só “Centro”). Dá para ajustar depois em Restaurantes.
                </p>
              )}

              {step.kind === "neighborhoods" && foundNeighborhoods && (
                <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <p className="px-1 text-[11px] text-gray-400">
                    {foundNeighborhoods.length} bairros em {foundCity}. Marque os que você atende e
                    coloque a taxa de cada um.
                  </p>
                  <ul className="max-h-52 space-y-1 overflow-y-auto pr-0.5">
                    {[...foundNeighborhoods]
                      .sort((a, b) => a.localeCompare(b, "pt-BR"))
                      .map((name) => {
                        const checked = name in picked;
                        return (
                          <li
                            key={name}
                            className={
                              "flex items-center gap-2 rounded-lg px-2 py-1.5 " +
                              (checked ? "bg-white/[0.06]" : "")
                            }
                          >
                            <button
                              type="button"
                              onClick={() => togglePicked(name)}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <span
                                className={
                                  "grid size-4 shrink-0 place-items-center rounded border " +
                                  (checked
                                    ? "border-transparent text-black"
                                    : "border-white/20 bg-transparent")
                                }
                                style={checked ? { backgroundColor: accent } : undefined}
                              >
                                {checked && <Check className="size-3" />}
                              </span>
                              <span className="truncate text-xs text-gray-200">{name}</span>
                            </button>
                            <div className="flex shrink-0 items-center gap-1">
                              <span className="text-[11px] text-gray-500">R$</span>
                              <Input
                                value={picked[name] ?? ""}
                                onChange={(e) => {
                                  const fee = e.target.value;
                                  // Digitar a taxa já marca o bairro: quem começa
                                  // pelo valor não precisa descobrir que o campo
                                  // só abre depois do clique.
                                  setPicked((prev) => ({ ...prev, [name]: fee }));
                                }}
                                inputMode="decimal"
                                placeholder="0,00"
                                aria-label={`Taxa de entrega para ${name}`}
                                className="h-7 w-16 border-white/10 bg-white/[0.04] px-2 text-xs text-white placeholder:text-gray-600"
                              />
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                  <Button
                    type="button"
                    onClick={confirmNeighborhoods}
                    className="w-full text-black"
                    style={{ backgroundColor: accent }}
                  >
                    <Check className="mr-1.5 size-4" /> Usar{" "}
                    {Object.keys(picked).length > 0 ? `${Object.keys(picked).length} ` : ""}
                    bairro(s)
                  </Button>
                </div>
              )}

              {step.kind === "neighborhoods" && neighborhoods.length > 0 && (
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
              {step?.optional && (
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

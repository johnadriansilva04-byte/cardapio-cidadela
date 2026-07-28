import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FigureSVG } from "./iq/FigureSVG";
import { PracinhaWithClipboard, type PracinhaMood } from "./iq/PracinhaWithClipboard";
import { PracinhaChat } from "./iq/PracinhaChat";
import { buildTest, type MatrixItem } from "@/lib/iq/generator";
import { scoreTest, type IQResult } from "@/lib/iq/scoring";
import { hashSeed } from "@/lib/iq/rng";

type Phase = "intro" | "running" | "result";

const PRACINHA_LINES: Record<string, string[]> = {
  intro: [
    "Bora? Respira fundo. Eu fico aqui do lado o tempo todo.",
    "Cada matriz tem uma regra escondida. Ache a regra, ache a resposta.",
  ],
  running: [
    "Olha as linhas primeiro. Depois as colunas.",
    "Quantidade, forma, cor, giro, preenchimento. Um deles muda com padrão.",
    "Se travar, marca a melhor hipótese e segue. Dá pra revisar depois.",
    "Não conta figura no chute: conta a regra.",
    "Tá indo bem. Ritmo constante vence.",
  ],
  ending: ["Últimas questões. Foco total agora."],
  result: ["Fechou! Esse é o seu retrato cognitivo de hoje."],
};

function formatClock(totalSeconds: number): string {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function IQTest() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [seed, setSeed] = useState<number>(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [result, setResult] = useState<IQResult | null>(null);
  const itemCount = 30;
  const durationMinutes = 25;
  const startedAt = useRef<number>(0);

  const test = useMemo(() => (seed ? buildTest(seed, itemCount) : null), [seed, itemCount]);
  const items: MatrixItem[] = test?.items ?? [];

  const finish = useCallback(
    (finalAnswers: (number | null)[], itemList: MatrixItem[], usedSeed: number) => {
      const scored = scoreTest(
        itemList.map((it, i) => ({
          difficulty: it.difficulty,
          correct: finalAnswers[i] === it.answerIndex,
        })),
      );
      setResult(scored);
      setPhase("result");
    },
    [],
  );

  // cronômetro
  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "running" && secondsLeft === 0 && test) {
      finish(answers, test.items, test.seed);
    }
  }, [secondsLeft, phase, test, answers, finish]);

  const start = () => {
    const s = hashSeed(Date.now(), Math.floor(Math.random() * 1e9), "anon");
    setSeed(s);
    setAnswers(Array.from({ length: itemCount }, () => null));
    setCurrent(0);
    setSecondsLeft(durationMinutes * 60);
    setResult(null);
    startedAt.current = Date.now();
    setPhase("running");
  };

  const answered = answers.filter((a) => a !== null).length;
  const progress = phase === "running" ? (current / Math.max(1, itemCount)) * 100 : 0;

  const mood: PracinhaMood =
    phase === "result"
      ? (result?.iq ?? 0) >= 100
        ? "cheer"
        : "idle"
      : phase === "running"
        ? secondsLeft < 60
          ? "worried"
          : "thinking"
        : "idle";

  const line = useMemo(() => {
    if (phase === "result") return PRACINHA_LINES.result[0];
    if (phase === "intro") return PRACINHA_LINES.intro[current % 2];
    if (current >= itemCount - 4) return PRACINHA_LINES.ending[0];
    return PRACINHA_LINES.running[current % PRACINHA_LINES.running.length];
  }, [phase, current, itemCount]);

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col bg-[var(--matte)]">
      {/* Header */}
      <div className="border-b border-border bg-secondary px-6 py-4">
        <h1 className="text-stencil text-xl">Teste de QI — Pracinha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Matrizes Progressivas 3×3 — Avaliação cognitiva com assistência do robô
        </p>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Test Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            {phase === "intro" ? (
              <div className="rounded-xl border border-border bg-secondary p-8">
                <p className="chip">Módulo de aferição cognitiva</p>
                <h1 className="font-display mt-4 text-3xl font-bold leading-tight text-foreground md:text-5xl">
                  Matrizes Progressivas 3×3
                </h1>
                <p className="mt-4 max-w-2xl text-muted-foreground">
                  Nove figuras, uma faltando. Cada matriz é gerada na hora por regras lógicas
                  explícitas — forma, quantidade, tamanho, rotação, preenchimento, cor e figura
                  interna. O espaço de variação passa de milhares de provas distintas, então você
                  nunca repete a mesma sequência.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <Stat label="Questões" value={String(itemCount)} hint="dificuldade crescente" />
                  <Stat
                    label="Tempo total"
                    value={`${durationMinutes} min`}
                    hint="cronômetro único"
                  />
                  <Stat label="Reteste" value="90 dias" hint="janela de soberania" />
                </div>

                <div className="mt-8 space-y-3 text-sm text-muted-foreground">
                  <Rule n="1">Cada linha e cada coluna obedecem a uma regra. Descubra qual.</Rule>
                  <Rule n="2">
                    São 8 alternativas por questão. Só uma satisfaz todas as regras.
                  </Rule>
                  <Rule n="3">Você pode voltar e revisar enquanto o cronômetro correr.</Rule>
                  <Rule n="4">
                    O escore usa TRI (modelo logístico de 3 parâmetros) com correção de acerto ao
                    acaso.
                  </Rule>
                </div>

                <button onClick={start} className="btn-primary mt-9 w-full sm:w-auto">
                  Iniciar avaliação
                </button>
              </div>
            ) : phase === "running" && test ? (
              <RunPanel
                item={items[current]}
                index={current}
                total={itemCount}
                answered={answered}
                secondsLeft={secondsLeft}
                progress={progress}
                selected={answers[current]}
                onSelect={(opt) =>
                  setAnswers((prev) => {
                    const next = prev.slice();
                    next[current] = opt;
                    return next;
                  })
                }
                onPrev={() => setCurrent((c) => Math.max(0, c - 1))}
                onNext={() => setCurrent((c) => Math.min(itemCount - 1, c + 1))}
                onFinish={() => finish(answers, test.items, test.seed)}
                onJump={setCurrent}
                answers={answers}
              />
            ) : phase === "result" && result && test ? (
              <ResultPanel
                result={result}
                items={test.items}
                answers={answers}
                onExit={() => setPhase("intro")}
              />
            ) : null}
          </div>
        </div>

        {/* Right: Pracinha + Chat */}
        <div className="flex w-72 flex-col border-l border-border bg-secondary">
          {/* Pracinha with Clipboard */}
          <div className="flex flex-col items-center p-3 border-b border-border">
            <PracinhaWithClipboard mood={mood} className="w-24 h-auto" />
            <div>
              <p className="font-display text-xs uppercase tracking-[0.2em] text-accent">
                Pracinha
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{line}</p>
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 p-3">
            <PracinhaChat />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Painéis ----------------------------- */

function RunPanel({
  item,
  index,
  total,
  answered,
  secondsLeft,
  progress,
  selected,
  onSelect,
  onPrev,
  onNext,
  onFinish,
  onJump,
  answers,
}: {
  item: MatrixItem;
  index: number;
  total: number;
  answered: number;
  secondsLeft: number;
  progress: number;
  selected: number | null;
  onSelect: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  onJump: (i: number) => void;
  answers: (number | null)[];
}) {
  const cells = [...item.cells, null];
  const low = secondsLeft <= 60;

  return (
    <div className="rounded-xl border border-border bg-secondary p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.25em] text-accent">
            Questão {index + 1} de {total}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{answered} respondidas</p>
        </div>
        <div
          className={`font-display rounded-full border px-4 py-1.5 text-lg tabular-nums ${
            low
              ? "border-destructive/60 bg-destructive/15 text-destructive"
              : "border-border bg-secondary text-foreground"
          }`}
          aria-live="polite"
        >
          {formatClock(secondsLeft)}
        </div>
      </div>

      <div className="progress mt-4">
        <div className="progress__bar" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-7 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="matrix">
            {cells.map((f, i) => (
              <div key={i} className={`matrix__cell ${f === null && "matrix__cell--missing"}`}>
                <FigureSVG figure={f} className="h-full w-full" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Escolha a peça que completa
          </p>
          <div className="grid grid-cols-4 gap-2.5">
            {item.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onSelect(i)}
                className={`option ${selected === i && "option--active"}`}
                aria-pressed={selected === i}
                aria-label={`Alternativa ${i + 1}`}
              >
                <FigureSVG figure={opt} className="h-full w-full" />
                <span className="option__tag">{i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={onPrev} disabled={index === 0} className="btn-ghost">
          Anterior
        </button>
        {index < total - 1 ? (
          <button onClick={onNext} className="btn-primary">
            Próxima
          </button>
        ) : (
          <button onClick={onFinish} className="btn-primary">
            Finalizar e calcular
          </button>
        )}
        <button onClick={onFinish} className="btn-ghost ml-auto">
          Encerrar agora
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {answers.map((a, i) => (
          <button
            key={i}
            onClick={() => onJump(i)}
            className={`dot ${a !== null && "dot--done"} ${i === index && "dot--current"}`}
            aria-label={`Ir para a questão ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  items,
  answers,
  onExit,
}: {
  result: IQResult;
  items: MatrixItem[];
  answers: (number | null)[];
  onExit?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary p-6 md:p-9">
      <p className="chip">Resultado aferido</p>
      <div className="mt-6 flex flex-wrap items-end gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">QI estimado</p>
          <p className="font-display text-7xl font-bold leading-none text-gradient">{result.iq}</p>
        </div>
        <div className="pb-2 text-sm text-muted-foreground">
          <p className="text-foreground">{result.classification}</p>
          <p className="mt-1">
            Intervalo de 95%:{" "}
            <strong className="text-foreground">
              {result.iqLow}–{result.iqHigh}
            </strong>
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <Stat label="Percentil" value={`${result.percentile}%`} hint="da população" />
        <Stat
          label="Acertos"
          value={`${result.rawScore}/${result.totalItems}`}
          hint="escore bruto"
        />
        <Stat label="Theta (θ)" value={result.theta.toFixed(2)} hint="habilidade latente" />
        <Stat label="Erro-padrão" value={`±${(result.seTheta * 15).toFixed(1)}`} hint="QI" />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Estimativa por Teoria de Resposta ao Item, modelo 3PL (a = 1,15; c = 0,125), com dificuldade
        derivada da composição de regras de cada matriz. Escala de desvio Wechsler (média 100, DP
        15). Um escore bruto não vira QI por regra de três: itens difíceis pesam mais, e o acerto
        por chute é descontado. Nova aferição liberada em 90 dias.
      </p>

      <div className="mt-7 flex flex-wrap gap-2">
        {onExit && (
          <button onClick={onExit} className="btn-primary">
            Voltar ao painel
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="font-display mt-1.5 text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Rule({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="flex gap-3">
      <span className="font-display text-accent">{n}.</span>
      <span>{children}</span>
    </p>
  );
}

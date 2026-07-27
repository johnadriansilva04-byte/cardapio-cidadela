import { useState } from "react";

type Question = {
  id: number;
  question: string;
  options: string[];
  correct: number;
};

const QUESTIONS: Question[] = [
  {
    id: 1,
    question: "Qual número completa a sequência: 2, 6, 12, 20, 30, ?",
    options: ["40", "42", "44", "46"],
    correct: 1,
  },
  {
    id: 2,
    question: "Se todos os FEBs são pracinhas, e alguns pracinhas são veteranos, então:",
    options: [
      "Todos os FEBs são veteranos",
      "Alguns FEBs são veteranos",
      "Nenhum FEB é veterano",
      "Não é possível concluir",
    ],
    correct: 3,
  },
  {
    id: 3,
    question: "A cobra fumou em Monte Castelo. Se 'fumou' significa 'triunfou', então:",
    options: [
      "A cobra perdeu em Monte Castelo",
      "A cobra venceu em Monte Castelo",
      "A cobra não estava em Monte Castelo",
      "A cobra foi destruída",
    ],
    correct: 1,
  },
  {
    id: 4,
    question: "Qual palavra não pertence ao grupo: Honra, Dignidade, Brio, Covardia",
    options: ["Honra", "Dignidade", "Brio", "Covardia"],
    correct: 3,
  },
  {
    id: 5,
    question: "Se 3 soldados podem montar 1 trincheira em 2 horas, quanto tempo levam 6 soldados?",
    options: ["1 hora", "2 horas", "3 horas", "4 horas"],
    correct: 1,
  },
];

export function IQTest() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);

  function handleAnswer(optionIndex: number) {
    const newAnswers = [...answers, optionIndex];
    setAnswers(newAnswers);

    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowResult(true);
    }
  }

  function calculateScore() {
    return answers.reduce((score, answer, index) => {
      return score + (answer === QUESTIONS[index].correct ? 1 : 0);
    }, 0);
  }

  function getIQDescription(score: number) {
    const percentage = (score / QUESTIONS.length) * 100;
    if (percentage === 100) return "Gênio da FEB — Inteligência excepcional";
    if (percentage >= 80) return "Veterano Elite — Mente afiada";
    if (percentage >= 60) return "Pracinha Destacado — Acima da média";
    if (percentage >= 40) return "Soldado Capaz — Dentro da média";
    return "Recruta em treinamento — Continue estudando";
  }

  function restart() {
    setCurrentQuestion(0);
    setAnswers([]);
    setShowResult(false);
  }

  if (showResult) {
    const score = calculateScore();
    return (
      <div className="flex h-[calc(100vh-73px)] flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-xl border border-border bg-secondary p-8 text-center">
          <h2 className="text-stencil text-2xl">Resultado do Teste</h2>
          <div className="my-6">
            <p className="text-6xl font-bold text-[color:var(--brass)]">{score}/{QUESTIONS.length}</p>
            <p className="mt-2 text-lg text-muted-foreground">{getIQDescription(score)}</p>
          </div>
          <button
            type="button"
            onClick={restart}
            className="text-tech rounded-lg bg-[color:var(--brass)] px-6 py-3 text-sm text-[color:var(--matte)]"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const question = QUESTIONS[currentQuestion];

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-tech text-sm text-muted-foreground">
            Questão {currentQuestion + 1} de {QUESTIONS.length}
          </span>
          <div className="flex gap-1">
            {QUESTIONS.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full ${
                  index < currentQuestion
                    ? "bg-[color:var(--brass)]"
                    : index === currentQuestion
                    ? "bg-[color:var(--olive)]"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary p-8">
          <h2 className="text-stencil mb-6 text-xl">{question.question}</h2>
          <div className="space-y-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleAnswer(index)}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-left text-sm transition-all hover:border-[color:var(--brass)] hover:shadow-md"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

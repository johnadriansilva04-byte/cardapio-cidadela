export type IQResult = {
  iq: number;
  iqLow: number;
  iqHigh: number;
  theta: number;
  seTheta: number;
  rawScore: number;
  totalItems: number;
  percentile: number;
  classification: string;
};

export function scoreTest(attempts: { difficulty: number; correct: boolean }[]): IQResult {
  const totalItems = attempts.length;
  const rawScore = attempts.filter((a) => a.correct).length;

  // Theta estimation using simple logistic model
  let theta = 0;
  const a = 1.15; // discrimination
  const c = 0.125; // guessing parameter

  for (let i = 0; i < 10; i++) {
    let sum = 0;
    for (const attempt of attempts) {
      const p = c + (1 - c) / (1 + Math.exp(-a * (theta - attempt.difficulty)));
      sum += (attempt.correct ? 1 : 0) - p;
    }
    theta += sum / (a * totalItems);
  }

  // Standard error of theta
  let information = 0;
  for (const attempt of attempts) {
    const p = c + (1 - c) / (1 + Math.exp(-a * (theta - attempt.difficulty)));
    information += (a * a * (p - c) * (1 - p)) / ((1 - c) * (1 - c));
  }
  const seTheta = 1 / Math.sqrt(Math.max(information, 0.01));

  // Convert theta to IQ (Wechsler scale: mean=100, SD=15)
  const iq = 100 + theta * 15;
  const iqLow = iq - 1.96 * seTheta * 15;
  const iqHigh = iq + 1.96 * seTheta * 15;

  // Percentile calculation (approximate normal distribution)
  const z = theta;
  const percentile = 50 * (1 + Math.tanh(0.7 * z));

  // Classification
  let classification = "";
  if (iq >= 130) classification = "Muito Superior";
  else if (iq >= 120) classification = "Superior";
  else if (iq >= 110) classification = "Acima da Média";
  else if (iq >= 90) classification = "Média";
  else if (iq >= 80) classification = "Abaixo da Média";
  else if (iq >= 70) classification = "Limítrofe";
  else classification = "Deficiente Intelectual";

  return {
    iq: Math.round(iq),
    iqLow: Math.round(iqLow),
    iqHigh: Math.round(iqHigh),
    theta,
    seTheta,
    rawScore,
    totalItems,
    percentile: Math.round(percentile),
    classification,
  };
}

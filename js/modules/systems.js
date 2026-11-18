// Задачи на системы счисления. Здесь нет DOM: функции удобно проверять отдельно.
import { similarInteger } from "../similar-task.js";

const DIGITS = "0123456789ABCDEF";
const BASES = [2, 8, 10, 16];
const COMPARISON_BASES = [2, 8, 16];

function randomInteger(rng, minimum, maximum) {
  return Math.floor(rng() * (maximum - minimum + 1)) + minimum;
}

/** Переводит запись числа в десятичное значение и проверяет каждую цифру. */
export function toDecimal(text, base) {
  const normalized = String(text).trim().toUpperCase();
  if (![2, 8, 10, 16].includes(base) || normalized.length === 0) {
    throw new Error("Укажите число и основание 2, 8, 10 или 16.");
  }

  let value = 0;
  for (const character of normalized) {
    const digit = DIGITS.indexOf(character);
    if (digit < 0 || digit >= base) {
      throw new Error(`Цифра «${character}» не подходит для основания ${base}.`);
    }
    value = value * base + digit;
  }
  return value;
}

/** Делит число на основание и возвращает запись и шаги с остатками. */
export function fromDecimal(number, base) {
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error("Для этого тренажёра нужны целые числа от 0 и выше.");
  }
  if (![2, 8, 10, 16].includes(base)) {
    throw new Error("Поддерживаются основания 2, 8, 10 и 16.");
  }

  if (number === 0) {
    return { text: "0", steps: ["Ноль записывается как 0 в любой позиционной системе."] };
  }

  const remainders = [];
  const steps = [];
  let current = number;

  while (current > 0) {
    const quotient = Math.floor(current / base);
    const remainder = current % base;
    remainders.push(DIGITS[remainder]);
    const shownRemainder = remainder >= 10 ? `${remainder}₁₀ = ${DIGITS[remainder]}₁₆` : String(remainder);
    steps.push(`${current} ÷ ${base}: частное ${quotient}, остаток ${shownRemainder}.`);
    current = quotient;
  }

  return { text: remainders.reverse().join(""), steps };
}

function explainDecimalConversion(text, base, value) {
  const terms = [...text].map((digit, index) => `${DIGITS.indexOf(digit)} × ${base}^${text.length - index - 1}`);
  return `${text} (основание ${base}) = ${terms.join(" + ")} = ${value} (основание 10).`;
}

export function generateConversionTask(rng = Math.random, options = {}) {
  const reference = options.reference;
  const number = reference
    ? similarInteger(rng, reference.meta.number, reference.meta.divisions ? 12 : 0, reference.meta.divisions ? 255 : 1024, options.sourceBase)
    : randomInteger(rng, 0, 1024);
  const sourceBase = options.sourceBase ?? BASES[randomInteger(rng, 0, BASES.length - 1)];
  const targetBases = BASES.filter((base) => base !== sourceBase);
  const targetBase = options.targetBase ?? targetBases[randomInteger(rng, 0, targetBases.length - 1)];
  const source = fromDecimal(number, sourceBase).text;
  const converted = fromDecimal(number, targetBase);
  const sourceSteps = sourceBase === 10 ? [] : [explainDecimalConversion(source, sourceBase, number)];

  return {
    kind: "systems-conversion",
    input: { type: "text", label: "Запиши только цифры числа" },
    prompt: `Переведи число ${source} из основания ${sourceBase} в систему счисления с основанием ${targetBase}.`,
    answer: converted.text,
    hint: targetBase === 10 ? "Найди вклад каждого разряда и сложи их." : "Если число записано не в десятичной системе, сначала найди его десятичное значение. Затем дели на новое основание и читай остатки снизу вверх.",
    steps: [
      ...sourceSteps,
      ...(targetBase === 10 ? [`Ответ в десятичной системе: ${converted.text}.`] : [
        `Делим ${number} на ${targetBase} и записываем остатки.`,
        ...converted.steps,
        `Читаем остатки снизу вверх: ${converted.text}.`
      ])
    ],
    lessonExample: `Например, ${source} в основании ${sourceBase} имеет значение ${number} в десятичной системе. В основании ${targetBase} это ${converted.text}.`,
    meta: { number, source, sourceBase, targetBase }
  };
}

/** Создаёт десятичное число и шаги деления для учебного разбора. */
export function generateGuidedConversionTask(rng = Math.random) {
  const number = randomInteger(rng, 12, 255);
  const targetBases = [2, 8, 16];
  const targetBase = targetBases[randomInteger(rng, 0, targetBases.length - 1)];
  const converted = fromDecimal(number, targetBase);
  const divisions = [];
  let current = number;

  // Запоминаем каждое деление, чтобы ученик мог решить его отдельно.
  while (current > 0) {
    const quotient = Math.floor(current / targetBase);
    const remainder = current % targetBase;
    divisions.push({
      dividend: current,
      quotient,
      remainder: DIGITS[remainder]
    });
    current = quotient;
  }

  return {
    kind: "systems-conversion",
    input: { type: "text", label: "Запиши число в новом основании" },
    prompt: `Разберём перевод числа ${number} из десятичной системы в основание ${targetBase}.`,
    answer: converted.text,
    hint: `Частное - целая часть от деления на ${targetBase}. Остаток найди так: число − частное × ${targetBase}. Остаток всегда меньше основания.`,
    steps: [
      ...converted.steps,
      `Читаем остатки снизу вверх: ${converted.text}.`
    ],
    lessonExample: `Чтобы перевести ${number} в основание ${targetBase}, делим на ${targetBase} до частного 0, затем читаем остатки в обратном порядке.`,
    meta: {
      number,
      source: String(number),
      sourceBase: 10,
      targetBase,
      divisions
    }
  };
}

export function generateComparisonTask(rng = Math.random, reference = null) {
  // Сначала выбираем знак, иначе равные значения почти не встречаются.
  const relation = randomInteger(rng, 0, 2);
  let leftValue;
  let rightValue;

  if (relation === 0) {
    leftValue = randomInteger(rng, 0, 1023);
    rightValue = leftValue + randomInteger(rng, 1, 1024 - leftValue);
  } else if (relation === 1) {
    leftValue = randomInteger(rng, 0, 1024);
    rightValue = leftValue;
  } else {
    rightValue = randomInteger(rng, 0, 1023);
    leftValue = rightValue + randomInteger(rng, 1, 1024 - rightValue);
  }

  const leftBaseIndex = randomInteger(rng, 0, COMPARISON_BASES.length - 1);
  const rightBaseOffset = randomInteger(rng, 1, COMPARISON_BASES.length - 1);
  const leftBase = reference?.meta.leftBase ?? COMPARISON_BASES[leftBaseIndex];
  const rightBase = reference?.meta.rightBase ?? COMPARISON_BASES[(leftBaseIndex + rightBaseOffset) % COMPARISON_BASES.length];
  if (reference) {
    leftValue = similarInteger(rng, reference.meta.leftValue, 0, 1024, leftBase);
    rightValue = reference.meta.rightValue;
  }

  const left = fromDecimal(leftValue, leftBase).text;
  const right = fromDecimal(rightValue, rightBase).text;
  let answer = "=";
  if (leftValue < rightValue) answer = "<";
  else if (leftValue > rightValue) answer = ">";

  return {
    kind: "systems-comparison",
    input: { type: "choice", label: "Выбери знак сравнения", options: ["<", "=", ">"] },
    prompt: `Сравни числа: ${left} (основание ${leftBase}) и ${right} (основание ${rightBase}).`,
    answer,
    hint: "Переведи оба числа в одну систему счисления. Удобнее всего - в десятичную.",
    steps: [
      explainDecimalConversion(left, leftBase, leftValue),
      explainDecimalConversion(right, rightBase, rightValue),
      `Сравниваем ${leftValue} и ${rightValue}: знак ${answer}.`
    ],
    lessonExample: "Чтобы сравнить числа с разными основаниями, сначала переведи оба числа в общее основание.",
    meta: { left, leftBase, leftValue, right, rightBase, rightValue }
  };
}

export function generateTask(rng = Math.random) {
  return rng() < 0.55 ? generateConversionTask(rng) : generateComparisonTask(rng);
}

export function generateVariantTask(variantId, rng = Math.random, reference = null) {
  if (variantId === "compare") return generateComparisonTask(rng, reference);
  const match = variantId.match(/^convert-(2|8|10|16)-(2|8|10|16)$/);
  if (!match || match[1] === match[2]) throw new Error(`Неизвестный перевод: ${variantId}`);
  return generateConversionTask(rng, { sourceBase: Number(match[1]), targetBase: Number(match[2]), reference });
}

export function checkAnswer(task, answer) {
  const submitted = String(answer ?? "").trim().toUpperCase();
  if (!submitted) return { correct: false, empty: true, message: "Сначала введи ответ." };

  if (task.kind === "systems-conversion") {
    const clean = submitted.replace(/^0+(?=.)/, "");
    const expected = task.answer.replace(/^0+(?=.)/, "");
    const validDigits = [...submitted].every((character) => DIGITS.indexOf(character) >= 0 && DIGITS.indexOf(character) < task.meta.targetBase);
    const correct = validDigits && clean === expected;
    return { correct, message: correct ? "Верно: все цифры записаны в нужном основании." : "Проверь основание и порядок остатков." };
  }

  const correct = submitted === task.answer;
  return { correct, message: correct ? "Верно: сначала перевели оба числа в общее основание." : "Сравни десятичные значения ещё раз." };
}

export const lesson = {
  title: "Как читать и переводить числа",
  description: "Основание показывает, сколько цифр доступно для записи. В двоичной системе это 0 и 1, в восьмеричной - 0–7, в десятичной - 0–9, в шестнадцатеричной - 0–9 и A–F.",
  points: [
    "Буквы в шестнадцатеричной системе обозначают значения: A = 10, B = 11, C = 12, D = 13, E = 14, F = 15 в десятичной системе.",
    "Чтобы перевести число в десятичную систему, умножь каждую цифру на основание в степени её разряда и сложи результаты. Степени считаются справа с нуля.",
    "Например, 1011₂ = 1 × 2³ + 0 × 2² + 1 × 2¹ + 1 × 2⁰ = 11₁₀.",
    "Для перевода из десятичной системы дели число на новое основание до частного 0, затем читай остатки снизу вверх. Например, остаток 15 записывается как F в шестнадцатеричной системе.",
    "Чтобы сравнить записи с разными основаниями, переведи их в одно основание и сравни полученные значения."
  ]
};

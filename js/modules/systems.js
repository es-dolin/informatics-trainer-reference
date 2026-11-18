// Задачи на системы счисления. Здесь нет DOM: функции удобно проверять отдельно.

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
    steps.push(`${current} ÷ ${base} = ${quotient}, остаток ${DIGITS[remainder]}.`);
    current = quotient;
  }

  return { text: remainders.reverse().join(""), steps };
}

export function generateConversionTask(rng = Math.random) {
  const number = randomInteger(rng, 0, 1024);
  const sourceBase = BASES[randomInteger(rng, 0, BASES.length - 1)];
  const targetBases = BASES.filter((base) => base !== sourceBase);
  const targetBase = targetBases[randomInteger(rng, 0, targetBases.length - 1)];
  const source = fromDecimal(number, sourceBase).text;
  const converted = fromDecimal(number, targetBase);
  const sourceSteps = sourceBase === 10 ? [] : [`Сначала переводим исходную запись ${source} из основания ${sourceBase} в десятичную систему: ${number}.`];

  return {
    kind: "systems-conversion",
    input: { type: "text", label: "Запиши только цифры числа" },
    prompt: `Переведи число ${source} из основания ${sourceBase} в систему счисления с основанием ${targetBase}.`,
    answer: converted.text,
    hint: "Если число уже не в десятичной системе, сначала найди его десятичное значение. Затем дели на новое основание и читай остатки снизу вверх.",
    steps: [
      ...sourceSteps,
      `Делим ${number} на ${targetBase} и записываем остатки.`,
      ...converted.steps,
      `Читаем остатки снизу вверх: ${converted.text}.`
    ],
    lessonExample: `Например, ${source} в основании ${sourceBase} имеет значение ${number} в десятичной системе. В основании ${targetBase} это ${converted.text}.`,
    meta: { number, source, sourceBase, targetBase }
  };
}

export function generateComparisonTask(rng = Math.random) {
  const leftValue = randomInteger(rng, 0, 1024);
  let rightValue = randomInteger(rng, 0, 1024);
  if (rightValue === leftValue) rightValue = (rightValue + 1) % 1025;

  const leftBase = COMPARISON_BASES[randomInteger(rng, 0, COMPARISON_BASES.length - 1)];
  let rightBase = COMPARISON_BASES[randomInteger(rng, 0, COMPARISON_BASES.length - 1)];
  if (rightBase === leftBase) rightBase = COMPARISON_BASES[(COMPARISON_BASES.indexOf(rightBase) + 1) % COMPARISON_BASES.length];

  const left = fromDecimal(leftValue, leftBase).text;
  const right = fromDecimal(rightValue, rightBase).text;
  const answer = leftValue < rightValue ? "<" : ">";

  return {
    kind: "systems-comparison",
    input: { type: "choice", label: "Выбери знак сравнения", options: ["<", "=", ">"] },
    prompt: `Сравни числа: ${left} (основание ${leftBase}) и ${right} (основание ${rightBase}).`,
    answer,
    hint: "Переведи оба числа в одну систему счисления. Удобнее всего — в десятичную.",
    steps: [
      `${left} в основании ${leftBase} = ${leftValue} в десятичной системе.`,
      `${right} в основании ${rightBase} = ${rightValue} в десятичной системе.`,
      `Сравниваем ${leftValue} и ${rightValue}: знак ${answer}.`
    ],
    lessonExample: "Чтобы сравнить числа с разными основаниями, сначала переведи оба числа в общее основание.",
    meta: { left, leftBase, leftValue, right, rightBase, rightValue }
  };
}

export function generateTask(rng = Math.random) {
  return rng() < 0.55 ? generateConversionTask(rng) : generateComparisonTask(rng);
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
  description: "Основание показывает, сколько разных цифр используется в записи. В двоичной системе это 0 и 1, в восьмеричной — цифры от 0 до 7, в шестнадцатеричной — цифры 0–9 и буквы A–F.",
  points: [
    "Для перевода в десятичную систему разложи число на разряды и умножь цифру на основание в степени номера разряда.",
    "Для перевода из десятичной системы дели число на новое основание и собирай остатки снизу вверх.",
    "Чтобы сравнить записи с разными основаниями, переведи их в одно основание и сравни полученные значения."
  ]
};


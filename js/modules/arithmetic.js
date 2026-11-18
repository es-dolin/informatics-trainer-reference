// Арифметические задачи в восьмеричной, шестнадцатеричной и двоичной системах.
import { fromDecimal, toDecimal } from "./systems.js";
import { similarInteger } from "../similar-task.js";

const DIGITS = "0123456789ABCDEF";

function randomInteger(rng, minimum, maximum) {
  return Math.floor(rng() * (maximum - minimum + 1)) + minimum;
}

function digitValue(character) {
  return DIGITS.indexOf(character);
}

function addColumnSteps(left, right, base) {
  const width = Math.max(left.length, right.length);
  const a = left.padStart(width, "0");
  const b = right.padStart(width, "0");
  const notes = [];
  let carry = 0;

  for (let index = width - 1; index >= 0; index -= 1) {
    const incomingCarry = carry;
    const column = digitValue(a[index]) + digitValue(b[index]) + incomingCarry;
    const digit = column % base;
    const nextCarry = Math.floor(column / base);
    notes.push(`Разряд ${width - index} справа: значения цифр ${digitValue(a[index])}₁₀ + ${digitValue(b[index])}₁₀${incomingCarry ? ` + перенос ${incomingCarry}` : ""} = ${column}₁₀. В основании ${base} это ${fromDecimal(column, base).text}; записываем ${DIGITS[digit]}${nextCarry ? `, переносим ${nextCarry}` : ""}.`);
    carry = nextCarry;
  }
  if (carry) notes.push(`Остался перенос ${carry}, записываем его слева.`);
  return notes;
}

function subtractColumnSteps(left, right, base) {
  const width = Math.max(left.length, right.length);
  const a = left.padStart(width, "0");
  const b = right.padStart(width, "0");
  const notes = [];
  let borrow = 0;

  for (let index = width - 1; index >= 0; index -= 1) {
    const incomingBorrow = borrow;
    const top = digitValue(a[index]) - incomingBorrow;
    const bottom = digitValue(b[index]);
    const didBorrow = top < bottom;
    const resultDigit = didBorrow ? top + base - bottom : top - bottom;
    borrow = didBorrow ? 1 : 0;
    notes.push(`Разряд ${width - index} справа: значения цифр ${digitValue(a[index])}₁₀ − займ ${incomingBorrow} − ${digitValue(b[index])}₁₀${didBorrow ? ` + ${base}₁₀` : ""} = ${resultDigit}₁₀; записываем ${DIGITS[resultDigit]}${didBorrow ? ", занимаем единицу старшего разряда" : ""}.`);
  }
  return notes;
}

function cleanNumber(text) {
  const normalized = String(text ?? "").trim().toUpperCase();
  return normalized.replace(/^0+(?=.)/, "");
}

function generateOtherBaseTask(rng, options = {}) {
  const base = options.base ?? (rng() < 0.5 ? 8 : 16);
  const operation = options.operation ?? (rng() < 0.5 ? "+" : "−");
  const reference = options.reference;
  let leftValue = reference ? similarInteger(rng, reference.meta.leftValue, 8, 150, base) : randomInteger(rng, 8, 150);
  let rightValue = reference?.meta.rightValue ?? randomInteger(rng, 2, 90);
  if (operation === "−" && rightValue > leftValue) [leftValue, rightValue] = [rightValue, leftValue];

  const left = fromDecimal(leftValue, base).text;
  const right = fromDecimal(rightValue, base).text;
  const result = operation === "+" ? leftValue + rightValue : leftValue - rightValue;
  const answer = fromDecimal(result, base).text;
  const columnSteps = operation === "+" ? addColumnSteps(left, right, base) : subtractColumnSteps(left, right, base);

  return {
    kind: "arithmetic-other-base",
    input: { type: "text", label: "Запиши результат в той же системе" },
    prompt: `Вычисли: ${left} ${operation} ${right} (основание ${base}).`,
    answer,
    hint: operation === "+" ? "Сложи цифры справа налево. Если сумма достигает основания, запиши остаток и перенеси единицу влево." : "Вычитай справа налево. Если верхней цифры не хватает, займи единицу старшего разряда: она добавит к текущему основание системы.",
    steps: [
      ...columnSteps,
      `Проверка: ${leftValue} ${operation === "−" ? "−" : "+"} ${rightValue} = ${result} в десятичной системе.`,
      `Ответ в основании ${base}: ${answer}.`
    ],
    lessonExample: `В основаниях выше 10 буквы A–F обозначают значения 10–15. Перенос происходит, когда сумма достигает основания ${base}.`,
    meta: { base, left, right, leftValue, rightValue, operation, result }
  };
}

function generateBinaryTask(rng, options = {}) {
  const operations = ["+", "−", "×", "÷"];
  const operation = options.operation ?? operations[randomInteger(rng, 0, operations.length - 1)];
  const reference = options.reference;
  let leftValue;
  let rightValue;

  if (operation === "÷") {
    rightValue = reference?.meta.rightValue ?? randomInteger(rng, 2, 12);
    const quotient = reference ? similarInteger(rng, reference.meta.result, 2, 12, 2) : randomInteger(rng, 2, 12);
    leftValue = rightValue * quotient;
  } else {
    leftValue = reference ? similarInteger(rng, reference.meta.leftValue, 2, 24, 2) : randomInteger(rng, 2, 24);
    rightValue = reference?.meta.rightValue ?? randomInteger(rng, 2, 20);
    if (operation === "−" && rightValue > leftValue) [leftValue, rightValue] = [rightValue, leftValue];
  }

  let result;
  if (operation === "+") result = leftValue + rightValue;
  else if (operation === "−") result = leftValue - rightValue;
  else if (operation === "×") result = leftValue * rightValue;
  else result = leftValue / rightValue;

  const left = fromDecimal(leftValue, 2).text;
  const right = fromDecimal(rightValue, 2).text;
  const answer = fromDecimal(result, 2).text;
  let steps;

  if (operation === "+") {
    steps = addColumnSteps(left, right, 2);
  } else if (operation === "−") {
    steps = subtractColumnSteps(left, right, 2);
  } else if (operation === "×") {
    const partials = [...right].reverse().map((bit, position) => bit === "1" ? `${left} со сдвигом на ${position}: ${fromDecimal(leftValue * 2 ** position, 2).text}` : null).filter(Boolean);
    steps = [`Умножаем двоичные числа столбиком.`, ...partials.map((item) => `Частичное произведение: ${item}.`), `Складываем частичные произведения: ${answer}₂ = ${result}₁₀.`];
  } else {
    steps = [`Переводим делимое: ${left}₂ = ${leftValue}₁₀; делитель: ${right}₂ = ${rightValue}₁₀.`, `${leftValue}₁₀ ÷ ${rightValue}₁₀ = ${result}₁₀; деление без остатка.`, `Переводим ${result}₁₀ в двоичную систему: ${answer}₂.`];
  }

  return {
    kind: "arithmetic-binary",
    input: { type: "text", label: "Запиши ответ двоичными цифрами" },
    prompt: `Вычисли в двоичной системе: ${left} ${operation} ${right}.`,
    answer,
    hint: operation === "÷" ? "Переведи числа в десятичную систему, выполни деление, затем переведи ответ обратно." : operation === "×" ? "Найди частичные произведения для каждой цифры множителя, сдвинь их и сложи." : "Решай справа налево и следи за переносами или займами.",
    steps: [...steps, `Ответ: ${answer}₂.`],
    lessonExample: "Для умножения каждый разряд множителя даёт частичное произведение. При делении сначала проверяем, как делятся значения чисел.",
    meta: { base: 2, left, right, leftValue, rightValue, operation, result }
  };
}

export function generateTask(rng = Math.random) {
  return rng() < 0.48 ? generateOtherBaseTask(rng) : generateBinaryTask(rng);
}

export function generateVariantTask(variantId, rng = Math.random, reference = null) {
  const match = variantId.match(/^(add|subtract|multiply|divide)-(2|8|16)$/);
  if (!match) throw new Error(`Неизвестная арифметическая задача: ${variantId}`);
  const operation = { add: "+", subtract: "−", multiply: "×", divide: "÷" }[match[1]];
  const base = Number(match[2]);
  if (base !== 2 && !["+", "−"].includes(operation)) throw new Error(`Операция ${operation} не поддерживается в основании ${base}.`);
  const options = { base, operation, reference };
  return base === 2 ? generateBinaryTask(rng, options) : generateOtherBaseTask(rng, options);
}

export function checkAnswer(task, answer) {
  const submitted = cleanNumber(answer);
  if (!submitted) return { correct: false, empty: true, message: "Сначала введи ответ." };
  try {
    const numericAnswer = toDecimal(submitted, task.meta.base);
    const correct = numericAnswer === task.meta.result;
    return { correct, message: correct ? "Верно. Разряды и основание учтены правильно." : "Проверь результат по разрядам и переносам." };
  } catch {
    return { correct: false, message: `Используй только цифры, допустимые в основании ${task.meta.base}.` };
  }
}

export const lesson = {
  title: "Считаем в разных основаниях",
  description: "Считать столбиком можно в любой системе счисления. Основание определяет доступные цифры и то, когда возникает перенос или займ.",
  points: [
    "При сложении, если сумма достигает основания, запиши остаток и перенеси единицу в следующий разряд: 7₈ + 1₈ = 10₈; F₁₆ + 1₁₆ = 10₁₆.",
    "A, B, C, D, E, F в шестнадцатеричной записи обозначают десятичные значения 10, 11, 12, 13, 14, 15.",
    "При вычитании займём единицу старшего разряда: она добавляет к текущему основание системы. Если слева ноль, займ проходит дальше через него.",
    "Например, 1000₂ − 1₂ = 111₂: займ от единицы проходит через два нуля, прежде чем попасть в крайний правый разряд.",
    "При двоичном умножении сдвигай и складывай частичные произведения. Деление здесь разбираем через десятичную систему; во всех примерах частное целое."
  ]
};

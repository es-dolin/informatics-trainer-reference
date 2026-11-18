// Арифметические задачи в восьмеричной, шестнадцатеричной и двоичной системах.
import { fromDecimal, toDecimal } from "./systems.js";

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
    notes.push(`Разряд ${width - index}: ${a[index]} + ${b[index]}${incomingCarry ? ` + перенос ${incomingCarry}` : ""} = ${column}; записываем ${DIGITS[digit]}${nextCarry ? `, переносим ${nextCarry}` : ""}.`);
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
    notes.push(`Разряд ${width - index}: ${digitValue(a[index])} − займ ${incomingBorrow} − ${digitValue(b[index])}${didBorrow ? ` + основание ${base}` : ""} = ${resultDigit}; записываем ${DIGITS[resultDigit]}${didBorrow ? ", занимаем 1 разряд слева" : ""}.`);
  }
  return notes;
}

function cleanNumber(text) {
  const normalized = String(text ?? "").trim().toUpperCase();
  return normalized.replace(/^0+(?=.)/, "");
}

function generateOtherBaseTask(rng) {
  const base = rng() < 0.5 ? 8 : 16;
  const operation = rng() < 0.5 ? "+" : "−";
  let leftValue = randomInteger(rng, 8, 150);
  let rightValue = randomInteger(rng, 2, 90);
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
    hint: operation === "+" ? "Сложи цифры справа налево. Если сумма не помещается в один разряд, перенеси единицу влево." : "Вычитай справа налево. Если верхняя цифра меньше нижней, займи один разряд слева.",
    steps: [
      ...columnSteps,
      `Проверка: ${leftValue} ${operation === "−" ? "−" : "+"} ${rightValue} = ${result} в десятичной системе.`,
      `Ответ в основании ${base}: ${answer}.`
    ],
    lessonExample: `В основаниях выше 10 буквы A–F обозначают значения 10–15. Перенос происходит, когда сумма достигает основания ${base}.`,
    meta: { base, left, right, leftValue, rightValue, operation, result }
  };
}

function generateBinaryTask(rng) {
  const operations = ["+", "−", "×", "÷"];
  const operation = operations[randomInteger(rng, 0, operations.length - 1)];
  let leftValue;
  let rightValue;

  if (operation === "÷") {
    rightValue = randomInteger(rng, 2, 12);
    leftValue = rightValue * randomInteger(rng, 2, 12);
  } else {
    leftValue = randomInteger(rng, 2, 24);
    rightValue = randomInteger(rng, 2, 20);
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
    steps = [`Умножаем двоичные числа как обычные столбиком.`, ...partials.map((item) => `Частичное произведение: ${item}.`), `Складываем частичные произведения: ${result} в десятичной системе.`];
  } else {
    steps = [`Переводим делимое: ${left}₂ = ${leftValue}; делитель: ${right}₂ = ${rightValue}.`, `${leftValue} ÷ ${rightValue} = ${result}; деление подобрано без остатка.`, `Переводим ${result} в двоичную систему: ${answer}.`];
  }

  return {
    kind: "arithmetic-binary",
    input: { type: "text", label: "Запиши ответ двоичными цифрами" },
    prompt: `Вычисли в двоичной системе: ${left} ${operation} ${right}.`,
    answer,
    hint: operation === "÷" ? "Переведи числа в десятичную систему, выполни деление, затем переведи ответ обратно." : "Решай справа налево и следи за переносами или заимствованиями.",
    steps: [...steps, `Ответ: ${answer}₂.`],
    lessonExample: "Для умножения каждый разряд множителя даёт частичное произведение. При делении сначала проверяем, как делятся значения чисел.",
    meta: { base: 2, left, right, leftValue, rightValue, operation, result }
  };
}

export function generateTask(rng = Math.random) {
  return rng() < 0.48 ? generateOtherBaseTask(rng) : generateBinaryTask(rng);
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
  description: "Арифметические правила знакомы: складывать, вычитать, умножать и делить можно в любой позиционной системе. Меняется размер основания, а вместе с ним - переносы и заимствования.",
  points: [
    "При сложении переносим разряд, когда сумма достигает основания системы.",
    "При вычитании, если цифры не хватает, занимаем один разряд слева - это добавляет к цифре величину основания.",
    "В двоичном умножении складываем частичные произведения. В тренировочных примерах деление подобрано так, чтобы ответ был целым числом."
  ]
};

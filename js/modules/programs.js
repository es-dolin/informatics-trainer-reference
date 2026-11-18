// Модуль показывает короткие заранее заданные программы. Здесь нет eval и нет
// исполнения строки из поля ответа: каждый шаблон симулируется своей функцией.
import { differentInteger } from "../similar-task.js";

function randomInteger(rng, minimum, maximum) {
  return Math.floor(rng() * (maximum - minimum + 1)) + minimum;
}

function makeConditionTask(rng, reference = null) {
  const limit = reference ? differentInteger(rng, 4, 12, reference.meta.limit) : randomInteger(rng, 4, 12);
  const cases = [
    { s: limit + 2, t: limit - 1 }, // условие ложно: это гарантированный ответ NO
    { s: limit - 1, t: limit + 2 }, // первое условие истинно
    { s: limit + 1, t: limit + 1 },
    { s: randomInteger(rng, -5, 20), t: randomInteger(rng, -5, 20) },
    { s: randomInteger(rng, -5, 20), t: randomInteger(rng, -5, 20) }
  ];

  const runs = cases.map((item) => {
    const firstIsTrue = item.s < limit;
    const secondIsTrue = item.t > limit;
    const output = firstIsTrue || secondIsTrue ? "YES" : "NO";
    return { ...item, firstIsTrue, secondIsTrue, output };
  });
  const answer = runs.map((run, index) => run.output === "NO" ? String(index + 1) : null).filter(Boolean);

  return {
    kind: "program-condition",
    input: { type: "multi-choice", label: "Отметь все номера запусков", options: runs.map((run, index) => ({ value: String(index + 1), label: `${index + 1}. (s, t) = (${run.s}, ${run.t})` })) },
    prompt: "Какие запуски напечатают NO? Выбери все подходящие номера.",
    answer,
    code: `s = int(input())\nt = int(input())\nif (s < ${limit}) or (t > ${limit}):\n    print("YES")\nelse:\n    print("NO")`,
    hint: "NO печатается только тогда, когда обе части условия ложны.",
    steps: runs.map((run, index) => `Запуск ${index + 1}: s < ${limit} - ${run.firstIsTrue ? "истина" : "ложь"}; t > ${limit} - ${run.secondIsTrue ? "истина" : "ложь"}; программа печатает ${run.output}.`),
    lessonExample: "Условие с ИЛИ истинно, если истинна хотя бы одна его часть. Ветку else программа выбирает, когда всё условие ложно.",
    meta: { limit, runs }
  };
}

function makeLoopTask(rng, reference = null) {
  const length = reference?.meta.numbers.length ?? randomInteger(rng, 3, 5);
  const numbers = Array.from({ length }, () => randomInteger(rng, 1, 9));
  if (reference) numbers[0] = differentInteger(rng, 1, 9, reference.meta.numbers[0]);
  let total = 0;
  const trace = numbers.map((number, index) => {
    total += number;
    return `Шаг ${index + 1}: total = ${total - number} + ${number} = ${total}.`;
  });

  return {
    kind: "program-loop",
    input: { type: "text", label: "Какое число напечатает программа?" },
    prompt: "Проследи, как меняется total на каждом повторе цикла. Какое число напечатает программа?",
    answer: String(total),
    code: `total = 0\nfor item in [${numbers.join(", ")}]:\n    total = total + item\nprint(total)`,
    hint: "Начни с total = 0 и прибавь очередной элемент списка на каждом шаге цикла.",
    steps: [...trace, `После цикла программа печатает ${total}.`],
    lessonExample: "Цикл проходит по элементам списка. Переменная total хранит накопленный результат и меняется на каждом повторе.",
    meta: { numbers, total }
  };
}

export function generateTask(rng = Math.random) {
  return rng() < 0.7 ? makeConditionTask(rng) : makeLoopTask(rng);
}

export function generateVariantTask(variantId, rng = Math.random, reference = null) {
  if (variantId === "condition") return makeConditionTask(rng, reference);
  if (variantId === "loop") return makeLoopTask(rng, reference);
  throw new Error(`Неизвестный тип программы: ${variantId}`);
}

export function simulateCondition(limit, s, t) {
  const checks = { first: s < limit, second: t > limit };
  return { ...checks, output: checks.first || checks.second ? "YES" : "NO" };
}

export function checkAnswer(task, answer) {
  if (task.kind === "program-condition") {
    const selected = Array.isArray(answer) ? answer.map(String).sort() : [];
    if (selected.length === 0) return { correct: false, empty: true, message: "Отметь хотя бы один запуск." };
    const expected = [...task.answer].sort();
    const correct = selected.length === expected.length && selected.every((value, index) => value === expected[index]);
    return { correct, message: correct ? "Верно: выбраны все и только те запуски, где напечатано NO." : "Проверь каждую часть условия отдельно для каждого запуска." };
  }

  const submitted = String(answer ?? "").trim();
  if (!submitted) return { correct: false, empty: true, message: "Введи число, которое напечатает программа." };
  const correct = /^-?\d+$/.test(submitted) && Number(submitted) === Number(task.answer);
  return { correct, message: correct ? "Верно: цикл выполнен по всем элементам." : "Пересчитай значение переменной после каждой итерации." };
}

export const lesson = {
  title: "Читаем программу по шагам",
  description: "Выполняй команды по порядку и записывай, как меняются значения переменных. Так можно узнать, что напечатает программа.",
  points: [
    "input() получает введённое значение, int() превращает его в целое число, а print() выводит результат.",
    "if проверяет условие: при истине выполняются команды под if, иначе - команды под else. Отступы показывают, какие команды относятся к ветке.",
    "or означает ИЛИ: всё условие истинно, если истинна хотя бы одна его часть. YES и NO в этих заданиях - текст, который печатает программа.",
    "Переменная хранит значение. Например, total = 0 записывает в total число 0, а total = total + item прибавляет к прежнему total значение item.",
    "Цикл for item in [...] по очереди берёт числа из списка. После каждого повтора запиши новое значение total."
  ]
};

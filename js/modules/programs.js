// Модуль показывает короткие заранее заданные программы. Здесь нет eval и нет
// исполнения строки из поля ответа: каждый шаблон симулируется своей функцией.

function randomInteger(rng, minimum, maximum) {
  return Math.floor(rng() * (maximum - minimum + 1)) + minimum;
}

function makeConditionTask(rng) {
  const limit = randomInteger(rng, 4, 12);
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
    prompt: `Какие запуски напечатают NO? Выбери все подходящие номера. Порог k = ${limit}.`,
    answer,
    code: `s = int(input())\nt = int(input())\nif (s < ${limit}) or (t > ${limit}):\n    print("YES")\nelse:\n    print("NO")`,
    hint: "NO печатается только тогда, когда обе части условия ложны.",
    steps: runs.map((run, index) => `Запуск ${index + 1}: s < ${limit} — ${run.firstIsTrue ? "истина" : "ложь"}; t > ${limit} — ${run.secondIsTrue ? "истина" : "ложь"}; программа печатает ${run.output}.`),
    lessonExample: "Условие с ИЛИ истинно, если истинна хотя бы одна его часть. Ветку else программа выбирает, когда всё условие ложно.",
    meta: { limit, runs }
  };
}

function makeLoopTask(rng) {
  const numbers = Array.from({ length: randomInteger(rng, 3, 5) }, () => randomInteger(rng, 1, 9));
  let total = 0;
  const trace = numbers.map((number, index) => {
    total += number;
    return `Шаг ${index + 1}: total = ${total - number} + ${number} = ${total}.`;
  });

  return {
    kind: "program-loop",
    input: { type: "text", label: "Какое число напечатает программа?" },
    prompt: "Проследи за значением total на каждой итерации и предскажи вывод.",
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
  description: "Компьютер выполняет команды в заданном порядке. При анализе программы записывай входные данные, значения переменных, результат условия и вывод.",
  points: [
    "Условие сравнивает значения и возвращает истину или ложь.",
    "Ветвление выбирает одну из двух частей программы.",
    "В цикле состояние меняется на каждом повторе. В этом модуле используются только фиксированные шаблоны и заранее описанные правила их симуляции."
  ]
};

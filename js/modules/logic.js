// Логические выражения представлены деревом. Это позволяет вычислять их
// безопасно, не превращая текст задания в выполняемый JavaScript.

const VARIABLE_NAMES = ["A", "B", "C"];

function randomInteger(rng, minimum, maximum) {
  return Math.floor(rng() * (maximum - minimum + 1)) + minimum;
}

export function variable(name) {
  return { type: "variable", name };
}

export function not(child) {
  return { type: "not", child };
}

export function and(left, right) {
  return { type: "and", left, right };
}

export function or(left, right) {
  return { type: "or", left, right };
}

/** Вычисляет дерево выражения, выбирая действие по типу узла. */
export function evaluateExpression(expression, values) {
  if (expression.type === "variable") return Boolean(values[expression.name]);
  if (expression.type === "not") return !evaluateExpression(expression.child, values);

  const leftValue = evaluateExpression(expression.left, values);
  const rightValue = evaluateExpression(expression.right, values);
  if (expression.type === "and") return leftValue && rightValue;
  if (expression.type === "or") return leftValue || rightValue;
  throw new Error(`Неизвестная логическая операция: ${expression.type}`);
}

/** Вычисляет выражение и сохраняет промежуточные значения его частей. */
export function evaluateWithSteps(expression, values) {
  if (expression.type === "variable") {
    return { value: Boolean(values[expression.name]), steps: [] };
  }
  if (expression.type === "not") {
    const child = evaluateWithSteps(expression.child, values);
    const value = !child.value;
    return { value, steps: [...child.steps, `¬${formatExpression(expression.child)} = ${value ? "1" : "0"}`] };
  }

  const left = evaluateWithSteps(expression.left, values);
  const right = evaluateWithSteps(expression.right, values);
  let value;
  if (expression.type === "and") value = left.value && right.value;
  else if (expression.type === "or") value = left.value || right.value;
  else throw new Error(`Неизвестная логическая операция: ${expression.type}`);

  const sign = expression.type === "and" ? "∧" : "∨";
  const displayValue = (part) => part ? "1" : "0";
  const step = `(${formatExpression(expression.left)} ${sign} ${formatExpression(expression.right)}) = ${displayValue(value)}`;
  return { value, steps: [...left.steps, ...right.steps, step] };
}

export function formatExpression(expression) {
  if (expression.type === "variable") return expression.name;
  if (expression.type === "not") return `¬${formatExpression(expression.child)}`;
  const sign = expression.type === "and" ? "∧" : "∨";
  return `(${formatExpression(expression.left)} ${sign} ${formatExpression(expression.right)})`;
}

export function buildTruthTable(expression, variables) {
  const rowCount = 2 ** variables.length;
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const values = {};
    variables.forEach((name, variableIndex) => {
      const bitPosition = variables.length - variableIndex - 1;
      values[name] = (rowIndex >> bitPosition) & 1;
    });
    return { values, result: evaluateExpression(expression, values) ? "1" : "0" };
  });
}

function randomExpression(rng, variableNames) {
  const first = variable(variableNames[randomInteger(rng, 0, variableNames.length - 1)]);
  const second = variable(variableNames[randomInteger(rng, 0, variableNames.length - 1)]);
  const third = variable(variableNames[randomInteger(rng, 0, variableNames.length - 1)]);
  const firstOperation = rng() < 0.5 ? and : or;
  const secondOperation = rng() < 0.5 ? and : or;
  return secondOperation(not(first), firstOperation(second, not(third)));
}

function makeEvaluationTask(rng) {
  const expression = randomExpression(rng, VARIABLE_NAMES.slice(0, 2));
  const values = {
    A: randomInteger(rng, 0, 1),
    B: randomInteger(rng, 0, 1)
  };
  const calculation = evaluateWithSteps(expression, values);
  const result = calculation.value ? "1" : "0";

  return {
    kind: "logic-value",
    input: { type: "choice", label: "Выбери значение", options: [{ value: "1", label: "Истина · 1" }, { value: "0", label: "Ложь · 0" }] },
    prompt: `Вычисли ${formatExpression(expression)} при A = ${values.A} и B = ${values.B}.`,
    answer: result,
    hint: "Сначала выполни НЕ, затем И, потом ИЛИ. Скобки имеют приоритет.",
    steps: [
      `Заменяем A на ${values.A}, B на ${values.B}.`,
      ...calculation.steps,
      `Ответ: ${result === "1" ? "истина" : "ложь"}.`
    ],
    lessonExample: "И (∧) истинно, только когда истинны обе части. ИЛИ (∨) истинно, когда истинна хотя бы одна часть. НЕ (¬) меняет значение на противоположное.",
    meta: { expression, values }
  };
}

function makeTableTask(variableCount) {
  const variables = VARIABLE_NAMES.slice(0, variableCount);
  let expression;
  if (variableCount === 2) {
    expression = or(variable("A"), not(variable("B")));
  } else {
    // Такая форма показывает приоритет НЕ, И и ИЛИ на трёх переменных.
    expression = and(or(not(variable("A")), and(variable("B"), not(variable("C")))), variable("C"));
  }
  const rows = buildTruthTable(expression, variables);
  const answers = rows.map((row) => row.result);
  const expressionText = formatExpression(expression);

  return {
    kind: variableCount === 2 ? "logic-table-two" : "logic-table-three",
    input: { type: "truth-table", variables, rows: rows.map((row) => row.values) },
    prompt: `Заполни столбец результата для выражения ${expressionText}.`,
    answer: answers,
    hint: "Заполняй строки по порядку. В каждой строке подставь значения переменных и соблюдай приоритет операций.",
    steps: rows.map((row, index) => {
      const assignment = variables.map((name) => `${name}=${row.values[name]}`).join(", ");
      const calculation = evaluateWithSteps(expression, row.values);
      return `Строка ${index + 1} (${assignment}): ${[...calculation.steps, `итог ${row.result}`].join("; ")}.`;
    }),
    lessonExample: `Сначала вычисляй отрицания, затем выражения в скобках, потом итог. Переменные в таблице перебираются от ${"0".repeat(variableCount)} до ${"1".repeat(variableCount)}.`,
    meta: { expression, variables, rows }
  };
}

export function generateTask(rng = Math.random) {
  const choice = randomInteger(rng, 0, 2);
  if (choice === 0) return makeEvaluationTask(rng);
  if (choice === 1) return makeTableTask(2);
  return makeTableTask(3);
}

export function checkAnswer(task, answer) {
  if (task.input.type === "truth-table") {
    const submitted = Array.isArray(answer) ? answer.map((value) => String(value ?? "").trim()) : [];
    if (submitted.length !== task.answer.length || submitted.some((value) => value === "")) {
      return { correct: false, empty: true, message: "Заполни результат в каждой строке таблицы." };
    }
    const correctRows = submitted.reduce((count, value, index) => count + (value === task.answer[index] ? 1 : 0), 0);
    return {
      correct: correctRows === task.answer.length,
      partial: correctRows > 0 && correctRows < task.answer.length,
      correctRows,
      totalRows: task.answer.length,
      message: correctRows === task.answer.length ? "Все строки вычислены верно." : `Верно строк: ${correctRows} из ${task.answer.length}. Проверь приоритет операций.`
    };
  }

  const submitted = String(answer ?? "").trim();
  if (!submitted) return { correct: false, empty: true, message: "Выбери ответ." };
  const correct = submitted === task.answer;
  return { correct, message: correct ? "Верно: значение выражения вычислено правильно." : "Проверь значения переменных и порядок операций." };
}

export const lesson = {
  title: "Логика - это точные правила",
  description: "Логическое выражение получает значения 0 или 1. Чтобы посчитать результат, подставь значения переменных и выполняй операции в установленном порядке.",
  points: [
    "НЕ меняет 0 на 1, а 1 на 0.",
    "И даёт 1 только для пары 1 и 1. ИЛИ даёт 0 только для пары 0 и 0.",
    "Приоритет без скобок: сначала НЕ, затем И, затем ИЛИ. Для таблицы истинности перебирай все сочетания переменных."
  ]
};

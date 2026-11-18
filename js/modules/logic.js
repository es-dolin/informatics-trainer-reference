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

function makeEvaluationTask(rng, reference = null) {
  const expression = reference?.meta.expression ?? randomExpression(rng, VARIABLE_NAMES.slice(0, 2));
  const values = reference ? { ...reference.meta.values } : {
    A: randomInteger(rng, 0, 1),
    B: randomInteger(rng, 0, 1)
  };
  if (reference) {
    const changedName = rng() < 0.5 ? "A" : "B";
    values[changedName] = 1 - values[changedName];
  }
  const calculation = evaluateWithSteps(expression, values);
  const result = calculation.value ? "1" : "0";

  return {
    kind: "logic-value",
    input: { type: "choice", label: "Выбери значение", options: [{ value: "1", label: "Истина · 1" }, { value: "0", label: "Ложь · 0" }] },
    prompt: `Вычисли ${formatExpression(expression)} при A = ${values.A} и B = ${values.B}.`,
    answer: result,
    hint: "Сначала вычисли выражения в скобках, начиная с внутренних. Без скобок порядок такой: НЕ, И, ИЛИ.",
    steps: [
      `Заменяем A на ${values.A}, B на ${values.B}.`,
      ...calculation.steps,
      `Ответ: ${result === "1" ? "истина" : "ложь"}.`
    ],
    lessonExample: "И (∧) истинно, только когда истинны обе части. ИЛИ (∨) истинно, когда истинна хотя бы одна часть. НЕ (¬) меняет значение на противоположное.",
    meta: { expression, values }
  };
}

function makeTableTask(variableCount, expressionOverride = null) {
  const variables = VARIABLE_NAMES.slice(0, variableCount);
  let expression;
  if (variableCount === 2) {
    expression = or(variable("A"), not(variable("B")));
  } else {
    // Такая форма показывает приоритет НЕ, И и ИЛИ на трёх переменных.
    expression = and(or(not(variable("A")), and(variable("B"), not(variable("C")))), variable("C"));
  }
  if (expressionOverride) expression = expressionOverride;
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
    lessonExample: `Сначала вычисляй выражения во внутренних скобках. Без скобок выполняй НЕ, затем И, затем ИЛИ. Перебери все сочетания от ${"0".repeat(variableCount)} до ${"1".repeat(variableCount)}.`,
    meta: { expression, variables, rows }
  };
}

export function generateTask(rng = Math.random) {
  const choice = randomInteger(rng, 0, 2);
  if (choice === 0) return makeEvaluationTask(rng);
  if (choice === 1) return makeTableTask(2);
  return makeTableTask(3);
}

function variedTableExpression(variableCount, rng, reference) {
  let expressions;
  if (variableCount === 2) {
    expressions = [
      or(variable("A"), not(variable("B"))),
      and(variable("A"), not(variable("B"))),
      or(not(variable("A")), variable("B")),
      and(not(variable("A")), variable("B"))
    ];
  } else {
    // Три формы имеют одинаковую вложенность и по пять операций.
    // Во всех формах итог действительно зависит от трёх переменных.
    expressions = [["A", "B", "C"], ["B", "C", "A"], ["C", "A", "B"]].map(([a, b, c]) =>
      and(or(not(variable(a)), and(variable(b), not(variable(c)))), variable(b))
    );
  }
  const previous = reference ? formatExpression(reference.meta.expression) : "";
  const choices = expressions.filter((expression) => formatExpression(expression) !== previous);
  return choices[randomInteger(rng, 0, choices.length - 1)];
}

export function generateVariantTask(variantId, rng = Math.random, reference = null) {
  if (variantId === "value") return makeEvaluationTask(rng, reference);
  if (variantId === "table-2" || variantId === "table-3") {
    const count = variantId === "table-2" ? 2 : 3;
    return makeTableTask(count, variedTableExpression(count, rng, reference));
  }
  throw new Error(`Неизвестный логический вариант: ${variantId}`);
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
  title: "Логические выражения",
  description: "В логике 1 означает истину, а 0 - ложь. Подставь значения переменных в выражение и выполни действия по порядку.",
  points: [
    "НЕ (¬) меняет значение на противоположное: ¬0 = 1, ¬1 = 0.",
    "И (∧) даёт 1, только когда обе части равны 1: 1 ∧ 1 = 1; 1 ∧ 0 = 0.",
    "ИЛИ (∨) даёт 1, когда хотя бы одна часть равна 1: 1 ∨ 0 = 1; 0 ∨ 0 = 0.",
    "Сначала вычисляй выражения во внутренних скобках. Без скобок выполняй НЕ, затем И, затем ИЛИ.",
    "В таблице истинности перебери все сочетания значений переменных. Для двух переменных это 00, 01, 10 и 11."
  ]
};

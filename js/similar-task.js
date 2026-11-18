// Вариант описывает учебный приём: например, сложение в основании 8.
// Новые числа подбираются внутри генератора; искать случайный подходящий тип не нужно.
const BASES = [2, 8, 10, 16];

export const taskVariants = {
  systems: [
    ...BASES.flatMap((source) => BASES.filter((target) => target !== source).map((target) => ({
      id: `convert-${source}-${target}`, label: `Перевод: ${source} → ${target}`
    }))),
    { id: "compare", label: "Сравнение чисел" }
  ],
  arithmetic: [
    { id: "add-8", label: "Сложение в основании 8" },
    { id: "subtract-8", label: "Вычитание в основании 8" },
    { id: "add-16", label: "Сложение в основании 16" },
    { id: "subtract-16", label: "Вычитание в основании 16" },
    { id: "add-2", label: "Двоичное сложение" },
    { id: "subtract-2", label: "Двоичное вычитание" },
    { id: "multiply-2", label: "Двоичное умножение" },
    { id: "divide-2", label: "Двоичное деление" }
  ],
  logic: [
    { id: "value", label: "Значение выражения" },
    { id: "table-2", label: "Таблица: две переменные" },
    { id: "table-3", label: "Таблица: три переменные" }
  ],
  executors: [{ id: "number", label: "Числовой исполнитель" }, { id: "drawing", label: "Чертёжник" }],
  programs: [{ id: "condition", label: "Программа с условием" }, { id: "loop", label: "Программа с циклом" }]
};

export function getTaskVariant(task) {
  const data = task.meta;
  if (task.kind === "systems-conversion") return `convert-${data.sourceBase}-${data.targetBase}`;
  if (task.kind === "systems-comparison") return "compare";
  if (task.kind.startsWith("arithmetic-")) {
    const operation = { "+": "add", "−": "subtract", "×": "multiply", "÷": "divide" }[data.operation];
    return `${operation}-${data.base}`;
  }
  const variants = {
    "logic-value": "value", "logic-table-two": "table-2", "logic-table-three": "table-3",
    "executor-number": "number", "executor-drawing": "drawing", "program-condition": "condition", "program-loop": "loop"
  };
  if (!variants[task.kind]) throw new Error(`Неизвестный тип задания: ${task.kind}`);
  return variants[task.kind];
}

export function generateTaskForVariant(module, variantId, rng = Math.random) {
  if (!taskVariants[module.id]?.some((variant) => variant.id === variantId)) {
    throw new Error(`Неизвестный вариант ${variantId} для темы ${module.id}.`);
  }
  return module.generateVariantTask(variantId, rng);
}

export function generateSimilarTask(module, reference, rng = Math.random, otherExcludedTasks = []) {
  const variantId = getTaskVariant(reference);
  if (!taskVariants[module.id]?.some((variant) => variant.id === variantId)) {
    throw new Error(`Задание ${reference.kind} не относится к теме ${module.id}.`);
  }
  const identity = (task) => `${task.prompt}\n${task.code ?? ""}`;
  const excluded = new Set([reference, ...otherExcludedTasks].map(identity));
  for (let attempt = 0; attempt < 32; attempt += 1) {
    // Первый выбор случайный. Резервные значения не зависят от источника rng:
    // даже постоянный rng должен дать задачу, отличную от исключённых.
    const fallbackValue = (attempt * 0.38196601125) % 1;
    const nextRng = attempt === 0 ? rng : () => fallbackValue;
    const task = module.generateVariantTask(variantId, nextRng, reference);
    if (!excluded.has(identity(task))) return task;
  }
  throw new Error("Не удалось подобрать другое задание. Выбери другой вид задачи.");
}

/** Выбирает целое число без повторного броска, исключая одно прежнее значение. */
export function differentInteger(rng, minimum, maximum, excluded) {
  const hasExcluded = Number.isInteger(excluded) && excluded >= minimum && excluded <= maximum;
  const count = maximum - minimum + 1 - Number(hasExcluded);
  if (count < 1) throw new Error("В диапазоне нет другого числа.");
  let value = minimum + Math.floor(rng() * count);
  if (hasExcluded && value >= excluded) value += 1;
  return value;
}

/** Сохраняет порядок величины и по возможности число разрядов исходного числа. */
export function similarInteger(rng, reference, minimum, maximum, base = 10) {
  const digitCount = reference.toString(base).length;
  let lower = Math.max(minimum, digitCount === 1 ? 0 : base ** (digitCount - 1), Math.floor(reference * 0.65));
  let upper = Math.min(maximum, base ** digitCount - 1, Math.ceil(reference * 1.5));
  // Нужны хотя бы две альтернативы: одна уже могла быть в самопроверке.
  // На границе разряда разрешаем ближайшие числа из соседнего разряда.
  if (upper - lower < 2) {
    lower = Math.max(minimum, reference - 2);
    upper = Math.min(maximum, reference + 2);
  }
  return differentInteger(rng, lower, upper, reference);
}

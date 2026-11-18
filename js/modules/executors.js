// Два безопасных учебных исполнителя: числовой «Удвоитель» и координатный
// «Чертёжник». Команды хранятся как данные, а не как исполняемый код.
function randomInteger(rng, minimum, maximum) {
  return Math.floor(rng() * (maximum - minimum + 1)) + minimum;
}

function makeNumberExecutorTask(rng) {
  const start = randomInteger(rng, 3, 8);
  const commandCount = randomInteger(rng, 3, 5);
  const commands = [];
  let target = start;

  for (let index = 0; index < commandCount; index += 1) {
    const command = target === 0 ? 2 : randomInteger(rng, 1, 2);
    commands.push(command);
    target = command === 1 ? target - 1 : target * 2;
  }

  const trace = [start];
  let current = start;
  for (const command of commands) {
    current = command === 1 ? current - 1 : current * 2;
    trace.push(current);
  }

  return {
    kind: "executor-number",
    input: { type: "text", label: `Номера команд, не более ${commandCount}` },
    prompt: `Исполнитель начинает с числа ${start}. Команда 1: вычти 1. Команда 2: умножь на 2. Получи число ${target} не более чем за ${commandCount} команд. Запиши последовательность цифрами 1 и 2.`,
    answer: commands.join(""),
    hint: "Иди от цели назад: перед умножением на 2 число было вдвое меньше; перед командой «вычти 1» оно было на 1 больше.",
    steps: [
      `Проверочный алгоритм: ${commands.join(" ")}.`,
      ...commands.map((command, index) => `Команда ${command}: ${trace[index]} → ${trace[index + 1]}.`),
      `Получили ${target}. Можно найти и другой алгоритм с тем же результатом.`
    ],
    lessonExample: "Проверяй последовательность команд по одной, записывая новое значение после каждого шага.",
    meta: { start, target, commandLimit: commandCount, trace }
  };
}

/** Возвращает точки после каждого перемещения с учётом повторений. */
export function computeDrawing(commands, start = { x: 0, y: 0 }) {
  const points = [{ x: start.x, y: start.y }];
  let position = { x: start.x, y: start.y };

  for (const command of commands) {
    const repeats = command.repeats ?? 1;
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      position = { x: position.x + command.dx, y: position.y + command.dy };
      points.push(position);
    }
  }
  return points;
}

function makeDrawingTask(rng) {
  const repeatCount = randomInteger(rng, 2, 4);
  const moveCount = randomInteger(rng, 2, 3);
  const sequence = [];
  const description = [];

  for (let index = 0; index < moveCount; index += 1) {
    let dx = randomInteger(rng, -3, 3);
    let dy = randomInteger(rng, -3, 3);
    if (dx === 0 && dy === 0) dx = 1;
    sequence.push({ dx, dy });
    description.push(`(${dx}, ${dy})`);
  }

  const commands = [];
  for (let repeat = 0; repeat < repeatCount; repeat += 1) {
    for (const move of sequence) commands.push(move);
  }
  const points = computeDrawing(commands);
  const end = points[points.length - 1];
  const answer = `${end.x},${end.y}`;

  return {
    kind: "executor-drawing",
    input: { type: "text", label: "Координаты конечной точки: x, y" },
    prompt: `Чертёжник начинает в точке (0, 0). Повтори ${repeatCount} раза команды смещения ${description.join(" затем ")}. Где он окажется?`,
    answer,
    hint: "Сложи смещения внутри одного повторения, затем умножь сумму на число повторов.",
    steps: [
      `Одно повторение даёт смещение (${sequence.reduce((sum, move) => sum + move.dx, 0)}, ${sequence.reduce((sum, move) => sum + move.dy, 0)}).`,
      `Повторяем этот блок ${repeatCount} раза. Промежуточных точек на рисунке: ${points.length - 1}.`,
      `Складываем изменения координат: x = ${end.x}, y = ${end.y}.`
    ],
    lessonExample: "Повтор команды смещения меняет x и y на одинаково повторённую сумму. Каждая команда оставляет на плоскости отрезок.",
    meta: { sequence, commands, points, end, repeatCount }
  };
}

export function generateTask(rng = Math.random) {
  return rng() < 0.52 ? makeNumberExecutorTask(rng) : makeDrawingTask(rng);
}

export function simulateNumberCommands(start, commandText) {
  const commands = String(commandText).trim();
  if (!/^[12]+$/.test(commands)) return { valid: false, values: [] };
  let current = start;
  const values = [current];

  for (const command of commands) {
    if (command === "1") current -= 1;
    else current *= 2;
    if (current < 0) return { valid: false, values };
    values.push(current);
  }
  return { valid: true, values, result: current };
}

function normalizePoint(text) {
  const match = String(text ?? "").trim().match(/^(-?\d+)\s*[,;]\s*(-?\d+)$/);
  return match ? `${Number(match[1])},${Number(match[2])}` : "";
}

export function checkAnswer(task, answer) {
  const submitted = String(answer ?? "").trim();
  if (!submitted) return { correct: false, empty: true, message: "Введи последовательность команд или координаты." };

  if (task.kind === "executor-number") {
    if (submitted.length > task.meta.commandLimit) return { correct: false, message: `Команд должно быть не больше ${task.meta.commandLimit}.` };
    const simulation = simulateNumberCommands(task.meta.start, submitted);
    if (!simulation.valid) return { correct: false, message: "Используй команды 1 и 2 и не допускай отрицательных значений." };
    const correct = simulation.result === task.meta.target;
    return { correct, message: correct ? "Верно: исполнитель пришёл к цели." : `После этих команд получилось ${simulation.result}.` };
  }

  const correct = normalizePoint(submitted) === task.answer;
  return { correct, message: correct ? "Верно: координаты рассчитаны." : "Проверь сумму смещений по x и по y." };
}

export const lesson = {
  title: "Команды превращают алгоритм в движение",
  description: "Исполнитель — это объект с понятным набором команд. Чтобы узнать результат, выполняй команды по порядку и фиксируй новое состояние после каждого шага.",
  points: [
    "У числового исполнителя команда меняет число на экране.",
    "У Чертёжника смещение (a, b) прибавляет a к x и b к y.",
    "Повторение означает, что каждая команда из блока выполняется несколько раз."
  ]
};

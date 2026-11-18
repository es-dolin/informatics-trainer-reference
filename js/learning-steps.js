// Учебный маршрут состоит из простых объектов: вопрос, поля ответа и пояснение.
// Здесь нет DOM и исполнения пользовательского кода. Ответы выводятся из данных задачи.
import { fromDecimal, toDecimal } from "./modules/systems.js";
import { evaluateExpression, formatExpression } from "./modules/logic.js";
import { checkAnswer as checkExecutorAnswer, findPossibleLastCommands } from "./modules/executors.js";

const DIGITS = "0123456789ABCDEF";

function field(label, answer, base = 10) {
  return { label, answer: String(answer), base };
}

function choice(label, answer, options) {
  return { label, answer: String(answer), options };
}

function step(group, title, prompt, fields, hint, explanation, extra = {}) {
  return { group, title, prompt, fields, hint, explanation, ...extra };
}

function decimalSteps(text, base, label) {
  const terms = [...text].map((digit, index) => {
    const power = text.length - index - 1;
    const digitValue = DIGITS.indexOf(digit);
    return { digit, digitValue, power, value: digitValue * base ** power };
  });
  const value = toDecimal(text, base);
  const group = `${label}: перевод в десятичную систему`;
  const digits = terms.map(({ digit, digitValue, power, value: termValue }) => step(group,
    `Вычисли разряд со степенью ${power}`,
    `В числе ${text} (основание ${base}) цифра ${digit} стоит в разряде со степенью ${power}. Найди ${digitValue} × ${base}^${power} в десятичной системе.`,
    [field("Значение разряда в десятичной системе", termValue)],
    `Степени разрядов считаются справа с нуля: ${base}^0 = 1, ${base}^1 = ${base}.${digitValue >= 10 ? ` Цифра ${digit} означает ${digitValue} в десятичной системе.` : ""}`,
    `${digitValue} × ${base}^${power} = ${termValue} в десятичной системе.`));
  digits.push(step(group, "Сложи значения разрядов", `Сложи значения разрядов: ${terms.map((term) => term.value).join(" + ")}.`,
    [field("Число в десятичной системе", value)],
    "Каждый разряд даёт своё слагаемое. Сложи их все, включая нулевые.",
    `${text} (основание ${base}) = ${value} (основание 10).`));
  return digits;
}

function divisionSteps(number, base) {
  const steps = [];
  let current = number;
  // Для нуля нужен один шаг, иначе остатки остались бы пустыми.
  do {
    const quotient = Math.floor(current / base);
    const remainder = current % base;
    steps.push(step("Собери запись в новом основании", "Раздели с остатком", `${current} ÷ ${base}. Найди целое частное и остаток.`,
      [field("Частное", quotient), field("Остаток", DIGITS[remainder], base)],
      `Частное - целая часть результата. Остаток = ${current} − частное × ${base}.${base === 16 ? " Для остатка введи цифру нового основания: A = 10, B = 11, C = 12, D = 13, E = 14, F = 15." : ""}`,
      `${current} ÷ ${base}: частное ${quotient}, остаток ${remainder}${remainder >= 10 ? `₁₀ = ${DIGITS[remainder]}₁₆` : ""}.`));
    current = quotient;
  } while (current > 0);
  return steps;
}

function systemsSteps(task) {
  const data = task.meta;
  if (task.kind === "systems-comparison") {
    return [
      ...decimalSteps(data.left, data.leftBase, "Найди значение слева"),
      ...decimalSteps(data.right, data.rightBase, "Найди значение справа"),
      step("Сравни значения", "Выбери знак", `Сравни найденные десятичные значения ${data.leftValue} и ${data.rightValue}.`,
        [choice("Знак", task.answer, ["<", "=", ">"])], "Сравнивай значения чисел, а не длину их записей.", `${data.leftValue} ${task.answer} ${data.rightValue}.`)
    ];
  }
  const steps = data.sourceBase === 10 ? [] : decimalSteps(data.source, data.sourceBase, "Прочитай исходное число");
  if (data.targetBase !== 10) {
    steps.push(...divisionSteps(data.number, data.targetBase));
    steps.push(step("Собери запись в новом основании", "Прочитай остатки снизу вверх", "Начни с последнего остатка и запиши все цифры в обратном порядке.",
      [field("Запись числа", task.answer, data.targetBase)], "Первый найденный остаток относится к младшему разряду и записывается справа.",
      `Итоговая запись в основании ${data.targetBase}: ${task.answer}.`));
  }
  return steps;
}

function arithmeticSteps(task) {
  const { base, left, right, operation, leftValue, rightValue, result } = task.meta;
  const steps = [];
  if (operation === "+" || operation === "−") {
    const width = Math.max(left.length, right.length);
    const a = left.padStart(width, "0");
    const b = right.padStart(width, "0");
    let carry = 0;
    for (let index = width - 1; index >= 0; index -= 1) {
      const top = DIGITS.indexOf(a[index]);
      const bottom = DIGITS.indexOf(b[index]);
      const position = width - index;
      if (operation === "+") {
        const sum = top + bottom + carry;
        const nextCarry = Math.floor(sum / base);
        const digit = DIGITS[sum % base];
        steps.push(step("Считай разряды справа налево", `Разряд ${position}: сложение`,
          `${a[index]} + ${b[index]} + перенос ${carry}. Значения цифр в десятичной системе: ${top} + ${bottom} + ${carry}. Основание записи ${base}.`,
          [field("Цифра результата", digit, base), field("Перенос влево", nextCarry)],
          `Цифра = остаток от деления суммы на ${base}. Перенос = целая часть этого деления. Если переноса нет, введи 0.`,
          `Сумма ${sum}₁₀ = ${fromDecimal(sum, base).text} (основание ${base}): записываем ${digit}, переносим ${nextCarry}.`,
          { columnPosition: position, incomingCarry: carry }));
        carry = nextCarry;
      } else {
        const incomingBorrow = carry;
        const difference = top - incomingBorrow - bottom;
        const nextBorrow = difference < 0 ? 1 : 0;
        const digit = DIGITS[difference + nextBorrow * base];
        steps.push(step("Считай разряды справа налево", `Разряд ${position}: вычитание`,
          `${a[index]} − уже занято ${incomingBorrow} − ${b[index]}. Значения цифр в десятичной системе: ${top} − ${incomingBorrow} − ${bottom}. Основание записи ${base}.`,
          [field("Цифра результата", digit, base), field("Займ из разряда слева: 0 или 1", nextBorrow)],
          `Учти займ предыдущего шага. Если разность отрицательная, займи единицу следующего старшего разряда: она добавит ${base} к текущему. Отметь займ 1; иначе введи 0. Через нули займ передаётся дальше влево.`,
          `${top} − ${incomingBorrow} − ${bottom}${nextBorrow ? ` + ${base}` : ""} = ${DIGITS.indexOf(digit)}₁₀. Цифра ${digit} в основании ${base}, новый займ ${nextBorrow}.`,
          { columnPosition: position, incomingCarry: incomingBorrow }));
        carry = nextBorrow;
      }
    }
    steps.push(step("Собери ответ", "Запиши число целиком", `${operation === "+" && carry ? `Остался перенос ${carry}: поставь его слева. ` : ""}Прочитай полученные цифры от старшего разряда к младшему.`,
      [field(`Ответ в основании ${base}`, task.answer, base)], "Первую вычисленную цифру ставим справа. Лишние нули слева можно убрать.", `Ответ: ${task.answer} (основание ${base}).`));
  } else if (operation === "×") {
    [...right].reverse().forEach((bit, position) => {
      const partial = bit === "1" ? fromDecimal(leftValue * 2 ** position, 2).text : "0";
      steps.push(step("Найди частичные произведения", `Разряд множителя ${position + 1}`, `Цифра множителя: ${bit}. Умножь ${left} на неё и сдвинь результат на ${position} разрядов влево.`,
        [field("Частичное произведение в двоичной системе", partial, 2)], "При умножении на 0 получается 0. При умножении на 1 число сохраняется. Сдвиг влево дописывает нули справа.",
        `Частичное произведение для разряда ${position + 1}: ${partial}.`, { multiplierPosition: position + 1 }));
    });
    steps.push(step("Сложи частичные произведения", "Получи произведение", "Сложи частичные произведения из выполненных шагов по правилам двоичного сложения.",
      [field("Произведение в двоичной системе", task.answer, 2)], "Складывай справа налево. В двоичной системе 1 + 1 = 10: пишем 0, переносим 1.", `Произведение: ${task.answer}₂.`));
  } else {
    steps.push(...decimalSteps(left, 2, "Переведи делимое"), ...decimalSteps(right, 2, "Переведи делитель"));
    steps.push(step("Выполни деление", "Найди частное", `Вычисли ${leftValue} ÷ ${rightValue} в десятичной системе.`,
      [field("Частное в десятичной системе", result)], "Проверь себя умножением: частное × делитель = делимое.", `${leftValue} ÷ ${rightValue} = ${result}.`));
    steps.push(...divisionSteps(result, 2));
    steps.push(step("Собери ответ", "Прочитай остатки снизу вверх", "Запиши найденное частное двоичными цифрами.",
      [field("Ответ в двоичной системе", task.answer, 2)], "Последний остаток записывается первым.", `Ответ: ${task.answer}₂.`));
  }
  return steps;
}

function logicSteps(task) {
  const steps = [];
  const rows = task.meta.rows ?? [{ values: task.meta.values }];
  rows.forEach((row, rowIndex) => {
    const assignment = Object.entries(row.values).map(([name, value]) => `${name} = ${value}`).join(", ");
    const group = task.meta.rows ? `Строка ${rowIndex + 1}: ${assignment}` : `Подставь ${assignment}`;
    if (task.meta.rows && rowIndex > 0) {
      // В первой строке ученик увидел каждую операцию. Теперь пробует всю строку,
      // но подсказка по-прежнему указывает, с какого действия начать.
      function firstHint(expression) {
        if (expression.type === "variable") return "";
        if (expression.type === "not") {
          return firstHint(expression.child) || `Начни с НЕ ${Number(evaluateExpression(expression.child, row.values))}: НЕ меняет 0 на 1, а 1 на 0.`;
        }
        const inner = firstHint(expression.left) || firstHint(expression.right);
        if (inner) return inner;
        const left = Number(evaluateExpression(expression.left, row.values));
        const right = Number(evaluateExpression(expression.right, row.values));
        return expression.type === "and"
          ? `Начни с ${left} И ${right}: И даёт 1, только если обе части равны 1.`
          : `Начни с ${left} ИЛИ ${right}: ИЛИ даёт 1, если хотя бы одна часть равна 1.`;
      }
      const result = evaluateExpression(task.meta.expression, row.values) ? "1" : "0";
      steps.push(step(group, `Вычисли строку ${rowIndex + 1}`,
        `${assignment}. Чему равно ${formatExpression(task.meta.expression)}?`,
        [choice("Результат строки", result, ["0", "1"])],
        firstHint(task.meta.expression) || "Подставь значение переменной.",
        `При ${assignment} результат строки: ${result}.`));
      return;
    }
    // Сначала добавляем шаги дочерних выражений, затем действие над их результатами.
    function visit(expression) {
      if (expression.type === "variable") return;
      if (expression.type === "not") visit(expression.child);
      else { visit(expression.left); visit(expression.right); }
      const result = evaluateExpression(expression, row.values) ? "1" : "0";
      let calculation;
      let hint;
      if (expression.type === "not") {
        calculation = `НЕ ${Number(evaluateExpression(expression.child, row.values))}`;
        hint = "НЕ меняет 0 на 1, а 1 на 0.";
      } else {
        const left = Number(evaluateExpression(expression.left, row.values));
        const right = Number(evaluateExpression(expression.right, row.values));
        calculation = `${left} ${expression.type === "and" ? "И" : "ИЛИ"} ${right}`;
        hint = expression.type === "and" ? "И даёт 1, только если обе части равны 1." : "ИЛИ даёт 1, если хотя бы одна часть равна 1.";
      }
      steps.push(step(group, `Вычисли ${formatExpression(expression)}`, `${assignment}. Подставь значения: ${calculation} = ?`,
        [choice("Результат операции", result, ["0", "1"])], hint, `${formatExpression(expression)} при ${assignment}: ${calculation} = ${result}.`));
    }
    visit(task.meta.expression);
  });
  return steps;
}

function executorSteps(task) {
  const steps = [];
  if (task.kind === "executor-number") {
    const possibleCommands = findPossibleLastCommands(task.meta.start, task.meta.target, task.meta.commandLimit);
    const choiceAnswer = possibleCommands.length === 2 ? "1 и 2" : possibleCommands[0];
    steps.push(step("Выбери команду", "Какая команда могла быть последней?",
      `Какие команды могли привести к ${task.meta.target} из ${task.meta.start} не более чем за ${task.meta.commandLimit} команд? Выбери все возможные последние команды.`,
      [choice("Последняя команда", choiceAnswer, ["1", "2", "1 и 2"])],
      "Отмени каждую команду: перед вычитанием 1 число было на 1 больше, перед умножением на 2 - вдвое меньше. Проверь, можно ли попасть в эту точку из начала за оставшиеся команды.",
      `Возможные последние команды: ${possibleCommands.join(" и ")}. Дальше разберём один из подходящих путей.`));
    const commands = [...task.answer].reverse();
    let current = task.meta.target;
    commands.forEach((command, index) => {
      const previous = command === "1" ? current + 1 : current / 2;
      steps.push(step("Иди от цели к началу", `Обратный шаг ${index + 1}`, `Сейчас ${current}. Рассмотрим путь, где перед ним выполнялась команда ${command}: ${command === "1" ? "вычти 1" : "умножь на 2"}. Какое число было до неё?`,
        [field("Предыдущее число", previous)], command === "1" ? "Отмени вычитание: прибавь 1." : "Отмени удвоение: раздели число на 2.",
        `До команды ${command} было ${previous}: ${previous} → ${current}.`));
      current = previous;
    });
    steps.push(step("Запиши команды в прямом порядке", "Построй алгоритм", `Вернулись к ${task.meta.start}. Прочитай найденные команды в обратном порядке: от начала к цели.`,
      [{ label: `Команды 1 и 2, не более ${task.meta.commandLimit}`, answer: task.answer, commandTask: task }],
      "Обратные шаги начинались с последней команды. Чтобы запустить исполнителя, переставь их от первого шага к последнему.",
      `Один из путей к цели: ${task.answer}. Другой правильный путь тоже подходит.`));
  } else {
    task.meta.commands.forEach((command, index) => {
      const before = task.meta.points[index];
      const after = task.meta.points[index + 1];
      const repeat = Math.floor(index / task.meta.sequence.length) + 1;
      steps.push(step(`Повтор ${repeat} из ${task.meta.repeatCount}`, `Перемещение ${index + 1}`, `Точка (${before.x}, ${before.y}). Выполни смещение (${command.dx}, ${command.dy}): x = ${before.x} + (${command.dx}), y = ${before.y} + (${command.dy}).`,
        [field("Новая координата x", after.x), field("Новая координата y", after.y)], "Смещение меняет координаты отдельно: первое число прибавь к x, второе к y. Учитывай знак каждого числа.",
        `После смещения (${command.dx}, ${command.dy}) точка (${after.x}, ${after.y}).`, { pointCount: index + 1 }));
    });
  }
  return steps;
}

function programSteps(task) {
  const steps = [];
  if (task.kind === "program-condition") {
    task.meta.runs.forEach((run, index) => {
      const group = `Запуск ${index + 1}: s = ${run.s}, t = ${run.t}`;
      if (index > 0) {
        steps.push(step(group, `Определи вывод запуска ${index + 1}`,
          `При s = ${run.s} и t = ${run.t} что напечатает программа?`,
          [choice("Вывод", run.output, ["YES", "NO"])],
          `Сравни ${run.s} < ${task.meta.limit} и ${run.t} > ${task.meta.limit}. При or достаточно одной истины для YES; иначе будет NO.`,
          `Запуск ${index + 1} печатает ${run.output}.`, { codeLine: 2, afterCodeLine: run.output === "YES" ? 3 : 5 }));
        return;
      }
      steps.push(step(group, "Проверь первую часть условия", `Истинно ли ${run.s} < ${task.meta.limit}?`,
        [choice("0 - ложь, 1 - истина", Number(run.firstIsTrue), ["0", "1"])], "Знак < строгий: при равенстве условие ложно.", `s < ${task.meta.limit}: ${run.firstIsTrue ? "истина" : "ложь"}.`, { codeLine: 2 }));
      steps.push(step(group, "Проверь вторую часть условия", `Истинно ли ${run.t} > ${task.meta.limit}?`,
        [choice("0 - ложь, 1 - истина", Number(run.secondIsTrue), ["0", "1"])], "Знак > строгий: при равенстве условие ложно.", `t > ${task.meta.limit}: ${run.secondIsTrue ? "истина" : "ложь"}.`, { codeLine: 2 }));
      steps.push(step(group, "Выбери ветку и вывод", `Первая часть: ${Number(run.firstIsTrue)}. Вторая часть: ${Number(run.secondIsTrue)}. Они соединены через or (ИЛИ). Что напечатает программа?`,
        [choice("Вывод", run.output, ["YES", "NO"])], "ИЛИ истинно, если истинна хотя бы одна часть. При истине выполняется print(\"YES\"), иначе print(\"NO\").",
        `Запуск ${index + 1} печатает ${run.output}.`, { codeLine: 2, afterCodeLine: run.output === "YES" ? 3 : 5 }));
    });
    const numbers = task.meta.runs.map((run, index) => run.output === "NO" ? String(index + 1) : null).filter(Boolean);
    steps.push(step("Собери ответ", "Выбери подходящие запуски", "Какие запуски напечатали NO? Введи номера через пробел или запятую. Если таких запусков нет, напиши «нет».",
      [{ label: "Номера запусков", answer: numbers.length ? numbers.join(", ") : "нет", numberSet: true }],
      "Посмотри выводы в выполненных шагах и выпиши номера запусков с NO. Если таких нет, напиши «нет».",
      numbers.length ? `NO напечатали запуски: ${numbers.join(", ")}.` : "Нет запусков, которые печатают NO.", { showHistory: true }));
  } else {
    let total = 0;
    task.meta.numbers.forEach((number, index) => {
      const previous = total;
      total += number;
      steps.push(step("Выполни цикл", `Итерация ${index + 1}`, `Перед шагом total = ${previous}. Очередной item = ${number}. Выполни total = total + item.`,
        [field("Новое значение total", total)], "Возьми total из предыдущего шага и прибавь только текущий элемент списка.", `Итерация ${index + 1}: total = ${previous} + ${number} = ${total}.`, { codeLine: 2 }));
    });
    steps.push(step("Предскажи вывод", "Выйди из цикла", "Все элементы пройдены. Какое значение получит print(total)?",
      [field("Вывод программы", total)], "После цикла total сохраняет последнее вычисленное значение.", `Программа печатает ${total}.`, { codeLine: 3 }));
  }
  return steps;
}

export function createLearningSteps(task) {
  if (task.kind.startsWith("systems-")) return systemsSteps(task);
  if (task.kind.startsWith("arithmetic-")) return arithmeticSteps(task);
  if (task.kind.startsWith("logic-")) return logicSteps(task);
  if (task.kind.startsWith("executor-")) return executorSteps(task);
  if (task.kind.startsWith("program-")) return programSteps(task);
  throw new Error(`Нет учебного маршрута: ${task.kind}`);
}

export function checkLearningStep(step, answers) {
  if (step.fields.some((_, index) => String(answers[index] ?? "").trim() === "")) {
    return { correct: false, empty: true, message: "Заполни все поля этого шага." };
  }
  const correctFields = step.fields.map((item, index) => {
    const answer = String(answers[index]).trim().toUpperCase();
    if (item.commandTask) {
      return checkExecutorAnswer(item.commandTask, answer).correct;
    }
    if (item.numberSet) {
      // Номера можно записать в любом порядке, через пробел или запятую.
      if (item.answer.toUpperCase() === "НЕТ") return answer === "НЕТ";
      if (!/^\d+(?:(?:\s*,\s*|\s+)\d+)*$/.test(answer)) return false;
      const selected = answer.split(/[\s,]+/).map(Number);
      const expected = item.answer.split(/[\s,]+/).map(Number);
      return selected.length === expected.length && new Set(selected).size === selected.length
        && selected.every((number) => expected.includes(number));
    }
    if (item.options) return answer === item.answer.toUpperCase();
    if (item.base === 10) return /^-?\d+$/.test(answer) && Number(answer) === Number(item.answer);
    try { return toDecimal(answer, item.base) === toDecimal(item.answer, item.base); }
    catch { return false; }
  });
  const correct = correctFields.every(Boolean);
  const wrongLabels = step.fields.filter((_, index) => !correctFields[index]).map((item) => item.label.toLowerCase());
  return { correct, correctFields, message: correct ? `Верно. ${step.explanation}` : `Проверь: ${wrongLabels.join(", ")}. ${step.hint}` };
}

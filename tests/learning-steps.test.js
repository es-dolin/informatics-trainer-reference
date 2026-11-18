import test from "node:test";
import assert from "node:assert/strict";
import { modules } from "../js/modules/index.js";
import { and, or, not, variable, buildTruthTable } from "../js/modules/logic.js";
import { createLearningSteps, checkLearningStep } from "../js/learning-steps.js";

function answers(steps) {
  return steps.map((step) => step.fields.map((field) => field.answer));
}

function arithmetic(left, right, operation, base, result, answer) {
  return { kind: "arithmetic-binary", answer, meta: { left, right, operation, base, result, leftValue: parseInt(left, base), rightValue: parseInt(right, base) } };
}

test("разрядное сложение проверяет перенос, включая шестнадцатеричные цифры", () => {
  const steps = createLearningSteps(arithmetic("F", "1", "+", 16, 16, "10"));
  assert.deepEqual(answers(steps), [["0", "1"], ["10"]]);
  assert.equal(checkLearningStep(steps[0], ["0", "0"]).correct, false);
  assert.deepEqual(checkLearningStep(steps[0], ["0", "0"]).correctFields, [true, false]);
  assert.equal(checkLearningStep(steps[1], ["0010"]).correct, true);
  const noCarry = createLearningSteps(arithmetic("1", "0", "+", 2, 1, "1"));
  assert.deepEqual(answers(noCarry), [["1", "0"], ["1"]]);
});

test("вычитание проводит займ через нулевые разряды и допускает ноль", () => {
  const steps = createLearningSteps(arithmetic("1000", "1", "−", 2, 7, "111"));
  assert.deepEqual(answers(steps), [["1", "1"], ["1", "1"], ["1", "1"], ["0", "0"], ["111"]]);
  assert.match(steps[1].prompt, /уже занято 1/);
  const zero = createLearningSteps(arithmetic("A", "A", "−", 16, 0, "0"));
  assert.deepEqual(answers(zero), [["0", "0"], ["0"]]);
  assert.equal(checkLearningStep(zero[0], ["G", "0"]).correct, false);
});

test("двоичное умножение учитывает нулевые цифры и сдвиг", () => {
  const steps = createLearningSteps(arithmetic("101", "10", "×", 2, 10, "1010"));
  assert.deepEqual(answers(steps), [["0"], ["1010"], ["1010"]]);
  assert.equal(checkLearningStep(steps[1], ["1020"]).correct, false);
});

test("двоичное деление переводит оба числа и собирает остатки", () => {
  const steps = createLearningSteps(arithmetic("1100", "11", "÷", 2, 4, "100"));
  assert.deepEqual(answers(steps), [["8"], ["4"], ["0"], ["0"], ["12"], ["2"], ["1"], ["3"], ["4"], ["2", "0"], ["1", "0"], ["0", "1"], ["100"]]);
});

test("перевод нуля даёт непустой маршрут, сравнение равных чисел завершается знаком равенства", () => {
  const zero = createLearningSteps({ kind: "systems-conversion", answer: "0", meta: { source: "0", sourceBase: 10, targetBase: 2, number: 0 } });
  assert.deepEqual(answers(zero), [["0", "0"], ["0"]]);
  const comparison = createLearningSteps({ kind: "systems-comparison", answer: "=", meta: { left: "A", leftBase: 16, leftValue: 10, right: "1010", rightBase: 2, rightValue: 10 } });
  assert.deepEqual(answers(comparison), [["10"], ["10"], ["8"], ["0"], ["2"], ["0"], ["10"], ["="]]);
  assert.match(comparison[0].hint, /A означает 10/);
});

test("шестнадцатеричный остаток объясняется и проверяется как цифра нового основания", () => {
  const task = { kind: "systems-conversion", answer: "1F", meta: { source: "31", sourceBase: 10, targetBase: 16, number: 31 } };
  const steps = createLearningSteps(task);
  assert.equal(checkLearningStep(steps[0], ["1", "F"]).correct, true);
  assert.equal(checkLearningStep(steps[0], ["1", "15"]).correct, false);
  assert.match(steps[0].explanation, /15₁₀ = F₁₆/);
});

test("логика подробно разбирает первую строку и проверяет остальные целиком", () => {
  const expression = and(or(not(variable("A")), variable("B")), variable("C"));
  const rows = buildTruthTable(expression, ["A", "B", "C"]);
  const steps = createLearningSteps({ kind: "logic-table-three", meta: { expression, rows } });
  assert.equal(steps.length, 10);
  assert.deepEqual(answers(steps.slice(0, 3)), [["1"], ["1"], ["0"]]);
  for (let index = 1; index < rows.length; index += 1) {
    const current = steps[index + 2];
    assert.equal(checkLearningStep(current, [rows[index].result]).correct, true);
    assert.equal(checkLearningStep(current, [rows[index].result === "1" ? "0" : "1"]).correct, false);
    assert.match(current.hint, /Начни с/);
  }
});

test("исполнитель идёт назад от цели и принимает другой правильный путь", () => {
  const task = { kind: "executor-number", answer: "12", meta: { start: 3, target: 4, commandLimit: 3 } };
  const steps = createLearningSteps(task);
  assert.deepEqual(answers(steps), [["1 и 2"], ["2"], ["3"], ["12"]]);
  assert.equal(checkLearningStep(steps[0], ["2"]).correct, false);
  assert.equal(checkLearningStep(steps[3], ["211"]).correct, true);
  assert.equal(checkLearningStep(steps[3], ["2222"]).correct, false);
});

test("Чертёжник проверяет обе координаты, отрицательные смещения и возврат к началу", () => {
  const task = { kind: "executor-drawing", meta: {
    sequence: [{ dx: -2, dy: 3 }, { dx: 2, dy: -3 }], repeatCount: 1,
    commands: [{ dx: -2, dy: 3 }, { dx: 2, dy: -3 }],
    points: [{ x: 0, y: 0 }, { x: -2, y: 3 }, { x: 0, y: 0 }]
  } };
  const steps = createLearningSteps(task);
  assert.deepEqual(answers(steps), [["-2", "3"], ["0", "0"]]);
  assert.deepEqual(steps.map((step) => step.pointCount), [1, 2]);
  assert.equal(checkLearningStep(steps[0], ["-2", "-3"]).correct, false);
});

test("условие с ИЛИ подробно разбирает первый запуск и собирает номера", () => {
  const runs = [
    { s: 5, t: 5, firstIsTrue: false, secondIsTrue: false, output: "NO" },
    { s: 4, t: 5, firstIsTrue: true, secondIsTrue: false, output: "YES" },
    { s: 5, t: 6, firstIsTrue: false, secondIsTrue: true, output: "YES" },
    { s: 6, t: 5, firstIsTrue: false, secondIsTrue: false, output: "NO" }
  ];
  const steps = createLearningSteps({ kind: "program-condition", meta: { limit: 5, runs } });
  assert.deepEqual(answers(steps), [["0"], ["0"], ["NO"], ["YES"], ["YES"], ["NO"], ["1, 4"]]);
  assert.equal(steps[2].codeLine, 2, "до ответа выделяем условие, не раскрывая ветку");
  assert.equal(steps[2].afterCodeLine, 5);
  assert.equal(steps[3].afterCodeLine, 3);
  const finalStep = steps.at(-1);
  assert.equal(finalStep.showHistory, true);
  assert.equal(checkLearningStep(finalStep, ["4 1"]).correct, true);
  assert.equal(checkLearningStep(finalStep, ["1, 4"]).correct, true);
  assert.equal(checkLearningStep(finalStep, ["1, 1"]).correct, false);
  assert.equal(checkLearningStep(finalStep, ["1 4 9"]).correct, false);
  assert.equal(checkLearningStep(finalStep, ["1,,4"]).correct, false);
  assert.equal(checkLearningStep(finalStep, []).empty, true);
});

test("если ни один запуск не печатает NO, в итоге можно ответить «нет»", () => {
  const runs = [{ s: 4, t: 5, firstIsTrue: true, secondIsTrue: false, output: "YES" }];
  const finalStep = createLearningSteps({ kind: "program-condition", meta: { limit: 5, runs } }).at(-1);
  assert.equal(checkLearningStep(finalStep, ["нет"]).correct, true);
  assert.equal(checkLearningStep(finalStep, ["НЕТ"]).correct, true);
  assert.equal(checkLearningStep(finalStep, ["1"]).correct, false);
});

test("цикл сохраняет накопленную сумму между итерациями", () => {
  const steps = createLearningSteps({ kind: "program-loop", meta: { numbers: [3, 1, 7] } });
  assert.deepEqual(answers(steps), [["3"], ["4"], ["11"], ["11"]]);
  assert.match(steps[1].prompt, /total = 3/);
});

test("все генерируемые подтипы имеют маршрут с проверкой ошибок и пустых полей", () => {
  let seed = 13579;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const kinds = new Set();
  for (const module of modules) {
    for (let index = 0; index < 100; index += 1) {
      const task = module.generateTask(rng);
      kinds.add(task.kind);
      const steps = createLearningSteps(task);
      assert.ok(steps.length > 0, task.kind);
      for (const step of steps) {
        assert.ok(step.prompt && step.hint && step.explanation);
        const expected = step.fields.map((field) => field.answer);
        assert.equal(checkLearningStep(step, expected).correct, true, task.kind);
        assert.equal(checkLearningStep(step, []).empty, true);
        assert.equal(checkLearningStep(step, expected.map(() => "__wrong__")).correct, false);
      }
      assert.equal(module.checkAnswer(task, task.answer).correct, true);
    }
  }
  assert.equal(kinds.size, 11, "пройдены все подтипы существующих генераторов");
});

import test from "node:test";
import assert from "node:assert/strict";
import { and, buildTruthTable, checkAnswer, evaluateExpression, evaluateWithSteps, generateTask, not, or, variable } from "../js/modules/logic.js";
import { makeRandom } from "./helpers.js";

test("НЕ, И и ИЛИ вычисляются по таблицам истинности", () => {
  const A = variable("A");
  const B = variable("B");
  assert.equal(evaluateExpression(not(A), { A: 1 }), false);
  assert.equal(evaluateExpression(and(A, B), { A: 1, B: 1 }), true);
  assert.equal(evaluateExpression(or(A, B), { A: 0, B: 1 }), true);
});

test("таблица A ИЛИ НЕ B совпадает с ожидаемым порядком строк", () => {
  const expression = or(variable("A"), not(variable("B")));
  const rows = buildTruthTable(expression, ["A", "B"]);
  assert.deepEqual(rows.map((row) => row.result), ["1", "0", "1", "1"]);
});

test("составная таблица от трёх переменных имеет восемь строк", () => {
  const expression = and(or(not(variable("A")), and(variable("B"), not(variable("C")))), variable("C"));
  const rows = buildTruthTable(expression, ["A", "B", "C"]);
  assert.deepEqual(rows.map((row) => row.result), ["0", "1", "0", "1", "0", "0", "0", "0"]);
});

test("пошаговый расчёт показывает отрицание и внутреннюю операцию до итоговой", () => {
  const expression = and(or(not(variable("A")), and(variable("B"), not(variable("C")))), variable("C"));
  const result = evaluateWithSteps(expression, { A: 0, B: 1, C: 0 });
  assert.equal(result.value, false);
  assert.ok(result.steps[0].startsWith("¬A"));
  assert.ok(result.steps.some((step) => step.includes("∧")));
});

test("все варианты генератора можно решить и проверить", () => {
  const rng = makeRandom(77);
  const kinds = new Set();
  for (let index = 0; index < 300; index += 1) {
    const task = generateTask(rng);
    kinds.add(task.kind);
    assert.equal(checkAnswer(task, task.answer).correct, true);
    assert.equal(checkAnswer(task, task.input.type === "truth-table" ? [] : "").empty, true);
  }
  assert.ok(kinds.has("logic-value"));
  assert.ok(kinds.has("logic-table-two"));
  assert.ok(kinds.has("logic-table-three"));
});

test("таблица истинности отмечает частичное выполнение", () => {
  const task = generateTask(() => 0.5);
  const partial = [...task.answer];
  partial[0] = partial[0] === "1" ? "0" : "1";
  assert.equal(checkAnswer(task, partial).correctRows, task.answer.length - 1);
});

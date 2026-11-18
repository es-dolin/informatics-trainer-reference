import test from "node:test";
import assert from "node:assert/strict";
import { checkAnswer, generateTask } from "../js/modules/arithmetic.js";
import { toDecimal } from "../js/modules/systems.js";
import { makeRandom } from "./helpers.js";

test("генератор арифметики создаёт только корректные ответы", () => {
  const rng = makeRandom(24);
  const operations = new Set();
  const kinds = new Set();

  for (let index = 0; index < 500; index += 1) {
    const task = generateTask(rng);
    operations.add(task.meta.operation);
    kinds.add(task.kind);
    assert.equal(toDecimal(task.answer, task.meta.base), task.meta.result);
    assert.equal(checkAnswer(task, task.answer).correct, true);
    assert.equal(checkAnswer(task, "").empty, true);
  }

  for (const operation of ["+", "−", "×", "÷"]) assert.ok(operations.has(operation));
  assert.ok(kinds.has("arithmetic-other-base"));
  assert.ok(kinds.has("arithmetic-binary"));
});

test("двоичное деление генерирует целое частное без остатка", () => {
  const rng = makeRandom(9);
  for (let index = 0; index < 200; index += 1) {
    const task = generateTask(rng);
    if (task.meta.operation === "÷") {
      assert.equal(task.meta.leftValue % task.meta.rightValue, 0);
      assert.equal(task.meta.result, task.meta.leftValue / task.meta.rightValue);
    }
  }
});

test("ответ с недопустимым символом отклоняется", () => {
  const rng = makeRandom(4);
  let task = generateTask(rng);
  while (task.meta.base === 16) task = generateTask(rng);
  assert.equal(checkAnswer(task, "Z").correct, false);
});

test("арифметические вычисления совпадают с контрольными примерами ВПР", () => {
  assert.equal(toDecimal("34", 8) + toDecimal("16", 8), toDecimal("52", 8));
  assert.equal(toDecimal("100110", 2) - toDecimal("1011", 2), toDecimal("11011", 2));
});

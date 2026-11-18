import test from "node:test";
import assert from "node:assert/strict";
import { checkAnswer, fromDecimal, generateComparisonTask, generateConversionTask, generateTask, toDecimal } from "../js/modules/systems.js";
import { makeRandom } from "./helpers.js";

test("перевод между основаниями сохраняет значение на границах", () => {
  for (const base of [2, 8, 16]) {
    for (const number of [0, 1, 7, 8, 15, 255, 1024]) {
      const converted = fromDecimal(number, base);
      assert.equal(toDecimal(converted.text, base), number);
    }
  }
});

test("переводчик отклоняет цифру, которой нет в алфавите основания", () => {
  assert.throws(() => toDecimal("102", 2));
  assert.throws(() => fromDecimal(-1, 8));
});

test("контрольные значения из образца ВПР переводятся правильно", () => {
  assert.equal(fromDecimal(78, 8).text, "116");
  assert.equal(toDecimal("B2", 16), 178);
  assert.equal(toDecimal("264", 8), 180);
  assert.equal(toDecimal("10110011", 2), 179);
});

test("генератор преобразования всегда даёт проверяемое число", () => {
  const task = generateConversionTask(() => 0.5);
  assert.equal(toDecimal(task.meta.source, task.meta.sourceBase), task.meta.number);
  assert.equal(toDecimal(task.answer, task.meta.targetBase), task.meta.number);
  assert.equal(checkAnswer(task, task.answer).correct, true);
});

test("генератор сравнения выбирает знак по десятичным значениям", () => {
  const task = generateComparisonTask(() => 0.25);
  assert.notEqual(task.meta.leftBase, task.meta.rightBase);
  assert.ok([2, 8, 16].includes(task.meta.leftBase));
  assert.equal(task.answer, task.meta.leftValue < task.meta.rightValue ? "<" : ">");
});

test("пустой ответ не засчитывается", () => {
  const task = generateConversionTask(() => 0.5);
  assert.equal(checkAnswer(task, " ").empty, true);
});

test("случайные задания на перевод и сравнение всегда имеют проверяемый ответ", () => {
  const rng = makeRandom(113);
  const kinds = new Set();
  for (let index = 0; index < 400; index += 1) {
    const task = generateTask(rng);
    kinds.add(task.kind);
    assert.equal(checkAnswer(task, task.answer).correct, true);
    if (task.kind === "systems-conversion") {
      assert.ok(task.meta.number >= 0 && task.meta.number <= 1024);
      assert.equal(toDecimal(task.meta.source, task.meta.sourceBase), task.meta.number);
      assert.equal(toDecimal(task.answer, task.meta.targetBase), task.meta.number);
    } else {
      assert.ok([2, 8, 16].includes(task.meta.leftBase));
      assert.ok([2, 8, 16].includes(task.meta.rightBase));
    }
  }
  assert.ok(kinds.has("systems-conversion"));
  assert.ok(kinds.has("systems-comparison"));
});

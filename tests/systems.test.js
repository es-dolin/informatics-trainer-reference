import test from "node:test";
import assert from "node:assert/strict";
import { checkAnswer, fromDecimal, generateComparisonTask, generateConversionTask, toDecimal } from "../js/modules/systems.js";

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

test("генератор преобразования всегда даёт проверяемое число", () => {
  const task = generateConversionTask(() => 0.5);
  assert.equal(toDecimal(task.answer, task.meta.base), task.meta.number);
  assert.equal(checkAnswer(task, task.answer).correct, true);
});

test("генератор сравнения выбирает знак по десятичным значениям", () => {
  const task = generateComparisonTask(() => 0.25);
  assert.notEqual(task.meta.leftBase, task.meta.rightBase);
  assert.equal(task.answer, task.meta.leftValue < task.meta.rightValue ? "<" : ">");
});

test("пустой ответ не засчитывается", () => {
  const task = generateConversionTask(() => 0.5);
  assert.equal(checkAnswer(task, " ").empty, true);
});


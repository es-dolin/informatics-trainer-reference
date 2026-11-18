import test from "node:test";
import assert from "node:assert/strict";
import { checkAnswer, computeDrawing, generateTask, simulateNumberCommands } from "../js/modules/executors.js";
import { makeRandom } from "./helpers.js";

test("числовой исполнитель применяет команды по порядку", () => {
  assert.deepEqual(simulateNumberCommands(5, "12212").values, [5, 4, 8, 16, 15, 30]);
  assert.equal(simulateNumberCommands(0, "1").valid, false);
  assert.equal(simulateNumberCommands(5, "12x").valid, false);
});

test("Чертёжник повторяет смещения и возвращает все промежуточные точки", () => {
  assert.deepEqual(computeDrawing([{ dx: 1, dy: 2, repeats: 2 }, { dx: -3, dy: 1 }]), [
    { x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }, { x: -1, y: 5 }
  ]);
});

test("пример Чертёжника из образца заканчивается в точке (6, 8)", () => {
  const commands = [
    { dx: 1, dy: 3 }, { dx: 1, dy: -2 },
    { dx: 1, dy: 3 }, { dx: 1, dy: -2 },
    { dx: 2, dy: 6 }
  ];
  assert.deepEqual(computeDrawing(commands).at(-1), { x: 6, y: 8 });
});

test("генераторы исполнителей создают проверяемые и допустимые задания", () => {
  const rng = makeRandom(21);
  const kinds = new Set();
  for (let index = 0; index < 400; index += 1) {
    const task = generateTask(rng);
    kinds.add(task.kind);
    assert.equal(checkAnswer(task, task.answer).correct, true);
    assert.equal(checkAnswer(task, "").empty, true);
    if (task.kind === "executor-number") assert.ok(task.answer.length <= task.meta.commandLimit);
    else assert.deepEqual(task.meta.points.at(-1), task.meta.end);
  }
  assert.ok(kinds.has("executor-number"));
  assert.ok(kinds.has("executor-drawing"));
});

test("исполнитель принимает другой корректный алгоритм", () => {
  const task = {
    kind: "executor-number",
    answer: "12",
    meta: { start: 5, target: 8, commandLimit: 3 }
  };
  assert.equal(checkAnswer(task, "211").correct, true);
});

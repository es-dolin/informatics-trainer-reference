import test from "node:test";
import assert from "node:assert/strict";
import { checkAnswer, generateTask, simulateCondition } from "../js/modules/programs.js";
import { makeRandom } from "./helpers.js";

test("условие с ИЛИ требует только одну истинную часть для YES", () => {
  assert.deepEqual(simulateCondition(10, 15, 9), { first: false, second: false, output: "NO" });
  assert.equal(simulateCondition(10, 5, 9).output, "YES");
  assert.equal(simulateCondition(10, 15, 11).output, "YES");
});

test("анализ условия воспроизводит выходы контрольных пар из образца", () => {
  const pairs = [[15, 9], [5, 11], [18, 15], [10, 9], [-4, 5]];
  const noRuns = pairs.map(([s, t], index) => simulateCondition(10, s, t).output === "NO" ? String(index + 1) : null).filter(Boolean);
  assert.deepEqual(noRuns, ["1", "4"]);
});

test("оба типа фиксированных программ дают согласованные задания", () => {
  const rng = makeRandom(16);
  const kinds = new Set();
  for (let index = 0; index < 300; index += 1) {
    const task = generateTask(rng);
    kinds.add(task.kind);
    assert.equal(checkAnswer(task, task.answer).correct, true);
    assert.equal(checkAnswer(task, task.kind === "program-condition" ? [] : "").empty, true);
    assert.doesNotMatch(task.code, /eval\s*\(|new Function/);
  }
  assert.ok(kinds.has("program-condition"));
  assert.ok(kinds.has("program-loop"));
});

test("для условной программы нужно выбрать все и только верные номера", () => {
  const task = {
    kind: "program-condition",
    answer: ["1", "3"],
    meta: {}
  };
  assert.equal(checkAnswer(task, ["3", "1"]).correct, true);
  assert.equal(checkAnswer(task, ["1"]).correct, false);
});

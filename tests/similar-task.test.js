import test from "node:test";
import assert from "node:assert/strict";
import { modules } from "../js/modules/index.js";
import { generateGuidedConversionTask } from "../js/modules/systems.js";
import { formatExpression } from "../js/modules/logic.js";
import { createLearningSteps, checkLearningStep } from "../js/learning-steps.js";
import { taskVariants, getTaskVariant, generateTaskForVariant, generateSimilarTask, differentInteger, similarInteger } from "../js/similar-task.js";

function identity(task) {
  return `${task.prompt}\n${task.code ?? ""}`;
}

function operationCount(expression) {
  if (expression.type === "variable") return 0;
  if (expression.type === "not") return 1 + operationCount(expression.child);
  return 1 + operationCount(expression.left) + operationCount(expression.right);
}

for (const module of modules) {
  test(`${module.title}: все варианты создаются и дают другую аналогичную задачу при постоянном rng`, () => {
    for (const variant of taskVariants[module.id]) {
      for (const randomValue of [0, 0.01, 0.5, 0.999999]) {
        const rng = () => randomValue;
        let task = generateTaskForVariant(module, variant.id, rng);
        assert.equal(getTaskVariant(task), variant.id);
        assert.equal(module.checkAnswer(task, task.answer).correct, true);
        for (let repetition = 0; repetition < 4; repetition += 1) {
          const next = generateSimilarTask(module, task, rng);
          assert.equal(getTaskVariant(next), variant.id);
          assert.equal(next.kind, task.kind);
          assert.notEqual(identity(next), identity(task), `${variant.id}, rng=${randomValue}`);
          assert.equal(module.checkAnswer(next, next.answer).correct, true);
          for (const step of createLearningSteps(next)) {
            assert.equal(checkLearningStep(step, step.fields.map((field) => field.answer)).correct, true);
          }
          if (module.id === "arithmetic") {
            assert.equal(next.meta.base, task.meta.base);
            assert.equal(next.meta.operation, task.meta.operation);
            assert.ok(next.meta.result >= 0 && Number.isInteger(next.meta.result));
          }
          if (task.kind === "systems-conversion") {
            assert.equal(next.meta.sourceBase, task.meta.sourceBase);
            assert.equal(next.meta.targetBase, task.meta.targetBase);
            assert.ok(Math.abs(next.meta.source.length - task.meta.source.length) <= 1);
          }
          if (task.kind === "systems-comparison") {
            assert.equal(next.meta.leftBase, task.meta.leftBase);
            assert.equal(next.meta.rightBase, task.meta.rightBase);
          }
          if (task.kind === "executor-number") assert.equal(next.meta.commandLimit, task.meta.commandLimit);
          if (task.kind === "executor-drawing") {
            assert.equal(next.meta.repeatCount, task.meta.repeatCount);
            assert.equal(next.meta.sequence.length, task.meta.sequence.length);
            assert.ok(next.meta.sequence.every((move) => move.dx !== 0 || move.dy !== 0));
          }
          if (task.kind === "program-loop") assert.equal(next.meta.numbers.length, task.meta.numbers.length);
          if (module.id === "logic") assert.equal(operationCount(next.meta.expression), operationCount(task.meta.expression));
          task = next;
        }
      }
    }
  });
}

test("доступны все 12 направлений перевода и все восемь арифметических вариантов", () => {
  assert.equal(taskVariants.systems.filter((variant) => variant.id.startsWith("convert-")).length, 12);
  assert.equal(taskVariants.arithmetic.length, 8);
  for (const module of modules) assert.equal(new Set(taskVariants[module.id].map((variant) => variant.id)).size, taskVariants[module.id].length);
});

test("самопроверка после учебного перевода сохраняет основания и порядок величины", () => {
  const module = modules.find((item) => item.id === "systems");
  for (const value of [0, 0.5, 0.999999]) {
    const reference = generateGuidedConversionTask(() => value);
    const next = generateSimilarTask(module, reference, () => value);
    assert.equal(next.meta.sourceBase, 10);
    assert.equal(next.meta.targetBase, reference.meta.targetBase);
    assert.notEqual(next.meta.number, reference.meta.number);
    assert.ok(next.meta.number >= 12 && next.meta.number <= 255);
    assert.ok(Math.abs(next.meta.source.length - reference.meta.source.length) <= 1);
  }
});

test("разные логические таблицы действительно зависят от всех своих переменных", () => {
  const module = modules.find((item) => item.id === "logic");
  for (const variantId of ["table-2", "table-3"]) {
    let previous = generateTaskForVariant(module, variantId, () => 0);
    for (let index = 0; index < 5; index += 1) {
      const task = generateSimilarTask(module, previous, () => 0);
      assert.notEqual(formatExpression(task.meta.expression), formatExpression(previous.meta.expression));
      for (const name of task.meta.variables) {
        const depends = task.meta.rows.some((row) => task.meta.rows.some((other) =>
          row.values[name] !== other.values[name] &&
          task.meta.variables.filter((item) => item !== name).every((item) => row.values[item] === other.values[item]) &&
          row.result !== other.result
        ));
        assert.equal(depends, true, `${variantId}: результат должен зависеть от ${name}`);
      }
      previous = task;
    }
  }
});

test("выбор отличающегося числа корректен на обеих границах и в соседнем разряде", () => {
  assert.equal(differentInteger(() => 0, 0, 1, 0), 1);
  assert.equal(differentInteger(() => 0.999999, 0, 1, 1), 0);
  assert.equal(similarInteger(() => 0.999999, 1024, 0, 1024, 2), 1023);
  assert.equal(similarInteger(() => 0, 0, 0, 1024, 2), 1);
  assert.throws(() => differentInteger(() => 0, 1, 1, 1), /нет другого/);
});

test("ошибочный вариант и задание из другой темы отклоняются", () => {
  const systems = modules.find((item) => item.id === "systems");
  const arithmetic = modules.find((item) => item.id === "arithmetic");
  assert.throws(() => generateTaskForVariant(systems, "convert-2-2"), /Неизвестный вариант/);
  assert.throws(() => generateSimilarTask(arithmetic, generateGuidedConversionTask(() => 0.5)), /не относится/);
});

test("все варианты исключают и учебный пример, и предыдущую самопроверку при постоянном rng", () => {
  for (const module of modules) {
    for (const variant of taskVariants[module.id]) {
      for (const value of [0, 0.5, 0.999999]) {
        const rng = () => value;
        const study = generateTaskForVariant(module, variant.id, rng);
        let previous = generateSimilarTask(module, study, rng);
        for (let repetition = 0; repetition < 4; repetition += 1) {
          const task = generateSimilarTask(module, study, rng, [previous]);
          assert.notEqual(identity(task), identity(study), `${module.id}/${variant.id}: учебная задача`);
          assert.notEqual(identity(task), identity(previous), `${module.id}/${variant.id}: прежняя самопроверка`);
          assert.equal(getTaskVariant(task), variant.id);
          assert.equal(module.checkAnswer(task, task.answer).correct, true);
          previous = task;
        }
        // Такое же исключение работает, если reference сам является предыдущим self.
        const task = generateSimilarTask(module, previous, rng, [study]);
        assert.notEqual(identity(task), identity(study));
        assert.notEqual(identity(task), identity(previous));
      }
    }
  }
});

test("на границах 0, 1, 1024 и частных 2, 3 остаётся третья новая задача", () => {
  const systems = modules.find((item) => item.id === "systems");
  const arithmetic = modules.find((item) => item.id === "arithmetic");
  for (const value of [0, 0.001, 0.999999]) {
    const study = generateTaskForVariant(systems, "convert-2-10", () => value);
    const previous = generateSimilarTask(systems, study, () => 0);
    const next = generateSimilarTask(systems, study, () => 0, [previous]);
    assert.notEqual(identity(next), identity(study));
    assert.notEqual(identity(next), identity(previous));
    assert.ok(Math.abs(next.meta.source.length - study.meta.source.length) <= 1);
  }
  for (const value of [0, 0.1]) {
    const study = generateTaskForVariant(arithmetic, "divide-2", () => value);
    assert.ok([2, 3].includes(study.meta.result));
    const previous = generateSimilarTask(arithmetic, study, () => 0);
    const next = generateSimilarTask(arithmetic, study, () => 0, [previous]);
    assert.notEqual(identity(next), identity(study));
    assert.notEqual(identity(next), identity(previous));
    assert.equal(next.meta.leftValue % next.meta.rightValue, 0);
    assert.ok(Math.abs(next.answer.length - study.answer.length) <= 1);
  }
});

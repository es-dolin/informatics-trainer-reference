import test from "node:test";
import assert from "node:assert/strict";
import { modules } from "../js/modules/index.js";
import { createLearningSteps } from "../js/learning-steps.js";
import { getTaskVariant, taskVariants } from "../js/similar-task.js";

const STORAGE_KEY = "informatics-trainer-reference-progress-v1";
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}
function makeAnswerForm(task, answer) {
  return {
    id: "exercise-form",
    querySelector(selector) {
      if (selector === "input[name=answer]:checked") return task.input.type === "choice" && answer !== "" ? { value: answer } : null;
      if (selector === "[name=answer]") return { value: typeof answer === "string" ? answer : "" };
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-answer-index]" && task.input.type === "truth-table") return answer.map((value) => ({ value }));
      if (selector === "input[name=answer]:checked" && task.input.type === "multi-choice") return answer.map((value) => ({ value }));
      return [];
    }
  };
}
function makeStepForm(values) {
  return { id: "learning-step-form", querySelector: (selector) => ({ value: values[Number(selector.match(/learning-(\d+)/)[1])] ?? "" }) };
}
function emptyAnswer(task) {
  if (task.input.type === "truth-table") return task.answer.map(() => "");
  if (task.input.type === "multi-choice") return [];
  return "";
}
function optionValue(option) { return typeof option === "string" ? option : option.value; }
function wrongAnswer(task) {
  if (task.input.type === "truth-table") return task.answer.map((value) => value === "1" ? "0" : "1");
  if (task.input.type === "multi-choice") return task.input.options.map(optionValue).filter((value) => !task.answer.includes(value));
  if (task.input.type === "choice") return task.input.options.map(optionValue).find((value) => value !== task.answer);
  return "?";
}
function partialAnswer(task) {
  if (task.input.type === "truth-table") return task.answer.map((value, index) => index === 0 ? value : "");
  if (task.input.type === "multi-choice") return [optionValue(task.input.options[0])];
  if (task.input.type === "choice") return optionValue(task.input.options[0]);
  return "PARTIAL";
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

test("два режима сохраняют шаги, проверяют самостоятельную попытку и разбирают ту же задачу", async (t) => {
  const originalDocument = globalThis.document;
  const originalStorage = globalThis.localStorage;
  const originalRandom = Math.random;
  const originalConfirm = globalThis.confirm;
  const storage = new MemoryStorage();
  // Сохранение предыдущей версии не содержит режима. Новая версия обязана его сохранить.
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, modules: { systems: { attempts: 2, correct: 1 } } }));
  storage.setItem("another-app", "keep");
  const generatedTasks = [];
  const originals = [];
  for (const module of modules) {
    for (const name of ["generateTask", "generateGuidedConversionTask", "generateVariantTask"]) {
      if (typeof module[name] !== "function") continue;
      const original = module[name];
      originals.push({ module, name, original });
      module[name] = (...args) => { const task = original(...args); generatedTasks.push(task); return task; };
    }
  }
  const root = {
    innerHTML: "", handlers: {}, forms: {},
    addEventListener(name, handler) { this.handlers[name] = handler; },
    querySelector(selector) {
      if (selector.startsWith("#") && !this.innerHTML.includes(`id="${selector.slice(1)}"`)) return null;
      return this.forms[selector] ?? null;
    }
  };
  globalThis.document = { querySelector: () => root };
  globalThis.localStorage = storage;
  globalThis.confirm = () => true;
  Math.random = () => 0.5;
  t.after(() => {
    globalThis.document = originalDocument;
    globalThis.localStorage = originalStorage;
    globalThis.confirm = originalConfirm;
    Math.random = originalRandom;
    for (const { module, name, original } of originals) module[name] = original;
  });
  await import("../js/app.js");
  const click = (data) => root.handlers.click({ target: { closest: () => ({ dataset: data }) } });
  const changeVariant = (value) => {
    const change = (id, nextValue) => root.handlers.change({ target: { id, value: nextValue } });
    if (!value.startsWith("convert-")) { change("task-variant", value); return; }
    const [, source, target] = value.split("-").map((item, index) => index ? Number(item) : item);
    if (!root.innerHTML.includes('id="source-base"')) change("task-variant", "convert");
    let current = shownTask().meta;
    if (current.targetBase === source && current.sourceBase !== source) {
      const temporary = [2, 8, 10, 16].find((base) => base !== current.sourceBase && base !== source);
      change("target-base", String(temporary));
      current = shownTask().meta;
    }
    if (current.sourceBase !== source) change("source-base", String(source));
    if (shownTask().meta.targetBase !== target) change("target-base", String(target));
  };
  const submit = (form) => root.handlers.submit({ target: form, preventDefault() {} });
  const progress = () => JSON.parse(storage.getItem(STORAGE_KEY));
  const counts = (id) => progress()?.modules[id] ?? { attempts: 0, correct: 0 };
  const shownTask = () => {
    const prompt = root.innerHTML.match(/<h2 id="task-title">([\s\S]*?)<\/h2>/)?.[1];
    const task = generatedTasks.findLast((item) => escapeHtml(item.prompt) === prompt);
    assert.ok(task, "на экране находится задача, созданная генератором");
    return task;
  };
  const assertDraft = (task, draft) => {
    if (task.input.type === "text") assert.match(root.innerHTML, /value="PARTIAL"/);
    else if (["choice", "multi-choice"].includes(task.input.type)) {
      const value = Array.isArray(draft) ? draft[0] : draft;
      assert.ok(root.innerHTML.includes(`value="${escapeHtml(value)}" checked`));
    } else {
      const firstSelect = root.innerHTML.match(/<select id="truth-0"[\s\S]*?<\/select>/)?.[0];
      assert.ok(firstSelect.includes(`value="${draft[0]}" selected`));
    }
  };
  assert.match(root.innerHTML, /Инфо<span>Лаб/);
  assert.doesNotMatch(root.innerHTML, /Тренируйся|3 режима/);
  const header = root.innerHTML.match(/<header[\s\S]*?<\/header>/)[0];
  assert.equal((header.match(/data-action="progress"/g) ?? []).length, 1);
  const variants = { systems: "compare", arithmetic: "subtract-2", logic: "table-3", executors: "drawing", programs: "condition" };
  for (const module of modules) {
    await t.test(module.title, () => {
      click({ module: module.id });
      assert.equal((root.innerHTML.match(/class="mode-tab /g) ?? []).length, 2);
      assert.doesNotMatch(root.innerHTML, /data-mode="practice"/);
      changeVariant(variants[module.id]);
      const studyTask = shownTask();
      assert.equal(getTaskVariant(studyTask), variants[module.id]);
      assert.match(root.innerHTML, /id="learning-step-form"/);
      assert.match(root.innerHTML, /<aside/);
      assert.doesNotMatch(root.innerHTML, /id="exercise-form"/);
      const steps = createLearningSteps(studyTask);
      const before = { ...counts(module.id) };
      submit(makeStepForm([]));
      assert.match(root.innerHTML, /Заполни все поля/);
      submit(makeStepForm(steps[0].fields.map(() => "__wrong__")));
      assert.match(root.innerHTML, /aria-invalid="true"/);
      assert.deepEqual(counts(module.id), before, "ошибки изучения не меняют результаты");
      submit(makeAnswerForm(studyTask, studyTask.answer));
      assert.deepEqual(counts(module.id), before, "итоговая форма игнорируется в изучении");
      const draftValues = steps[0].fields.map((field) => field.options?.[0] ?? "DRAFT");
      root.forms["#learning-step-form"] = makeStepForm(draftValues);
      click({ mode: "test" });
      const selfTask = shownTask();
      assert.equal(getTaskVariant(selfTask), getTaskVariant(studyTask));
      assert.notDeepEqual(selfTask.meta, studyTask.meta, "самопроверка использует другие данные");
      assert.doesNotMatch(root.innerHTML, /learning-step-form|learning-plan|<aside|data-action="review-task"/);
      submit(makeStepForm(steps[0].fields.map((field) => field.answer)));
      assert.deepEqual(counts(module.id), before, "учебная форма игнорируется в самопроверке");
      click({ mode: "study" });
      assert.ok(root.innerHTML.includes(steps[0].fields[0].options ? `value="${escapeHtml(draftValues[0])}" selected` : 'value="DRAFT"'));
      delete root.forms["#learning-step-form"];
      for (const step of steps) submit(makeStepForm(step.fields.map((field) => field.answer)));
      assert.match(root.innerHTML, /Все шаги выполнены/);
      assert.deepEqual(counts(module.id), before);
      click({ mode: "test" });
      assert.equal(shownTask(), selfTask, "переключение возвращает подготовленную задачу");
      const draft = partialAnswer(selfTask);
      root.forms["#exercise-form"] = makeAnswerForm(selfTask, draft);
      click({ mode: "study" });
      click({ mode: "test" });
      assertDraft(selfTask, draft);
      delete root.forms["#exercise-form"];
      submit(makeAnswerForm(selfTask, emptyAnswer(selfTask)));
      assert.doesNotMatch(root.innerHTML, /data-action="review-task"/);
      assert.deepEqual(counts(module.id), before, "пустой ответ не считается");
      submit(makeAnswerForm(selfTask, wrongAnswer(selfTask)));
      assert.match(root.innerHTML, /data-action="review-task"/);
      assert.deepEqual(counts(module.id), { attempts: before.attempts + 1, correct: before.correct });
      submit(makeAnswerForm(selfTask, selfTask.answer));
      assert.match(root.innerHTML, /answer-feedback is-correct/);
      assert.deepEqual(counts(module.id), { attempts: before.attempts + 1, correct: before.correct }, "исправление не переписывает первую попытку");
      const callsBeforeReview = generatedTasks.length;
      click({ action: "review-task" });
      assert.equal(generatedTasks.length, callsBeforeReview, "разбор не генерирует другую задачу");
      assert.equal(shownTask(), selfTask);
      assert.match(root.innerHTML, /id="learning-step-form"/);
      for (const step of createLearningSteps(selfTask)) submit(makeStepForm(step.fields.map((field) => field.answer)));
      assert.deepEqual(counts(module.id), { attempts: before.attempts + 1, correct: before.correct });
      click({ action: "start-test" });
      const nextTask = shownTask();
      assert.notDeepEqual(nextTask.meta, selfTask.meta, "после разбора появляется новая задача");
      assert.equal(getTaskVariant(nextTask), getTaskVariant(selfTask));
      submit(makeAnswerForm(nextTask, nextTask.answer));
      assert.deepEqual(counts(module.id), { attempts: before.attempts + 2, correct: before.correct + 1 });
      click({ mode: "study" });
      click({ action: "start-test" });
      const restartedTask = shownTask();
      assert.notDeepEqual(restartedTask.meta, nextTask.meta, "новая самопроверка после обычного возврата к изучению не повторяет предыдущую");
      click({ action: "new-task" });
      assert.notDeepEqual(shownTask().meta, restartedTask.meta);
      assert.deepEqual(counts(module.id), { attempts: before.attempts + 2, correct: before.correct + 1 });
    });
  }
  await t.test("все варианты доступны в изучении и поддерживают проверяемый шаг", () => {
    const before = storage.getItem(STORAGE_KEY);
    for (const module of modules) {
      click({ module: module.id });
      for (const variant of taskVariants[module.id]) {
        changeVariant(variant.id);
        const task = shownTask();
        assert.equal(getTaskVariant(task), variant.id);
        if (module.id !== "systems") assert.ok(root.innerHTML.includes(`value="${variant.id}" selected`));
        const firstStep = createLearningSteps(task)[0];
        submit(makeStepForm(firstStep.fields.map((field) => field.answer)));
        assert.doesNotMatch(root.innerHTML, /guided-feedback is-wrong/);
      }
    }
    assert.equal(storage.getItem(STORAGE_KEY), before);
  });
  click({ action: "progress" });
  assert.match(root.innerHTML, /<h1>Результаты<\/h1>/);
  assert.equal(counts("systems").attempts, 4, "две попытки прежней версии не потеряны");
  click({ action: "clear-progress" });
  assert.match(root.innerHTML, /Результаты очищены/);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem("another-app"), "keep");
});

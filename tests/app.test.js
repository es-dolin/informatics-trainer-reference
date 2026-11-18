import test from "node:test";
import assert from "node:assert/strict";
import { modules } from "../js/modules/index.js";
import { generateComparisonTask, generateGuidedConversionTask } from "../js/modules/systems.js";
import { createLearningSteps } from "../js/learning-steps.js";

const STORAGE_KEY = "informatics-trainer-reference-progress-v1";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function makeForm(task, answer) {
  return {
    id: "exercise-form",
    querySelector(selector) {
      if (selector === "input[name=answer]:checked") {
        return task.input.type === "choice" && answer !== "" ? { value: answer } : null;
      }
      if (selector === "[name=answer]") {
        return { value: typeof answer === "string" ? answer : "" };
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-answer-index]" && task.input.type === "truth-table") {
        return answer.map((value) => ({ value }));
      }
      if (selector === "input[name=answer]:checked" && task.input.type === "multi-choice") {
        return answer.map((value) => ({ value }));
      }
      return [];
    }
  };
}

function emptyAnswer(task) {
  if (task.input.type === "truth-table") return task.answer.map(() => "");
  if (task.input.type === "multi-choice") return [];
  return "";
}

function wrongAnswer(task) {
  if (task.input.type === "truth-table") {
    return task.answer.map((value) => value === "1" ? "0" : "1");
  }
  if (task.input.type === "multi-choice") return [...task.answer, "__wrong__"];
  if (task.input.type === "choice") {
    return task.input.options
      .map((item) => typeof item === "string" ? item : item.value)
      .find((value) => value !== task.answer);
  }
  return "?";
}

function firstOptionValue(task) {
  const option = task.input.options[0];
  return typeof option === "string" ? option : option.value;
}

function progressFrom(storage) {
  return JSON.parse(storage.getItem(STORAGE_KEY));
}

test("экраны сохраняют ответы, считают первую попытку и обучают переводу числа", async (t) => {
  const originalDocument = globalThis.document;
  const originalStorage = globalThis.localStorage;
  const originalRandom = Math.random;
  const storage = new MemoryStorage();
  const calls = new Map(modules.map((module) => [module.id, 0]));
  const originalGenerators = new Map();

  for (const module of modules) {
    originalGenerators.set(module.id, module.generateTask);
    module.generateTask = (...args) => {
      calls.set(module.id, calls.get(module.id) + 1);
      return originalGenerators.get(module.id)(...args);
    };
  }

  const root = {
    innerHTML: "",
    handlers: {},
    forms: {},
    addEventListener(name, handler) { this.handlers[name] = handler; },
    querySelector(selector) {
      if (selector.startsWith("#") && !this.innerHTML.includes(`id="${selector.slice(1)}"`)) return null;
      return this.forms[selector] ?? null;
    }
  };
  globalThis.document = { querySelector: () => root };
  globalThis.localStorage = storage;
  Math.random = () => 0.5;

  t.after(() => {
    globalThis.document = originalDocument;
    globalThis.localStorage = originalStorage;
    Math.random = originalRandom;
    for (const module of modules) module.generateTask = originalGenerators.get(module.id);
  });

  await import("../js/app.js");

  const click = (data) => root.handlers.click({ target: { closest: () => ({ dataset: data }) } });
  const submit = (form) => root.handlers.submit({ target: form, preventDefault() {} });

  assert.match(root.innerHTML, /Инфо<span>Лаб/);
  assert.equal((root.innerHTML.match(/class="module-card /g) ?? []).length, 5);
  const header = root.innerHTML.match(/<header[\s\S]*?<\/header>/)[0];
  assert.equal((header.match(/data-action="progress"/g) ?? []).length, 1, "один переход к результатам в шапке");
  assert.match(root.innerHTML, /Изучай\.<br>Тренируйся\.<br><span>Проверь себя\./);

  click({ module: "systems" });
  const guidedTask = generateGuidedConversionTask(() => 0.5);
  assert.match(root.innerHTML, /ИНТЕРАКТИВНЫЙ РАЗБОР/);
  assert.match(root.innerHTML, /guided-division-form/);

  root.forms["#guided-division-form"] = {
    querySelector(selector) {
      return { value: selector.includes("quotient") ? "999" : "Z" };
    }
  };
  click({ action: "guided-hint" });
  assert.match(root.innerHTML, /value="999"/, "подсказка сохраняет введённые промежуточные числа");
  assert.match(root.innerHTML, /Частное - целая часть/);

  click({ mode: "practice" });
  click({ mode: "study" });
  assert.match(root.innerHTML, /value="999"/, "смена режима сохраняет незавершённый шаг");

  for (const step of guidedTask.meta.divisions) {
    submit({
      id: "guided-division-form",
      querySelector(selector) {
        return { value: selector.includes("quotient") ? String(step.quotient) : step.remainder };
      }
    });
  }
  assert.match(root.innerHTML, /guided-final-form/);

  submit({ id: "guided-final-form", querySelector: () => ({ value: "00" }) });
  assert.match(root.innerHTML, /Проверь порядок/);

  submit({ id: "guided-final-form", querySelector: () => ({ value: guidedTask.answer }) });
  assert.match(root.innerHTML, /Перевод выполнен/);
  assert.match(root.innerHTML, /Читаем остатки снизу вверх/);
  assert.equal(storage.getItem(STORAGE_KEY), null, "учебный разбор не попадает в статистику");

  for (const module of modules) {
    if (module.id !== "systems") click({ module: module.id });
    const task = module.generateTask(() => 0.5);
    const callsBeforeModeChange = calls.get(module.id);

    if (module.id !== "systems") {
      click({ mode: "study" });
      assert.match(root.innerHTML, /ПРИМЕР ПО ШАГАМ/);
      assert.doesNotMatch(root.innerHTML, /id="exercise-form"/, "в изучении проверяются шаги, а не только итог");
      const steps = createLearningSteps(task);
      const stepForm = (values) => ({ id: "learning-step-form", querySelector: (selector) => ({ value: values[Number(selector.match(/learning-(\d+)/)[1])] ?? "" }) });
      submit(stepForm([]));
      assert.match(root.innerHTML, /Заполни все поля/);
      submit(stepForm(steps[0].fields.map(() => "__wrong__")));
      assert.match(root.innerHTML, /Проверь:/);
      assert.match(root.innerHTML, /aria-invalid="true"/);
      const draftValues = steps[0].fields.map((field) => field.options ? field.options[0] : "DRAFT");
      root.forms["#learning-step-form"] = stepForm(draftValues);
      click({ mode: "practice" });
      click({ mode: "study" });
      assert.match(root.innerHTML, steps[0].fields[0].options ? new RegExp(`value="${draftValues[0]}" selected`) : /value="DRAFT"/, "введённый шаг изучения сохраняется");
      delete root.forms["#learning-step-form"];
      for (const step of steps) submit(stepForm(step.fields.map((field) => field.answer)));
      assert.match(root.innerHTML, /Все шаги выполнены/);
      assert.equal(progressFrom(storage)?.modules[module.id]?.attempts ?? 0, 0, "учебные шаги не добавляют попытки");
    }

    click({ mode: "practice" });
    assert.match(root.innerHTML, /Показать подсказку/);
    assert.match(root.innerHTML, /План решения/);
    click({ action: "practice-steps" });
    assert.match(root.innerHTML, /id="learning-step-form"/);
    const practiceSteps = createLearningSteps(task);
    const practiceForm = (values) => ({ id: "learning-step-form", querySelector: (selector) => ({ value: values[Number(selector.match(/learning-(\d+)/)[1])] ?? "" }) });
    for (const step of practiceSteps) submit(practiceForm(step.fields.map((field) => field.answer)));
    assert.match(root.innerHTML, /Теперь запиши итоговый ответ/);
    assert.equal(progressFrom(storage)?.modules[module.id]?.attempts ?? 0, 0, "помощь по шагам не отправляет итоговый ответ");

    root.forms["#exercise-form"] = makeForm(task, emptyAnswer(task));
    submit(root.forms["#exercise-form"]);
    assert.match(root.innerHTML, /не засчитывается|Нужен ответ|Заполни результат/);
    const beforeAnswer = progressFrom(storage)?.modules[module.id]?.attempts ?? 0;

    click({ action: "hint" });
    assert.match(root.innerHTML, /class="hint-box"/);

    const wrong = wrongAnswer(task);
    assert.equal(module.checkAnswer(task, wrong).correct, false);
    assert.equal(Boolean(module.checkAnswer(task, wrong).empty), false);
    root.forms["#exercise-form"] = makeForm(task, wrong);
    submit(root.forms["#exercise-form"]);
    assert.match(root.innerHTML, /Разбор решения/);
    let progress = progressFrom(storage);
    assert.equal(progress.modules[module.id].attempts, beforeAnswer + 1, module.id + ": первый непустой ответ считается");
    assert.equal(progress.modules[module.id].correct, 0, module.id + ": неверный первый ответ остаётся неверным");

    root.forms["#exercise-form"] = makeForm(task, task.answer);
    submit(root.forms["#exercise-form"]);
    assert.match(root.innerHTML, /верно|Верно/);
    progress = progressFrom(storage);
    assert.equal(progress.modules[module.id].attempts, beforeAnswer + 1, module.id + ": исправление не добавляет попытку");
    assert.equal(progress.modules[module.id].correct, 0, module.id + ": исправление не переписывает первую попытку");

    root.forms["#exercise-form"] = makeForm(task, emptyAnswer(task));
    submit(root.forms["#exercise-form"]);
    assert.equal(progressFrom(storage).modules[module.id].attempts, beforeAnswer + 1, module.id + ": пустой ответ не считается");

    const promptBeforeModeChange = root.innerHTML.match(/<h2 id="task-title">([\s\S]*?)<\/h2>/)?.[1];
    let draft = wrong;
    if (task.input.type === "text") draft = "PARTIAL";
    else if (task.input.type === "choice") draft = firstOptionValue(task);
    else if (task.input.type === "multi-choice") draft = [firstOptionValue(task)];
    else if (task.input.type === "truth-table") draft = task.answer.map((value, index) => index === 0 ? value : "");

    root.forms["#exercise-form"] = makeForm(task, draft);
    click({ mode: "test" });
    assert.equal(calls.get(module.id), callsBeforeModeChange, module.id + ": режим не создаёт новое задание");
    assert.equal(root.innerHTML.match(/<h2 id="task-title">([\s\S]*?)<\/h2>/)?.[1], promptBeforeModeChange);
    assert.doesNotMatch(root.innerHTML, /Показать подсказку/);
    assert.doesNotMatch(root.innerHTML, /План решения|learning-step-form|Решить по шагам/, "самопроверка не показывает помощь");
    if (task.input.type === "text") assert.match(root.innerHTML, /value="PARTIAL"/);
    if (["choice", "multi-choice"].includes(task.input.type)) {
      assert.match(root.innerHTML, new RegExp(`value="${firstOptionValue(task)}" checked`));
    }
    if (task.input.type === "truth-table") {
      const firstSelect = root.innerHTML.match(/<select id="truth-0"[\s\S]*?<\/select>/)?.[0];
      assert.match(firstSelect, new RegExp(`value="${draft[0]}" selected`));
    }

    click({ mode: "study" });
    click({ mode: "practice" });
    if (task.input.type === "text") assert.match(root.innerHTML, /value="PARTIAL"/);

    click({ action: "new-task" });
    assert.equal(calls.get(module.id), callsBeforeModeChange + 2, module.id + ": новая задача запускает генератор");
    const nextTask = module.generateTask(() => 0.5);
    root.forms["#exercise-form"] = makeForm(nextTask, nextTask.answer);
    submit(root.forms["#exercise-form"]);
    progress = progressFrom(storage);
    assert.equal(progress.modules[module.id].attempts, beforeAnswer + 2, module.id + ": новое задание начинает новую попытку");
    assert.equal(progress.modules[module.id].correct, 1, module.id + ": правильный первый ответ засчитывается");
  }

  click({ action: "progress" });
  assert.match(root.innerHTML, /Мой прогресс/);
  click({ action: "home" });
  assert.match(root.innerHTML, /Тренажёры/);

  Math.random = () => 0.99;
  click({ module: "systems" });
  const comparisonTask = generateComparisonTask(() => 0.99);
  assert.match(root.innerHTML, /Выбери знак сравнения/);
  root.forms["#exercise-form"] = makeForm(comparisonTask, "=");
  click({ mode: "test" });
  assert.match(root.innerHTML, /value="=" checked/, "переключение режима сохраняет выбранный знак");

  click({ action: "progress" });
  click({ action: "clear-progress" });
  assert.match(root.innerHTML, /Результаты очищены/);
  assert.equal(storage.getItem(STORAGE_KEY), null, "очистка в интерфейсе удаляет только сохранённый прогресс");
});

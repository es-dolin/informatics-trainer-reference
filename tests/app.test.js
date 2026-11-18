import test from "node:test";
import assert from "node:assert/strict";
import { modules } from "../js/modules/index.js";
import { generateComparisonTask, generateGuidedConversionTask } from "../js/modules/systems.js";

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
    querySelector(selector) { return this.forms[selector] ?? null; }
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
  assert.match(root.innerHTML, /Частное — целая часть/);

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

    click({ mode: "practice" });
    assert.match(root.innerHTML, /Показать подсказку/);

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
  assert.match(root.innerHTML, /Прогресс очищен/);
  assert.equal(storage.getItem(STORAGE_KEY), null, "очистка в интерфейсе удаляет только сохранённый прогресс");
});

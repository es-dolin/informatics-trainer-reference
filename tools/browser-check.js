// Проверяет настоящий Chromium-браузер через встроенный протокол DevTools.
// Запуск: npm run test:browser. Для другого браузера задай INFO_LAB_BROWSER.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { modules } from "../js/modules/index.js";
import { createLearningSteps } from "../js/learning-steps.js";
import { getTaskVariant, taskVariants } from "../js/similar-task.js";

const browserPath = process.env.INFO_LAB_BROWSER ?? [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
].find(existsSync);
if (!browserPath) throw new Error("Укажи путь к Chrome или Edge в INFO_LAB_BROWSER.");
const output = path.resolve("artifacts/browser");
const profile = path.join(output, `profile-${Date.now()}`);
await mkdir(profile, { recursive: true });
const browser = spawn(browserPath, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--disable-extensions", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });

let socket;
let nextId = 0;
const pending = new Map();
const pageErrors = [];
const progressKey = "informatics-trainer-reference-progress-v1";

function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Таймаут: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function click(selector) {
  await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) throw new Error('Нет элемента: ' + ${JSON.stringify(selector)}); element.click(); })()`);
}

async function fillAndSubmit(id, values) {
  await evaluate(`(() => { const form = document.getElementById(${JSON.stringify(id)}); const controls = [...form.querySelectorAll('input, select')]; const values = ${JSON.stringify(values)}; controls.forEach((control, index) => { control.value = values[index]; }); form.requestSubmit(); })()`);
}

async function screenshot(name) {
  await evaluate("Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})))");
  const result = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(path.join(output, `${name}.png`), Buffer.from(result.data, "base64"));
}

async function checkLayout(label) {
  const overflow = await evaluate(`({ viewport: innerWidth, page: document.documentElement.scrollWidth, wide: [...document.querySelectorAll('h1, .mode-tab, .learning-step, .learning-step-form, .task-panel')].filter(element => element.scrollWidth > element.clientWidth + 2).map(element => element.className || element.tagName) })`);
  assert.ok(overflow.page <= overflow.viewport + 1, `${label}: страница шире экрана: ${JSON.stringify(overflow)}`);
  assert.deepEqual(overflow.wide, [], `${label}: блоки с переполнением`);
}

async function changeVariant(value) {
  await evaluate(`(() => { const select = document.getElementById('task-variant'); select.value = ${JSON.stringify(value)}; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
}
async function shownTask() {
  const task = await evaluate("globalThis.__infoLabGenerated.findLast(task => task.prompt === document.getElementById('task-title').textContent)");
  assert.ok(task, "на экране находится объект генератора");
  return task;
}
async function storedProgress() {
  return evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(progressKey)}))`);
}
async function fillExercise(task, answer, keyboard = false) {
  await evaluate(`(() => {
    const form = document.getElementById('exercise-form');
    const answer = ${JSON.stringify(answer)};
    const type = ${JSON.stringify(task.input.type)};
    if (type === 'truth-table') [...form.querySelectorAll('select')].forEach((control, index) => { control.value = answer[index]; });
    else if (type === 'multi-choice') [...form.querySelectorAll('input')].forEach(control => { control.checked = answer.includes(control.value); });
    else if (type === 'choice') [...form.querySelectorAll('input')].forEach(control => { control.checked = control.value === answer; });
    else form.querySelector('input').value = answer;
    ${keyboard ? "form.querySelector('button[type=submit]').focus();" : "form.requestSubmit();"}
  })()`);
  if (keyboard) {
    await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r" });
    await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  }
}
function emptyAnswer(task) {
  if (task.input.type === "truth-table") return task.answer.map(() => "");
  if (task.input.type === "multi-choice") return [];
  return "";
}
function wrongAnswer(task) {
  if (task.input.type === "truth-table") return task.answer.map(value => value === "1" ? "0" : "1");
  if (task.input.type === "multi-choice") return task.input.options.map(option => option.value).filter(value => !task.answer.includes(value));
  if (task.input.type === "choice") return task.input.options.map(option => typeof option === "string" ? option : option.value).find(value => value !== task.answer);
  return "?";
}

try {
  let port;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { port = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; break; }
    catch { await delay(100); }
  }
  if (!port) throw new Error("Браузер не создал DevToolsActivePort.");
  const tabs = await (await fetch(`http://localhost:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find((tab) => tab.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") pageErrors.push(message.params.exceptionDetails);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timeout);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Page.addScriptToEvaluateOnNewDocument", { source: `Math.random = () => 0.5; localStorage.setItem(${JSON.stringify(progressKey)}, JSON.stringify({ version: 1, modules: { systems: { attempts: 2, correct: 1 } } }));` });
  await command("Page.navigate", { url: process.env.INFO_LAB_URL ?? "http://localhost:4173/" });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate("Boolean(document.querySelector('[data-module]'))")) break;
    await delay(100);
  }
  // Объекты модулей доступны приложению и тесту через один кеш import.
  // Обёртки позволяют проверять фактически показанную задачу без доступа к state.
  await evaluate(`(async () => {
    const { modules } = await import('./js/modules/index.js');
    globalThis.__infoLabGenerated = [];
    for (const module of modules) for (const name of ['generateTask', 'generateGuidedConversionTask', 'generateVariantTask']) {
      if (typeof module[name] !== 'function') continue;
      const original = module[name];
      module[name] = (...args) => { const task = original(...args); globalThis.__infoLabGenerated.push(task); return task; };
    }
  })()`);
  assert.equal(await evaluate("document.querySelectorAll('header [data-action=progress]').length"), 1);
  assert.equal(await evaluate("document.body.textContent.includes('Тренируйся')"), false);
  await evaluate("document.querySelector('.brand').focus()");
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement.classList.contains('topnav-link')"), true, "Tab переводит фокус в навигацию");
  const sizes = [320, 390, 768, 1440];
  for (const width of sizes) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await checkLayout(`Главная ${width}`);
    await screenshot(`home-${width}`);
  }
  for (const module of modules) {
    await click(`[data-module="${module.id}"]`);
    assert.equal(await evaluate("document.querySelectorAll('.mode-tab').length"), 2);
    const studyTask = await shownTask();
    const steps = createLearningSteps(studyTask);
    const before = (await storedProgress())?.modules[module.id] ?? { attempts: 0, correct: 0 };
    const savedBeforeStudy = JSON.stringify(await storedProgress());
    for (const width of sizes) {
      await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await checkLayout(`${module.id} изучение ${width}`);
      if (width === 390 || width === 1440) await screenshot(`${module.id}-study-${width}`);
    }
    assert.equal(await evaluate("Boolean(document.querySelector('.step-instructions .step-instruction'))"), true);
    await fillAndSubmit("learning-step-form", steps[0].fields.map(() => ""));
    assert.match(await evaluate("document.querySelector('.guided-feedback').textContent"), /Заполни/);
    const draft = steps[0].fields[0].options?.[0] ?? "123";
    await evaluate(`document.querySelector('[name=learning-0]').value = ${JSON.stringify(draft)}`);
    await click('[data-mode="test"]');
    const selfTask = await shownTask();
    assert.equal(getTaskVariant(selfTask), getTaskVariant(studyTask));
    assert.notDeepEqual(selfTask.meta, studyTask.meta);
    assert.equal(await evaluate("Boolean(document.querySelector('.learning-plan, #learning-step-form, .step-instructions, [data-action=review-task]'))"), false);
    await click('[data-mode="study"]');
    assert.equal(await evaluate("document.querySelector('[name=learning-0]').value"), draft);
    for (const step of steps) await fillAndSubmit("learning-step-form", step.fields.map((field) => field.answer));
    assert.match(await evaluate("document.querySelector('.learning-complete').textContent"), /Все шаги выполнены/);
    assert.equal(JSON.stringify(await storedProgress()), savedBeforeStudy, "учебные шаги не меняют результаты");
    await click('[data-mode="test"]');
    assert.deepEqual(await shownTask(), selfTask, "обычное переключение сохраняет самостоятельную задачу");
    for (const width of sizes) {
      await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await checkLayout(`${module.id} самопроверка ${width}`);
      if (width === 390 || width === 1440) await screenshot(`${module.id}-test-${width}`);
    }
    await fillExercise(selfTask, emptyAnswer(selfTask));
    assert.equal(await evaluate("Boolean(document.querySelector('[data-action=review-task]'))"), false);
    assert.equal(JSON.stringify(await storedProgress()), savedBeforeStudy, "пустой ответ не засчитывается");
    await fillExercise(selfTask, wrongAnswer(selfTask));
    const afterWrong = (await storedProgress()).modules[module.id];
    assert.deepEqual(afterWrong, { attempts: before.attempts + 1, correct: before.correct });
    await fillExercise(selfTask, selfTask.answer, true);
    assert.equal(await evaluate("Boolean(document.querySelector('.answer-feedback.is-correct'))"), true, "Enter проверяет ответ");
    assert.deepEqual((await storedProgress()).modules[module.id], afterWrong, "исправление не переписывает попытку");
    await click('[data-action="review-task"]');
    assert.deepEqual(await shownTask(), selfTask, "разбирается именно проверенная задача");
    for (const step of createLearningSteps(selfTask)) await fillAndSubmit("learning-step-form", step.fields.map((field) => field.answer));
    assert.deepEqual((await storedProgress()).modules[module.id], afterWrong);
    await click('[data-action="start-test"]');
    const nextTask = await shownTask();
    assert.notDeepEqual(nextTask.meta, selfTask.meta);
    assert.equal(getTaskVariant(nextTask), getTaskVariant(selfTask));
    await fillExercise(nextTask, nextTask.answer, true);
    assert.equal(await evaluate("Boolean(document.querySelector('.answer-feedback.is-correct'))"), true);
    assert.deepEqual((await storedProgress()).modules[module.id], { attempts: before.attempts + 2, correct: before.correct + 1 });
    await click('[data-action="home"]');
    console.log(`${module.title}: изучение, самопроверка, разбор попытки - OK`);
  }
  const beforeVariants = JSON.stringify(await storedProgress());
  let variantCount = 0;
  for (const module of modules) {
    await click(`[data-module="${module.id}"]`);
    for (const variant of taskVariants[module.id]) {
      await changeVariant(variant.id);
      const task = await shownTask();
      assert.equal(getTaskVariant(task), variant.id);
      for (const width of [390, 1440]) {
        await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
        await checkLayout(`${module.id} ${variant.id} ${width}`);
      }
      const steps = createLearningSteps(task);
      for (let index = 0; index < steps.length; index += 1) {
        await fillAndSubmit("learning-step-form", steps[index].fields.map((field) => field.answer));
        if (task.kind === "executor-drawing") {
          const points = await evaluate("document.querySelector('.task-panel polyline').getAttribute('points').split(' ').length");
          assert.equal(points, index + 2, "путь растёт только после правильного шага");
          if (index === 1) await screenshot("drawing-after-two-steps");
        }
      }
      assert.equal(await evaluate("Boolean(document.querySelector('.learning-complete'))"), true);
      variantCount += 1;
    }
    await click('[data-action="home"]');
  }
  assert.equal(JSON.stringify(await storedProgress()), beforeVariants);
  assert.deepEqual(pageErrors, [], "в браузере не должно быть ошибок JavaScript");
  console.log(`Все ${variantCount} видов заданий пройдены по шагам. Ширины ${sizes.join(', ')} px.`);
  console.log(`Скриншоты: ${output}`);
} finally {
  socket?.close();
  browser.kill();
}

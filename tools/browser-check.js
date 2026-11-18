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
  await command("Page.addScriptToEvaluateOnNewDocument", { source: "Math.random = () => 0.5;" });
  await command("Page.navigate", { url: process.env.INFO_LAB_URL ?? "http://localhost:4173/" });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate("Boolean(document.querySelector('[data-module]'))")) break;
    await delay(100);
  }
  assert.equal(await evaluate("document.querySelectorAll('header [data-action=progress]').length"), 1);
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
  let totalAttempts = 0;
  for (const module of modules) {
    await click(`[data-module="${module.id}"]`);
    await click('[data-mode="study"]');
    const task = module.generateTask(() => 0.5);
    for (const width of sizes) {
      await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await checkLayout(`${module.id} изучение ${width}`);
    }
    if (module.id === "systems") {
      const task = module.generateGuidedConversionTask(() => 0.5);
      for (const division of task.meta.divisions) await fillAndSubmit("guided-division-form", [String(division.quotient), division.remainder]);
      await fillAndSubmit("guided-final-form", [task.answer]);
      assert.equal(await evaluate("Boolean(document.querySelector('.guided-complete'))"), true);
    } else {
      assert.equal(await evaluate("Boolean(document.getElementById('learning-step-form'))"), true);
      await fillAndSubmit("learning-step-form", createLearningSteps(task)[0].fields.map(() => ""));
      assert.match(await evaluate("document.querySelector('.guided-feedback').textContent"), /Заполни/);
      for (const step of createLearningSteps(task)) await fillAndSubmit("learning-step-form", step.fields.map((field) => field.answer));
      assert.match(await evaluate("document.querySelector('.learning-complete').textContent"), /Все шаги выполнены/);
    }
    await click('[data-mode="practice"]');
    assert.equal(await evaluate("Boolean(document.querySelector('.learning-plan'))"), true);
    await click('[data-action="practice-steps"]');
    const steps = createLearningSteps(task);
    // Смена режима сохраняет черновик и номер учебного шага.
    const draft = steps[0].fields[0].options?.[0] ?? "123";
    await evaluate(`document.querySelector('[name=learning-0]').value = ${JSON.stringify(draft)}`);
    await click('[data-mode="test"]');
    assert.equal(await evaluate("Boolean(document.querySelector('.learning-plan, #learning-step-form'))"), false);
    await click('[data-mode="practice"]');
    assert.equal(await evaluate("document.querySelector('[name=learning-0]').value"), draft);
    for (const width of sizes) {
      await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await checkLayout(`${module.id} практика ${width}`);
      if (width === 390 || width === 1440) await screenshot(`${module.id}-practice-${width}`);
    }
    for (const step of steps) await fillAndSubmit("learning-step-form", step.fields.map((field) => field.answer));
    assert.match(await evaluate("document.querySelector('.learning-complete').textContent"), /Все шаги выполнены/);
    assert.equal(await evaluate(`Object.values(JSON.parse(localStorage.getItem(${JSON.stringify(progressKey)}) ?? '{"modules":{}}').modules).reduce((sum, item) => sum + item.attempts, 0)`), totalAttempts, "учебные шаги не меняют результаты");
    await click('[data-mode="test"]');
    for (const width of sizes) {
      await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await checkLayout(`${module.id} самопроверка ${width}`);
    }
    await evaluate(`(() => {
      const form = document.getElementById('exercise-form');
      const answer = ${JSON.stringify(task.answer)};
      const type = ${JSON.stringify(task.input.type)};
      if (type === 'truth-table') [...form.querySelectorAll('select')].forEach((control, index) => { control.value = answer[index]; });
      else if (type === 'multi-choice') [...form.querySelectorAll('input')].forEach(control => { control.checked = answer.includes(control.value); });
      else if (type === 'choice') [...form.querySelectorAll('input')].forEach(control => { control.checked = control.value === answer; });
      else form.querySelector('input').value = answer;
      form.querySelector('button[type=submit]').focus();
    })()`);
    await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r" });
    await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    const submitted = await evaluate("({ correct: Boolean(document.querySelector('.answer-feedback.is-correct')), message: document.querySelector('.answer-feedback')?.textContent, active: document.activeElement?.outerHTML })");
    assert.equal(submitted.correct, true, `Enter проверяет правильный итоговый ответ: ${JSON.stringify(submitted)}`);
    totalAttempts += 1;
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(progressKey)})).modules[${JSON.stringify(module.id)}].correct`), 1);
    await click('[data-action="home"]');
    console.log(`${module.title}: изучение, практика, самопроверка - OK`);
  }
  // Другие ветки генераторов: таблица из трёх переменных, Чертёжник, цикл,
  // разные арифметические операции и сравнение чисел.
  const scenarios = [
    { id: "systems", values: [0.95] },
    { id: "arithmetic", values: [0.1] },
    { id: "arithmetic", values: [0.1, 0.8, 0.8] },
    { id: "arithmetic", values: [0.9, 0] },
    { id: "arithmetic", values: [0.9, 0.3] },
    { id: "arithmetic", values: [0.9] },
    { id: "logic", values: [0.1] },
    { id: "logic", values: [0.95] },
    { id: "executors", values: [0.95] },
    { id: "programs", values: [0.95] }
  ];
  for (const scenario of scenarios) {
    let index = 0;
    const rng = () => scenario.values[index++] ?? scenario.values.at(-1);
    const module = modules.find((item) => item.id === scenario.id);
    const task = module.generateTask(rng);
    await evaluate(`(() => { let index = 0; const values = ${JSON.stringify(scenario.values)}; Math.random = () => values[index++] ?? values.at(-1); })()`);
    await click(`[data-module="${module.id}"]`);
    await click('[data-mode="practice"]');
    await click('[data-action="practice-steps"]');
    for (const width of [390, 1440]) {
      await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await checkLayout(`${task.kind} ${width}`);
    }
    const steps = createLearningSteps(task);
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
      await fillAndSubmit("learning-step-form", steps[stepIndex].fields.map((field) => field.answer));
      if (task.kind === "executor-drawing") {
        const pointCount = await evaluate("document.querySelector('#practice-walkthrough polyline').getAttribute('points').split(' ').length");
        assert.equal(pointCount, stepIndex + 2, "путь растёт только после правильного шага");
        if (stepIndex === 1) await screenshot("drawing-after-two-steps");
      }
    }
    assert.equal(await evaluate("Boolean(document.querySelector('.learning-complete'))"), true);
    await click('[data-action="home"]');
  }
  assert.equal(await evaluate(`Object.values(JSON.parse(localStorage.getItem(${JSON.stringify(progressKey)})).modules).reduce((sum, item) => sum + item.attempts, 0)`), totalAttempts);
  console.log("Дополнительные подтипы: сравнение, арифметика, логика, Чертёжник и цикл - OK");
  assert.deepEqual(pageErrors, [], "в браузере не должно быть ошибок JavaScript");
  console.log(`Проверены ширины ${sizes.join(', ')} px. Скриншоты: ${output}`);
} finally {
  socket?.close();
  browser.kill();
}

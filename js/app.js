// Главный файл отвечает за экраны и события. Математические расчёты находятся
// в отдельных модулях, а здесь мы только показываем задание и передаём ответ.
import { modules, findModule } from "./modules/index.js";
import { clearProgress, loadProgress, recordAttempt } from "./storage.js";

const app = document.querySelector("#app");
const modes = [
  { id: "study", label: "Разбор темы", note: "Теория и пример" },
  { id: "practice", label: "Практика", note: "Решай с подсказкой" },
  { id: "test", label: "Самопроверка", note: "Сначала реши сам" }
];

const state = {
  screen: "home",
  moduleId: null,
  mode: "study",
  task: null,
  exampleTask: null,
  hintIsVisible: false,
  feedback: null,
  notice: "",
  heroStep: 0,
  progress: loadProgress()
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function allAttempts(progress = state.progress) {
  return Object.values(progress.modules).reduce((total, item) => total + item.attempts, 0);
}

function accuracy(attempts, correct) {
  if (attempts === 0) return "—";
  return `${Math.round((correct / attempts) * 100)}%`;
}

const heroSteps = [
  { label: "Число", value: "1011₂", note: "Запись в двоичной системе" },
  { label: "Разряды", value: "1×8 + 0×4 + 1×2 + 1×1", note: "Каждая позиция — степень основания 2" },
  { label: "Результат", value: "11₁₀", note: "То же значение в десятичной системе" }
];

function renderTopicVisual(module) {
  if (module.id === "systems") {
    return `<div class="card-visual visual-systems"><span class="visual-base">2</span><div class="bit-bars"><i></i><i></i><i></i><i></i><i></i></div><span class="visual-base">16</span></div>`;
  }
  if (module.id === "arithmetic") {
    return `<div class="card-visual visual-arithmetic"><code>1011₂</code><b>+</b><code>0110₂</code><span class="visual-equals">=</span><i>10001₂</i></div>`;
  }
  if (module.id === "logic") {
    return `<div class="card-visual visual-logic"><svg viewBox="0 0 180 58" aria-hidden="true"><path d="M10 15h35l28 14M10 43h35l28-14m0 0h27m0 0 27-13m-27 13 27 14"/><circle cx="10" cy="15" r="4"/><circle cx="10" cy="43" r="4"/><rect x="72" y="19" width="29" height="20" rx="6"/><circle cx="158" cy="16" r="4"/><circle cx="158" cy="42" r="4"/></svg><span>A ∧ ¬B</span></div>`;
  }
  if (module.id === "executors") {
    return `<div class="card-visual visual-executors"><svg viewBox="0 0 180 58" aria-hidden="true"><path class="grid-lines" d="M0 15h180M0 29h180M0 43h180M30 0v58M60 0v58M90 0v58M120 0v58M150 0v58"/><path class="route-line" d="M31 43h29V29h30V15h30V29h30"/><circle cx="31" cy="43" r="4"/><circle cx="150" cy="29" r="4"/></svg><span>КОМАНДА → ПУТЬ</span></div>`;
  }
  return `<div class="card-visual visual-program"><code><span>if</span> условие:<br><b>вывод</b> результат</code><i>→ YES / NO</i></div>`;
}

function renderHeader() {
  const attempts = allAttempts();
  const responseWord = attempts === 1 ? "ответ" : attempts > 1 && attempts < 5 ? "ответа" : "ответов";
  const progressLabel = `${attempts} ${responseWord}`;
  return `
    <header class="topbar">
      <button class="brand" type="button" data-action="home" aria-label="На главную">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="brand-copy"><strong>Инфо<span>Лаб</span></strong><small>Интерактивная лаборатория информатики</small></span>
      </button>
      <nav class="topnav" aria-label="Основная навигация">
        <button class="topnav-link ${state.screen === "home" || state.screen === "module" ? "is-current" : ""}" type="button" data-action="home">Тренажёры</button>
        <button class="topnav-link ${state.screen === "progress" ? "is-current" : ""}" type="button" data-action="progress">Результаты</button>
      </nav>
      <button class="topbar-progress" type="button" data-action="progress"><span class="pulse-dot" aria-hidden="true"></span><span>${escapeHtml(progressLabel)}</span><b aria-hidden="true">↗</b></button>
    </header>`;
}

function renderHome() {
  const completed = modules.filter((item) => state.progress.modules[item.id].attempts > 0).length;
  const cards = modules.map((item) => {
    const progress = state.progress.modules[item.id];
    return `
      <button class="module-card ${item.color}" type="button" data-module="${item.id}">
        <span class="card-topline"><span class="module-icon" aria-hidden="true">${escapeHtml(item.icon)}</span><span class="module-number">ТЕМА ${item.number}</span></span>
        ${renderTopicVisual(item)}
        <span class="card-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.description)}</span></span>
        <span class="card-bottom"><span>${escapeHtml(item.skills)}</span><span class="card-progress">${progress.attempts ? `${progress.correct}/${progress.attempts} верно` : "Открыть тему"}<b aria-hidden="true">↗</b></span></span>
      </button>`;
  }).join("");
  const activeHeroStep = heroSteps[state.heroStep];

  return `
    <main class="page-content home-page">
      <section class="hero-grid" aria-labelledby="home-title">
        <div class="hero-copy">
          <p class="eyebrow"><span class="eyebrow-line"></span> лаборатория практики</p>
          <h1 id="home-title">Изучай.<br>Пробуй.<br><span>Понимай.</span></h1>
          <p class="hero-description">Информатика через интерактивные задания и разбор решений. Пять тем для практики в 8–9 классе.</p>
          <button class="primary-button" type="button" data-action="start-first">Начать тренировку <span aria-hidden="true">↘</span></button>
          <div class="hero-footnote"><span class="mini-check">✓</span> Новые задачи · пошаговый разбор · сохранение прогресса</div>
        </div>
        <div class="hero-lab" aria-label="Интерактивный пример перевода числа">
          <div class="lab-head"><div><span class="live-dot"></span><span>ЖИВОЙ ПРИМЕР</span></div><span>ШАГ 0${state.heroStep + 1} / 03</span></div>
          <div class="lab-flow" role="group" aria-label="Шаги перевода числа">
            ${heroSteps.map((step, index) => `<button class="lab-step ${index === state.heroStep ? "is-active" : ""} ${index < state.heroStep ? "is-done" : ""}" type="button" data-action="hero-step" data-step="${index}" aria-pressed="${index === state.heroStep}"><span>0${index + 1}</span><strong>${escapeHtml(step.label)}</strong><small>${index === state.heroStep ? escapeHtml(step.value) : index < state.heroStep ? "✓ Готово" : "Ожидает"}</small></button>${index < heroSteps.length - 1 ? `<span class="flow-connector ${index < state.heroStep ? "is-done" : ""}" aria-hidden="true">→</span>` : ""}`).join("")}
          </div>
          <div class="lab-explanation"><div><span class="lab-kicker">${escapeHtml(activeHeroStep.label)}</span><strong>${escapeHtml(activeHeroStep.value)}</strong><p>${escapeHtml(activeHeroStep.note)}</p></div><button class="lab-next" type="button" data-action="hero-next" aria-label="Следующий шаг">${state.heroStep === heroSteps.length - 1 ? "↺" : "→"}</button></div>
          <div class="lab-footer"><span><i></i><i></i><i></i></span><span>Числовые системы · пример</span><span>1011₂ = 11₁₀</span></div>
        </div>
      </section>

      <section class="topic-section" aria-labelledby="topics-title">
        <div class="section-heading"><div><p class="eyebrow">пять направлений</p><h2 id="topics-title">Тренажёры</h2></div><p class="section-side-note">${completed} из 5 тем начато <span class="side-divider">·</span> 3 режима<br><span>Выбери тему и начни практику</span></p></div>
        <div class="module-grid">${cards}</div>
      </section>
      <section class="method-strip" aria-label="Как учиться в ИнфоЛаб">
        <div class="method-intro"><span class="method-index">ТВОЙ ЦИКЛ ОБУЧЕНИЯ</span><strong>От первого шага до уверенного ответа</strong></div>
        <div class="method-step"><b>01</b><span><strong>Разбор темы</strong><small>Теория и пример</small></span></div>
        <span class="method-arrow" aria-hidden="true">→</span>
        <div class="method-step"><b>02</b><span><strong>Практика</strong><small>Задачи с подсказкой</small></span></div>
        <span class="method-arrow" aria-hidden="true">→</span>
        <div class="method-step"><b>03</b><span><strong>Самопроверка</strong><small>Проверь свой результат</small></span></div>
      </section>
      <p class="demo-note">Учебная версия ИнфоЛаб · прогресс хранится только в этом браузере</p>
    </main>`;
}

function renderProgress() {
  const total = allAttempts();
  const correct = Object.values(state.progress.modules).reduce((sum, item) => sum + item.correct, 0);
  const rows = modules.map((item) => {
    const progress = state.progress.modules[item.id];
    const percent = progress.attempts ? Math.round(progress.correct / progress.attempts * 100) : 0;
    return `<article class="progress-row ${item.color}"><div class="progress-row-icon" aria-hidden="true">${escapeHtml(item.icon)}</div><div class="progress-row-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.skills)}</span></div><div class="progress-meter" role="progressbar" aria-label="Верные ответы: ${escapeHtml(item.title)}" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div><div class="progress-numbers"><strong>${progress.correct}/${progress.attempts}</strong><span>верно</span></div></article>`;
  }).join("");

  return `
    <main class="page-content progress-page">
      <div class="page-title-row"><div><p class="eyebrow">твоя практика</p><h1>Мой прогресс</h1><p class="page-subtitle">Результаты остаются на этом устройстве. Здесь нет имени и личных данных.</p></div><button class="quiet-button" type="button" data-action="home">← К темам</button></div>
      <section class="summary-grid" aria-label="Общая статистика">
        <div class="summary-card summary-main"><span>Всего ответов</span><strong>${total}</strong><small>в пяти тематических модулях</small></div>
        <div class="summary-card"><span>Верных ответов</span><strong>${correct}</strong><small>из ${total} попыток</small></div>
        <div class="summary-card"><span>Точность</span><strong>${accuracy(total, correct)}</strong><small>по всем темам</small></div>
      </section>
      <section class="progress-list" aria-labelledby="progress-list-title"><div class="section-heading compact"><div><p class="eyebrow">по темам</p><h2 id="progress-list-title">Шаг за шагом</h2></div><span class="private-label">● только у тебя</span></div>${rows}</section>
      <div class="progress-actions"><p>Хочешь начать заново? Счётчики можно очистить в любой момент.</p><button class="text-button danger-text" type="button" data-action="clear-progress">Очистить прогресс</button></div>
      ${state.notice ? `<p class="inline-notice" role="status">${escapeHtml(state.notice)}</p>` : ""}
    </main>`;
}

function renderLesson(module) {
  const points = module.lesson.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
  if (state.mode === "test") return "";

  const lessonContent = `
    <p class="lesson-intro">${escapeHtml(module.lesson.description)}</p>
    <ul class="lesson-points">${points}</ul>`;
  if (state.mode === "practice") {
    return `<details class="lesson-drawer"><summary><span class="drawer-icon" aria-hidden="true">i</span><span><strong>Краткая теория</strong><small>${escapeHtml(module.lesson.title)}</small></span><b aria-hidden="true">⌄</b></summary><div class="drawer-content">${lessonContent}</div></details>`;
  }

  const example = state.exampleTask;
  const exampleSteps = example.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  return `
    <aside class="lesson-panel" aria-labelledby="lesson-title">
      <div class="lesson-heading"><span class="lesson-number">ОПОРНЫЙ КОНСПЕКТ</span><h2 id="lesson-title">${escapeHtml(module.lesson.title)}</h2></div>
      ${lessonContent}
      <details class="worked-example"><summary><span>Разобрать пример</span><span class="summary-plus" aria-hidden="true">+</span></summary>
        <div class="example-body"><p>${escapeHtml(example.prompt)}</p><ol>${exampleSteps}</ol><p class="example-answer">Ответ: <strong>${escapeHtml(Array.isArray(example.answer) ? example.answer.join(", ") : example.answer)}</strong></p></div>
      </details>
    </aside>`;
}

function renderModeNotice() {
  const notes = {
    study: "Теория и пример доступны рядом с заданием.",
    practice: "Подсказка появится по запросу.",
    test: "Решение и объяснение появятся после отправки ответа."
  };
  return `<p class="mode-note"><span class="mode-status-dot" aria-hidden="true"></span>${notes[state.mode]}</p>`;
}

function renderTaskVisual(task) {
  if (task.kind === "systems-conversion") {
    return `<div class="task-visual base-visual"><span><small>ИСХОДНОЕ</small><code>${escapeHtml(task.meta.source)}<sub>${task.meta.sourceBase}</sub></code></span><b aria-hidden="true">→</b><span><small>НОВОЕ ОСНОВАНИЕ</small><code>?</code></span><span class="visual-target">основание ${task.meta.targetBase}</span></div>`;
  }
  if (task.kind === "systems-comparison") {
    return `<div class="task-visual compare-visual"><code>${escapeHtml(task.meta.left)}<sub>${task.meta.leftBase}</sub></code><span>?</span><code>${escapeHtml(task.meta.right)}<sub>${task.meta.rightBase}</sub></code><small>СРАВНИ ПО ЗНАЧЕНИЮ</small></div>`;
  }
  if (task.kind.startsWith("arithmetic-")) {
    return `<div class="task-visual arithmetic-visual"><code>${escapeHtml(task.meta.left)}<sub>${task.meta.base}</sub></code><b>${escapeHtml(task.meta.operation)}</b><code>${escapeHtml(task.meta.right)}<sub>${task.meta.base}</sub></code><span class="visual-equals">=</span><i>?</i><small>ВЫЧИСЛИ ПО РАЗРЯДАМ</small></div>`;
  }
  if (task.kind === "logic-value") {
    const values = Object.entries(task.meta.values).map(([name, value]) => `<span class="logic-value"><small>${escapeHtml(name)}</small><b>${value}</b></span>`).join("");
    return `<div class="task-visual logic-visual">${values}<span class="logic-operator">НЕ</span><span class="logic-operator">И / ИЛИ</span><span class="logic-result">?</span></div>`;
  }
  if (task.kind === "executor-number") {
    return `<div class="task-visual number-route"><span><small>СТАРТ</small><b>${task.meta.start}</b></span><div><i></i><i></i><i></i></div><span><small>ЦЕЛЬ</small><b>${task.meta.target}</b></span><small>команды 1 и 2</small></div>`;
  }
  return "";
}

function renderInput(task) {
  const input = task.input;
  if (input.type === "text") {
    return `<label class="answer-label" for="answer-text">${escapeHtml(input.label)}</label><input class="answer-text" id="answer-text" name="answer" type="text" autocomplete="off" spellcheck="false" placeholder="Твой ответ…">`;
  }
  if (input.type === "choice") {
    const options = input.options.map((option, index) => {
      const item = typeof option === "string" ? { value: option, label: option } : option;
      return `<label class="choice-option"><input type="radio" name="answer" value="${escapeHtml(item.value)}"><span class="choice-marker">${index + 1}</span><span>${escapeHtml(item.label)}</span></label>`;
    }).join("");
    return `<fieldset class="choice-fieldset"><legend>${escapeHtml(input.label)}</legend><div class="choice-list">${options}</div></fieldset>`;
  }
  if (input.type === "multi-choice") {
    const options = input.options.map((option) => `<label class="multi-option"><input type="checkbox" name="answer" value="${escapeHtml(option.value)}"><span>${escapeHtml(option.label)}</span></label>`).join("");
    return `<fieldset class="choice-fieldset"><legend>${escapeHtml(input.label)}</legend><div class="multi-list">${options}</div></fieldset>`;
  }
  if (input.type === "truth-table") {
    const headings = input.variables.map((name) => `<th scope="col">${escapeHtml(name)}</th>`).join("");
    const rows = input.rows.map((values, index) => `<tr>${input.variables.map((name) => `<td>${values[name]}</td>`).join("")}<td><label class="sr-only" for="truth-${index}">Результат строки ${index + 1}</label><select id="truth-${index}" class="table-answer" data-answer-index="${index}"><option value="">?</option><option value="0">0</option><option value="1">1</option></select></td></tr>`).join("");
    return `<div class="truth-table-wrap"><table class="truth-table"><thead><tr>${headings}<th scope="col">Результат</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  return "";
}

function renderDrawing(task) {
  if (task.kind !== "executor-drawing") return "";
  const points = task.meta.points;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1); const height = Math.max(maxY - minY, 1);
  const padding = 28; const viewWidth = 300; const viewHeight = 150;
  const scale = Math.min((viewWidth - padding * 2) / width, (viewHeight - padding * 2) / height);
  const offsetX = (viewWidth - width * scale) / 2;
  const offsetY = (viewHeight - height * scale) / 2;
  const svgPoints = points.map((point) => `${(point.x - minX) * scale + offsetX},${viewHeight - ((point.y - minY) * scale + offsetY)}`).join(" ");
  const start = points[0]; const end = points[points.length - 1];
  const mapX = (point) => (point.x - minX) * scale + offsetX;
  const mapY = (point) => viewHeight - ((point.y - minY) * scale + offsetY);
  return `<div class="drawing-wrap"><svg class="drawing-svg" viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-label="Путь Чертёжника от начала до конечной точки"><defs><pattern id="small-grid" width="15" height="15" patternUnits="userSpaceOnUse"><path d="M 15 0 L 0 0 0 15" fill="none" stroke="#e2e8f0" stroke-width=".7"/></pattern></defs><rect width="${viewWidth}" height="${viewHeight}" fill="url(#small-grid)"/><polyline points="${svgPoints}" fill="none" stroke="#4f46e5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${mapX(start)}" cy="${mapY(start)}" r="5" fill="#06b6d4"/><circle cx="${mapX(end)}" cy="${mapY(end)}" r="5" fill="#4f46e5"/></svg><div class="drawing-legend"><span><i class="start-dot"></i>начало (0, 0)</span><span><i class="end-dot"></i>конец</span></div></div>`;
}

function renderTrace(task) {
  if (!task.code) return "";
  return `<div class="code-card"><div class="code-card-head"><span><i aria-hidden="true"></i> ФИКСИРОВАННАЯ ПРОГРАММА</span><small>Python · учебная модель</small></div><pre><code>${escapeHtml(task.code)}</code></pre></div>`;
}

function renderFeedback(task) {
  if (!state.feedback) return "";
  const result = state.feedback.result;
  const steps = task.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  return `<section class="answer-feedback ${result.correct ? "is-correct" : result.empty ? "is-neutral" : "is-wrong"}" role="status"><div class="feedback-heading"><span class="feedback-icon" aria-hidden="true">${result.correct ? "✓" : result.empty ? "·" : "↺"}</span><div><strong>${escapeHtml(result.correct ? "Отлично, верно!" : result.empty ? "Нужен ответ" : "Пока не совпало")}</strong><p>${escapeHtml(result.message)}</p></div></div>${result.empty ? "" : `<details class="solution-details" open><summary>Разбор решения</summary><ol>${steps}</ol></details>`}</section>`;
}

function renderTaskPanel(module) {
  const task = state.task;
  const hint = state.hintIsVisible ? `<p class="hint-box"><span aria-hidden="true">✳</span>${escapeHtml(task.hint)}</p>` : "";
  const hintButton = state.mode === "practice" ? `<button class="text-button hint-button" type="button" data-action="hint">${state.hintIsVisible ? "Скрыть подсказку" : "Показать подсказку"}</button>` : "";
  return `
    <section class="task-panel ${module.color}" aria-labelledby="task-title">
      <div class="task-topline"><div><span class="task-index">НОВОЕ ЗАДАНИЕ</span><span class="task-dot" aria-hidden="true"></span><span class="task-mode-label">${escapeHtml(modes.find((mode) => mode.id === state.mode).label)}</span></div><button class="icon-button" type="button" data-action="new-task" aria-label="Новое задание" title="Новое задание">↻</button></div>
      <h2 id="task-title">${escapeHtml(task.prompt)}</h2>
      ${renderTaskVisual(task)}${renderDrawing(task)}${renderTrace(task)}
      ${hintButton}${hint}
      <form id="exercise-form" novalidate>${renderInput(task)}<div class="submit-row"><button class="primary-button submit-button" type="submit">Проверить ответ <span aria-hidden="true">↗</span></button><span class="enter-note">Enter ↵</span></div></form>
      ${renderFeedback(task)}
    </section>`;
}

function renderModuleScreen() {
  const module = findModule(state.moduleId);
  const modeButtons = modes.map((mode) => `<button type="button" class="mode-tab ${state.mode === mode.id ? "is-active" : ""}" data-mode="${mode.id}" aria-pressed="${state.mode === mode.id}"><strong>${escapeHtml(mode.label)}</strong><span>${escapeHtml(mode.note)}</span></button>`).join("");
  const progress = state.progress.modules[module.id];

  return `
    <main class="page-content module-page">
      <button class="back-link" type="button" data-action="home"><span aria-hidden="true">←</span> Все темы</button>
      <section class="module-heading ${module.color}"><div><p class="eyebrow">тема ${module.number} <span>·</span> ${escapeHtml(module.skills)}</p><h1>${escapeHtml(module.title)}</h1><p>${escapeHtml(module.description)}</p></div><div class="module-score"><span>ТВОЙ РЕЗУЛЬТАТ</span><strong>${progress.correct}<i>/</i>${progress.attempts}</strong><small>верных ответов</small></div></section>
      <div class="mode-switcher" role="group" aria-label="Режим занятия">${modeButtons}</div>
      ${renderModeNotice()}
      <div class="learning-layout ${state.mode === "test" ? "solo-task" : "with-lesson"}">${renderTaskPanel(module)}${renderLesson(module)}</div>
      <div class="module-bottom"><span>Задания генерируются на устройстве</span><button type="button" class="text-button" data-action="progress">Открыть результаты ↗</button></div>
    </main>`;
}

function render() {
  let screen = "";
  if (state.screen === "home") screen = renderHome();
  else if (state.screen === "progress") screen = renderProgress();
  else screen = renderModuleScreen();
  app.innerHTML = `${renderHeader()}${screen}<footer class="site-footer"><span>ИНФОЛАБ</span><span>Интерактивная лаборатория информатики</span><span>Прогресс хранится локально</span></footer>`;
}

function openModule(moduleId) {
  const module = findModule(moduleId);
  state.moduleId = module.id;
  state.screen = "module";
  state.feedback = null;
  state.notice = "";
  refreshTasks();
  render();
}

function refreshTasks() {
  const module = findModule(state.moduleId);
  state.task = module.generateTask();
  state.exampleTask = module.generateTask();
  state.hintIsVisible = false;
  state.feedback = null;
}

function goHome() {
  state.screen = "home";
  state.notice = "";
  render();
}

function answerFromForm(form) {
  if (state.task.input.type === "truth-table") {
    return [...form.querySelectorAll("[data-answer-index]")].map((control) => control.value);
  }
  if (state.task.input.type === "multi-choice") {
    return [...form.querySelectorAll("input[name=answer]:checked")].map((control) => control.value);
  }
  if (state.task.input.type === "choice") {
    return form.querySelector("input[name=answer]:checked")?.value ?? "";
  }
  return form.querySelector("[name=answer]")?.value ?? "";
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-module], [data-mode]");
  if (!target) return;

  if (target.dataset.module) {
    openModule(target.dataset.module);
    return;
  }
  if (target.dataset.mode) {
    state.mode = target.dataset.mode;
    refreshTasks();
    render();
    return;
  }

  const action = target.dataset.action;
  if (action === "home") goHome();
  else if (action === "progress") { state.screen = "progress"; state.notice = ""; render(); }
  else if (action === "start-first") openModule(modules[0].id);
  else if (action === "hero-next") { state.heroStep = (state.heroStep + 1) % heroSteps.length; render(); }
  else if (action === "hero-step") { state.heroStep = Number(target.dataset.step); render(); }
  else if (action === "new-task") { refreshTasks(); render(); }
  else if (action === "hint") { state.hintIsVisible = !state.hintIsVisible; render(); }
  else if (action === "clear-progress") {
    state.progress = clearProgress();
    state.notice = "Прогресс очищен на этом устройстве.";
    render();
  }
});

app.addEventListener("submit", (event) => {
  if (event.target.id !== "exercise-form") return;
  event.preventDefault();
  const module = findModule(state.moduleId);
  const answer = answerFromForm(event.target);
  const result = module.checkAnswer(state.task, answer);
  state.feedback = { result };

  if (!result.empty) {
    state.progress = recordAttempt(module.id, result.correct);
  }
  render();
});

render();

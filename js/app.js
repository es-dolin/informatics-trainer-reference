// Главный файл отвечает за экраны и события. Математические расчёты находятся
// в отдельных модулях, а здесь мы только показываем задание и передаём ответ.
import { modules, findModule } from "./modules/index.js";
import { clearProgress, loadProgress, recordAttempt } from "./storage.js";

const app = document.querySelector("#app");
const modes = [
  { id: "study", label: "Изучаю", note: "Разберись в способе" },
  { id: "practice", label: "Тренируюсь", note: "Попробуй и возьми подсказку" },
  { id: "test", label: "Проверяю себя", note: "Реши без подсказок" }
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

function renderHeader() {
  const attempts = allAttempts();
  const progressLabel = attempts === 0 ? "Начать путь" : `${attempts} ${attempts === 1 ? "ответ" : "ответа"}`;
  return `
    <header class="topbar">
      <button class="brand" type="button" data-action="home" aria-label="На главную">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="brand-copy"><strong>код<span>&</span>смысл</strong><small>информатика · 8 класс</small></span>
      </button>
      <nav class="topnav" aria-label="Основная навигация">
        <button class="topnav-link ${state.screen === "home" || state.screen === "module" ? "is-current" : ""}" type="button" data-action="home">Темы</button>
        <button class="topnav-link ${state.screen === "progress" ? "is-current" : ""}" type="button" data-action="progress">Мой прогресс</button>
      </nav>
      <div class="topbar-progress"><span class="pulse-dot" aria-hidden="true"></span><span>${escapeHtml(progressLabel)}</span></div>
    </header>`;
}

function renderHome() {
  const completed = modules.filter((item) => state.progress.modules[item.id].attempts > 0).length;
  const cards = modules.map((item) => {
    const progress = state.progress.modules[item.id];
    return `
      <button class="module-card ${item.color}" type="button" data-module="${item.id}">
        <span class="card-topline"><span class="module-icon" aria-hidden="true">${escapeHtml(item.icon)}</span><span class="module-number">${item.number}</span></span>
        <span class="card-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.description)}</span></span>
        <span class="card-bottom"><span>${escapeHtml(item.skills)}</span><span class="card-progress">${progress.attempts ? `${progress.correct}/${progress.attempts} верно` : "Начать тему"}<b aria-hidden="true">↗</b></span></span>
      </button>`;
  }).join("");

  return `
    <main class="page-content home-page">
      <section class="hero-grid" aria-labelledby="home-title">
        <div class="hero-copy">
          <p class="eyebrow"><span class="eyebrow-line"></span> не зубрить, а понимать</p>
          <h1 id="home-title">Информатика<br><em>становится ясной.</em></h1>
          <p class="hero-description">Пять тем, интерактивные объяснения и новые задачи для тренировки. Разбирай решение по шагам и замечай, где именно меняется результат.</p>
          <button class="primary-button" type="button" data-action="start-first">Начать заниматься <span aria-hidden="true">↗</span></button>
          <div class="hero-footnote"><span class="mini-check">✓</span> Без регистрации · прогресс хранится только в этом браузере</div>
        </div>
        <div class="hero-art" aria-label="Схема шага алгоритма">
          <div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div>
          <div class="art-chip chip-top">01 <span>входные данные</span></div>
          <div class="art-chip chip-bottom">результат <span>↗</span></div>
          <div class="art-node node-a">x = 12</div><div class="art-node node-b">× 2</div><div class="art-node node-c">24</div>
          <svg class="art-lines" viewBox="0 0 420 300" aria-hidden="true"><path d="M107 143 C145 143 135 90 184 90"/><path d="M236 91 C287 91 269 173 320 173"/><path d="M112 151 C153 196 263 208 318 178"/></svg>
          <div class="art-caption"><span>СХЕМА 01</span><span>ДАНО → КОМАНДА → ОТВЕТ</span></div>
        </div>
      </section>

      <section class="topic-section" aria-labelledby="topics-title">
        <div class="section-heading"><div><p class="eyebrow">твой маршрут</p><h2 id="topics-title">Выбери тему</h2></div><p class="section-side-note">${completed} из 5 тем уже открыты<br><span>Можно идти в своём темпе</span></p></div>
        <div class="module-grid">${cards}</div>
      </section>
      <section class="method-strip">
        <span class="method-index">КАК ЭТО РАБОТАЕТ</span>
        <div><strong>Изучаю</strong><span>сначала понять</span></div><span class="method-arrow">→</span>
        <div><strong>Тренируюсь</strong><span>попробовать самому</span></div><span class="method-arrow">→</span>
        <div><strong>Проверяю себя</strong><span>увидеть свой результат</span></div>
      </section>
      <p class="demo-note">Демонстрационный проект для обучения. Упражнения тренируют отдельные навыки и не заменяют официальную проверочную работу.</p>
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
  if (state.mode !== "study") return "";
  const points = module.lesson.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
  const example = state.exampleTask;
  const exampleSteps = example.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  return `
    <section class="lesson-panel" aria-labelledby="lesson-title">
      <div class="lesson-heading"><span class="lesson-number">ПЕРЕД ЗАДАНИЕМ</span><h2 id="lesson-title">${escapeHtml(module.lesson.title)}</h2></div>
      <p class="lesson-intro">${escapeHtml(module.lesson.description)}</p>
      <ul class="lesson-points">${points}</ul>
      <details class="worked-example"><summary><span>Разобрать пример</span><span class="summary-plus" aria-hidden="true">+</span></summary>
        <div class="example-body"><p>${escapeHtml(example.prompt)}</p><ol>${exampleSteps}</ol><p class="example-answer">Ответ: <strong>${escapeHtml(Array.isArray(example.answer) ? example.answer.join(", ") : example.answer)}</strong></p></div>
      </details>
    </section>`;
}

function renderModeNotice() {
  const notes = {
    study: "Сначала короткая теория, потом пример с разбором и задача.",
    practice: "Решай сам. Если застрял, открой подсказку — она подскажет следующий шаг.",
    test: "Подсказка скрыта до отправки ответа. После проверки появится разбор."
  };
  return `<p class="mode-note"><span aria-hidden="true">${state.mode === "test" ? "◌" : state.mode === "practice" ? "✳" : "↗"}</span>${notes[state.mode]}</p>`;
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
  return `<div class="drawing-wrap"><svg class="drawing-svg" viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-label="Путь Чертёжника от начала до конечной точки"><defs><pattern id="small-grid" width="15" height="15" patternUnits="userSpaceOnUse"><path d="M 15 0 L 0 0 0 15" fill="none" stroke="#e3e8e2" stroke-width=".7"/></pattern></defs><rect width="${viewWidth}" height="${viewHeight}" fill="url(#small-grid)"/><polyline points="${svgPoints}" fill="none" stroke="#5376ed" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${mapX(start)}" cy="${mapY(start)}" r="5" fill="#a3c95a"/><circle cx="${mapX(end)}" cy="${mapY(end)}" r="5" fill="#ff9a64"/></svg><div class="drawing-legend"><span><i class="start-dot"></i>начало (0, 0)</span><span><i class="end-dot"></i>конец</span></div></div>`;
}

function renderTrace(task) {
  if (!task.code) return "";
  return `<details class="code-details"><summary><span>Посмотреть программу</span><span class="summary-plus" aria-hidden="true">+</span></summary><pre><code>${escapeHtml(task.code)}</code></pre></details>`;
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
      ${renderDrawing(task)}${renderTrace(task)}
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
      <div class="learning-layout ${state.mode === "study" ? "with-lesson" : "solo-task"}">${renderLesson(module)}${renderTaskPanel(module)}</div>
      <div class="module-bottom"><span>Задания генерируются на устройстве</span><button type="button" class="text-button" data-action="progress">Открыть результаты ↗</button></div>
    </main>`;
}

function render() {
  let screen = "";
  if (state.screen === "home") screen = renderHome();
  else if (state.screen === "progress") screen = renderProgress();
  else screen = renderModuleScreen();
  app.innerHTML = `${renderHeader()}${screen}<footer class="site-footer"><span>КОД & СМЫСЛ</span><span>Учебная демонстрация · без сбора личных данных</span><span>Сделано, чтобы разобраться <b>✳</b></span></footer>`;
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

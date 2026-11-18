// Главный файл отвечает за экраны и события. Математические расчёты находятся
// в отдельных модулях, а здесь мы только показываем задание и передаём ответ.
import { modules, findModule } from "./modules/index.js";
import { clearProgress, loadProgress, recordAttempt, shouldCountAnswer } from "./storage.js";
import { createLearningSteps, checkLearningStep } from "./learning-steps.js";
import { taskVariants, getTaskVariant, generateTaskForVariant, generateSimilarTask } from "./similar-task.js";

const app = document.querySelector("#app");
const modes = [
  { id: "study", label: "Изучай и тренируйся", note: "Задачи по шагам" },
  { id: "test", label: "Проверь себя", note: "Без подсказок" }
];

const state = {
  screen: "home",
  moduleId: null,
  mode: "study",
  task: null,
  feedback: null,
  notice: "",
  heroStep: 0,
  systemBases: { source: 10, target: 2 },
  currentAnswer: null,
  attemptRecorded: false,
  studyTask: null,
  studyGuide: null,
  testReference: null,
  reviewedTestTask: null,
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
  if (attempts === 0) return "-";
  return `${Math.round((correct / attempts) * 100)}%`;
}

const heroSteps = [
  { label: "Число", value: "1011₂", note: "Запись в двоичной системе" },
  { label: "Разряды", value: "1×8 + 0×4 + 1×2 + 1×1", note: "Вес каждого разряда - степень двойки" },
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
  return `<div class="card-visual visual-program"><code><span>if</span> x &gt; 0:<br>&nbsp;&nbsp;<b>print</b>(x)</code></div>`;
}

function renderHeader() {
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
    </header>`;
}

function renderHome() {
  const cards = modules.map((item) => {
    const progress = state.progress.modules[item.id];
    return `
      <button class="module-card ${item.color}" type="button" data-module="${item.id}">
        <span class="card-topline"><span class="module-icon" aria-hidden="true">${escapeHtml(item.icon)}</span></span>
        ${renderTopicVisual(item)}
        <span class="card-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.description)}</span></span>
        ${progress.attempts ? `<span class="card-progress">${progress.correct} из ${progress.attempts} верно</span>` : ""}
      </button>`;
  }).join("");
  const activeHeroStep = heroSteps[state.heroStep];

  return `
    <main class="page-content home-page">
      <section class="hero-grid" aria-labelledby="home-title">
        <div class="hero-copy">
          <h1 id="home-title">Информатика<br><span>на практике</span></h1>
          <p class="hero-description">Решай задачи по информатике и разбирай решения по шагам.</p>
        </div>
        <div class="hero-lab" aria-label="Интерактивный пример перевода числа">
          <div class="lab-flow" role="group" aria-label="Шаги перевода числа">
            ${heroSteps.map((step, index) => `<button class="lab-step ${index === state.heroStep ? "is-active" : ""}" type="button" data-action="hero-step" data-step="${index}" aria-pressed="${index === state.heroStep}"><strong>${escapeHtml(step.label)}</strong></button>${index < heroSteps.length - 1 ? `<span class="flow-connector" aria-hidden="true">→</span>` : ""}`).join("")}
          </div>
          <div class="lab-explanation"><div><strong>${escapeHtml(activeHeroStep.value)}</strong><p>${escapeHtml(activeHeroStep.note)}</p></div><button class="lab-next" type="button" data-action="hero-next" aria-label="${state.heroStep === heroSteps.length - 1 ? "Вернуться к началу примера" : "Следующий шаг"}">${state.heroStep === heroSteps.length - 1 ? "↺" : "→"}</button></div>
        </div>
      </section>

      <section class="topic-section" aria-labelledby="topics-title">
        <div class="section-heading"><h2 id="topics-title">Тренажёры</h2></div>
        <div class="module-grid">${cards}</div>
      </section>
    </main>`;
}

function renderProgress() {
  const total = allAttempts();
  const correct = Object.values(state.progress.modules).reduce((sum, item) => sum + item.correct, 0);
  const rows = modules.map((item) => {
    const progress = state.progress.modules[item.id];
    const percent = progress.attempts ? Math.round(progress.correct / progress.attempts * 100) : 0;
    return `<article class="progress-row ${item.color}"><div class="progress-row-icon" aria-hidden="true">${escapeHtml(item.icon)}</div><div class="progress-row-copy"><strong>${escapeHtml(item.title)}</strong></div><div class="progress-meter" role="progressbar" aria-label="Верные ответы: ${escapeHtml(item.title)}" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div><div class="progress-numbers"><strong>${progress.attempts ? `${progress.correct}/${progress.attempts}` : "-"}</strong><span>${progress.attempts ? "верно" : "нет ответов"}</span></div></article>`;
  }).join("");

  return `
    <main class="page-content progress-page">
      <div class="page-title-row"><div><h1>Результаты</h1><p class="page-subtitle">Учитывается первый ответ в самопроверке.</p></div><button class="quiet-button" type="button" data-action="home">← К темам</button></div>
      <section class="summary-grid" aria-label="Общая статистика">
        <div class="summary-card summary-main"><span>Всего ответов</span><strong>${total}</strong></div>
        <div class="summary-card"><span>Верных ответов</span><strong>${correct}</strong><small>из ${total} попыток</small></div>
        <div class="summary-card"><span>Точность</span><strong>${accuracy(total, correct)}</strong></div>
      </section>
      <section class="progress-list" aria-labelledby="progress-list-title"><div class="section-heading compact"><h2 id="progress-list-title">По темам</h2></div>${rows}</section>
      <div class="progress-actions"><button class="text-button danger-text" type="button" data-action="clear-progress">Очистить результаты</button></div>
      ${state.notice ? `<p class="inline-notice" role="status">${escapeHtml(state.notice)}</p>` : ""}
    </main>`;
}

function renderLesson(module) {
  if (state.mode !== "study") return "";
  const guide = state.studyGuide;
  const current = guide.steps[guide.index];
  const points = module.lesson.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
  const logicTable = module.id === "logic" ? `<div class="truth-table-wrap"><table class="truth-table"><caption>Правила логических операций</caption><thead><tr><th scope="col">A</th><th scope="col">B</th><th scope="col">НЕ A</th><th scope="col">A И B</th><th scope="col">A ИЛИ B</th></tr></thead><tbody><tr><td>0</td><td>0</td><td>1</td><td>0</td><td>0</td></tr><tr><td>0</td><td>1</td><td>1</td><td>0</td><td>1</td></tr><tr><td>1</td><td>0</td><td>0</td><td>0</td><td>1</td></tr><tr><td>1</td><td>1</td><td>0</td><td>1</td><td>1</td></tr></tbody></table></div>` : "";
  const explanation = current
    ? `<p class="step-instruction">${escapeHtml(current.prompt)}</p><div class="step-rule"><strong>Как выполнить</strong><p>${escapeHtml(current.hint)}</p></div>`
    : `<p class="step-instruction">Все действия выполнены. Повтори решение на другом примере или проверь себя без помощи.</p>`;
  const solution = current ? "" : `<details class="worked-example"><summary>Решение целиком</summary><div class="example-body"><ol>${guide.task.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></div></details>`;
  return `<aside class="lesson-panel step-instructions" aria-labelledby="lesson-title">
    <div class="lesson-heading"><span class="lesson-number">${current ? `СЕЙЧАС: ШАГ ${guide.index + 1}` : "РЕШЕНИЕ СОБРАНО"}</span><h2 id="lesson-title">${escapeHtml(current?.title ?? "Что дальше?")}</h2></div>
    ${explanation}${renderLearningPlan(guide)}
    <details class="topic-theory"><summary>Теория темы</summary><p class="lesson-intro">${escapeHtml(module.lesson.description)}</p><ul class="lesson-points">${points}</ul>${logicTable}</details>
    ${solution}
  </aside>`;
}

function renderTaskVisual(task) {
  if (task.kind === "systems-conversion") {
    return `<div class="task-visual base-visual"><span><small>ИСХОДНОЕ ЧИСЛО</small><code>${escapeHtml(task.meta.source)}<sub>${task.meta.sourceBase}</sub></code></span><b aria-hidden="true">→</b><span><small>ОТВЕТ</small><code>?<sub>${task.meta.targetBase}</sub></code></span></div>`;
  }
  if (task.kind === "systems-comparison") {
    return `<div class="task-visual compare-visual"><code>${escapeHtml(task.meta.left)}<sub>${task.meta.leftBase}</sub></code><span>?</span><code>${escapeHtml(task.meta.right)}<sub>${task.meta.rightBase}</sub></code><small>СРАВНИ ПО ЗНАЧЕНИЮ</small></div>`;
  }
  if (task.kind.startsWith("arithmetic-")) {
    return `<div class="task-visual arithmetic-visual"><code>${escapeHtml(task.meta.left)}<sub>${task.meta.base}</sub></code><b>${escapeHtml(task.meta.operation)}</b><code>${escapeHtml(task.meta.right)}<sub>${task.meta.base}</sub></code><span class="visual-equals">=</span><i>?</i></div>`;
  }
  if (task.kind === "logic-value") {
    const values = Object.entries(task.meta.values).map(([name, value]) => `<span class="logic-value"><small>${escapeHtml(name)}</small><b>${value}</b></span>`).join("");
    return `<div class="task-visual logic-visual">${values}</div>`;
  }
  if (task.kind === "executor-number") {
    return `<div class="task-visual number-route"><span><small>СТАРТ</small><b>${task.meta.start}</b></span><div><i></i><i></i><i></i></div><span><small>ЦЕЛЬ</small><b>${task.meta.target}</b></span><small>команды 1 и 2</small></div>`;
  }
  return "";
}

function renderInput(task) {
  const input = task.input;
  if (input.type === "text") {
    const value = typeof state.currentAnswer === "string" ? state.currentAnswer : "";
    return `<label class="answer-label" for="answer-text">${escapeHtml(input.label)}</label><input class="answer-text" id="answer-text" name="answer" type="text" value="${escapeHtml(value)}" autocomplete="off" spellcheck="false" placeholder="Твой ответ…">`;
  }
  if (input.type === "choice") {
    const options = input.options.map((option, index) => {
      const item = typeof option === "string" ? { value: option, label: option } : option;
      const checked = state.currentAnswer === item.value ? " checked" : "";
      return `<label class="choice-option"><input type="radio" name="answer" value="${escapeHtml(item.value)}"${checked}><span class="choice-marker">${index + 1}</span><span>${escapeHtml(item.label)}</span></label>`;
    }).join("");
    return `<fieldset class="choice-fieldset"><legend>${escapeHtml(input.label)}</legend><div class="choice-list">${options}</div></fieldset>`;
  }
  if (input.type === "multi-choice") {
    const selected = Array.isArray(state.currentAnswer) ? state.currentAnswer : [];
    const options = input.options.map((option) => {
      const checked = selected.includes(option.value) ? " checked" : "";
      return `<label class="multi-option"><input type="checkbox" name="answer" value="${escapeHtml(option.value)}"${checked}><span>${escapeHtml(option.label)}</span></label>`;
    }).join("");
    return `<fieldset class="choice-fieldset"><legend>${escapeHtml(input.label)}</legend><div class="multi-list">${options}</div></fieldset>`;
  }
  if (input.type === "truth-table") {
    const headings = input.variables.map((name) => `<th scope="col">${escapeHtml(name)}</th>`).join("");
    const selected = Array.isArray(state.currentAnswer) ? state.currentAnswer : [];
    const rows = input.rows.map((values, index) => `<tr>${input.variables.map((name) => `<td>${values[name]}</td>`).join("")}<td><label class="sr-only" for="truth-${index}">Результат строки ${index + 1}</label><select id="truth-${index}" class="table-answer" data-answer-index="${index}"><option value=""${selected[index] ? "" : " selected"}>?</option><option value="0"${selected[index] === "0" ? " selected" : ""}>0</option><option value="1"${selected[index] === "1" ? " selected" : ""}>1</option></select></td></tr>`).join("");
    return `<div class="truth-table-wrap"><table class="truth-table"><thead><tr>${headings}<th scope="col">Результат</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  return "";
}

function renderDrawing(task, visiblePoints = null) {
  if (task.kind !== "executor-drawing") return "";
  const points = visiblePoints ?? task.meta.points;
  // Размер клетки и границы остаются одинаковыми на всех шагах одной задачи.
  const allPoints = task.meta.points;
  const xs = allPoints.map((point) => point.x);
  const ys = allPoints.map((point) => point.y);
  const minX = Math.min(0, ...xs) - 1; const maxX = Math.max(0, ...xs) + 1;
  const minY = Math.min(0, ...ys) - 1; const maxY = Math.max(0, ...ys) + 1;
  const viewWidth = 360; const viewHeight = Math.min(220, Math.max(110, (maxY - minY) * 30 + 50)); const padding = 25;
  const scale = Math.min(30, (viewWidth - padding * 2) / (maxX - minX), (viewHeight - padding * 2) / (maxY - minY));
  const offsetX = (viewWidth - (maxX - minX) * scale) / 2;
  const offsetY = (viewHeight - (maxY - minY) * scale) / 2;
  const start = points[0]; const end = points[points.length - 1];
  const mapX = (point) => (point.x - minX) * scale + offsetX;
  const mapY = (point) => viewHeight - ((point.y - minY) * scale + offsetY);
  const svgPoints = points.map((point) => `${mapX(point)},${mapY(point)}`).join(" ");
  const xAxis = mapY({ y: 0 }); const yAxis = mapX({ x: 0 });
  const vertical = Array.from({ length: maxX - minX + 1 }, (_, i) => `<line x1="${mapX({ x: minX + i })}" y1="${mapY({ y: minY })}" x2="${mapX({ x: minX + i })}" y2="${mapY({ y: maxY })}"/>`).join("");
  const horizontal = Array.from({ length: maxY - minY + 1 }, (_, i) => `<line x1="${mapX({ x: minX })}" y1="${mapY({ y: minY + i })}" x2="${mapX({ x: maxX })}" y2="${mapY({ y: minY + i })}"/>`).join("");
  return `<div class="drawing-wrap"><svg class="drawing-svg" viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-label="Путь Чертёжника. Сейчас точка ${end.x}, ${end.y}. Одна клетка - одна единица."><g stroke="#d8e0eb" stroke-width=".7">${vertical}${horizontal}</g><g stroke="#718096" stroke-width="1.3"><line x1="${mapX({ x: minX })}" y1="${xAxis}" x2="${mapX({ x: maxX })}" y2="${xAxis}"/><line x1="${yAxis}" y1="${mapY({ y: minY })}" x2="${yAxis}" y2="${mapY({ y: maxY })}"/></g><g fill="#475569" font-size="11"><text x="${yAxis + 4}" y="${xAxis + 14}">0</text><text x="${mapX({ x: maxX }) - 5}" y="${xAxis - 5}">x</text><text x="${yAxis + 5}" y="${mapY({ y: maxY }) + 10}">y</text></g><polyline points="${svgPoints}" fill="none" stroke="#4f46e5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${mapX(start)}" cy="${mapY(start)}" r="5" fill="#06b6d4"/><circle cx="${mapX(end)}" cy="${mapY(end)}" r="5" fill="#4f46e5"/></svg><div class="drawing-legend"><span><i class="start-dot"></i>начало (${start.x}, ${start.y})</span><span><i class="end-dot"></i>сейчас (${end.x}, ${end.y})</span><span>1 клетка = 1</span></div></div>`;
}

function renderTrace(task, activeLine = -1) {
  if (!task.code) return "";
  const lines = task.code.split("\n").map((line, index) => `<span class="code-line${index === activeLine ? " is-active" : ""}">${index === activeLine ? `<span class="sr-only">Текущая строка: </span>` : ""}${escapeHtml(line) || " "}</span>`).join("");
  return `<div class="code-card"><div class="code-card-head"><span><i aria-hidden="true"></i> ПРИМЕР ПРОГРАММЫ</span><small>Python</small></div><pre><code>${lines}</code></pre></div>`;
}

function renderFeedback(task) {
  if (!state.feedback) return "";
  const result = state.feedback.result;
  const steps = task.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  return `<section class="answer-feedback ${result.correct ? "is-correct" : result.empty ? "is-neutral" : "is-wrong"}" role="status" tabindex="-1"><div class="feedback-heading"><span class="feedback-icon" aria-hidden="true">${result.correct ? "✓" : result.empty ? "·" : "↺"}</span><div><strong>${escapeHtml(result.correct ? "Отлично, верно!" : result.empty ? "Нужен ответ" : "Пока не совпало")}</strong><p>${escapeHtml(result.message)}</p></div></div>${result.empty ? "" : `<div class="review-actions"><button class="text-button" type="button" data-action="review-task">Решить по шагам</button><button class="text-button" type="button" data-action="new-task">Ещё задача →</button></div><details class="solution-details"><summary>Показать готовое решение</summary><ol>${steps}</ol></details>`}</section>`;
}

function renderTaskPanel(module) {
  const task = state.task;
  const drawing = task.kind === "executor-drawing"
    ? renderDrawing(task, state.feedback && !state.feedback.result.empty ? null : task.meta.points.slice(0, 1)) : "";
  return `<section class="task-panel ${module.color}" aria-labelledby="task-title">
    <div class="task-topline"><button class="text-button" type="button" data-action="new-task">Ещё задача ↻</button></div>
    <h2 id="task-title">${escapeHtml(task.prompt)}</h2>
    ${renderTaskVisual(task)}${drawing}${renderTrace(task)}
    <form id="exercise-form" novalidate>${renderInput(task)}<div class="submit-row"><button class="primary-button submit-button" type="submit">Проверить ответ <span aria-hidden="true">↗</span></button></div></form>
    ${renderFeedback(task)}
  </section>`;
}

function makeLearningGuide(task) {
  return { task, steps: createLearningSteps(task), index: 0, draft: [], history: [], feedback: null };
}

function renderLearningPlan(guide) {
  const groups = [...new Set(guide.steps.map((step) => step.group))];
  const current = guide.steps[guide.index];
  return `<details class="learning-plan"><summary>План решения</summary><ol>${groups.map((group) => `<li${group === current?.group ? ' class="is-current"' : ""}>${escapeHtml(group)}</li>`).join("")}</ol></details>`;
}

function renderLearningSteps(guide) {
  const current = guide.steps[guide.index];
  const history = guide.history.length ? `<details class="learning-history"${current?.showHistory ? " open" : ""}><summary>Выполнено шагов: ${guide.history.length}</summary><ol>${guide.history.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.answerText)}</span><p>${escapeHtml(item.explanation)}</p></li>`).join("")}</ol></details>` : "";
  const drawing = guide.task.kind === "executor-drawing"
    ? renderDrawing(guide.task, guide.task.meta.points.slice(0, (guide.steps[guide.index - 1]?.pointCount ?? 0) + 1)) : "";
  if (!current) {
    const answer = guide.task.kind === "executor-number" ? guide.history.at(-1)?.answerText : Array.isArray(guide.task.answer) ? guide.task.answer.join(", ") : guide.task.answer;
    return `<div class="learning-complete" role="status"><strong>Все шаги выполнены ✓</strong><p>Ответ: ${escapeHtml(answer)}.</p><div class="learning-next"><button class="primary-button" type="button" data-action="start-test">Проверь себя →</button><button class="text-button" type="button" data-action="new-task">Ещё пример ↻</button></div></div>${drawing}${history}`;
  }
  const controls = current.fields.map((field, index) => {
    const value = guide.draft[index] ?? "";
    const wrong = guide.feedback?.correctFields?.[index] === false;
    const control = field.options
      ? `<select id="learning-${index}" name="learning-${index}"${wrong ? ' aria-invalid="true"' : ""}><option value="">Выбери</option>${field.options.map((option) => `<option value="${escapeHtml(option)}"${value === option ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select>`
      : `<input id="learning-${index}" name="learning-${index}" type="text" value="${escapeHtml(value)}"${field.base === 10 ? ' inputmode="numeric"' : ""}${wrong ? ' aria-invalid="true"' : ""} autocomplete="off" spellcheck="false">`;
    return `<label for="learning-${index}">${escapeHtml(field.label)}${control}</label>`;
  }).join("");
  const feedback = guide.feedback ? `<p class="guided-feedback ${guide.feedback.correct ? "is-correct" : guide.feedback.empty ? "is-neutral" : "is-wrong"}" role="status">${escapeHtml(guide.feedback.message)}</p>` : "";
  return `<div class="learning-step">
    <div class="guided-progress"><span>Шаг ${guide.index + 1} из ${guide.steps.length}</span><span>${escapeHtml(current.group)}</span></div>
    <progress class="learning-meter" value="${guide.index}" max="${guide.steps.length}" aria-label="Выполненные шаги"></progress>
    ${feedback}<h3>${escapeHtml(current.title)}</h3>
    <div class="compact-step-instruction"><p>${escapeHtml(current.prompt)}</p><details class="step-hint"><summary>Как выполнить шаг</summary><p>${escapeHtml(current.hint)}</p></details></div>
    ${current.showHistory ? history : ""}
    <form id="learning-step-form" class="learning-step-form" novalidate>${controls}<button class="primary-button" type="submit">Проверить шаг →</button></form>
  </div>${drawing}${current.showHistory ? "" : history}`;
}

function renderArithmeticColumn(guide) {
  const { task, history, steps, index } = guide;
  if (!task.kind.startsWith("arithmetic-") || !["+", "−", "×"].includes(task.meta.operation)) return "";
  const { left, right, operation, base } = task.meta;
  const width = operation === "×" ? left.length + right.length : Math.max(left.length, right.length);
  const active = steps[index];
  const position = active?.columnPosition ?? active?.multiplierPosition;
  const completed = steps.slice(0, history.length);
  const cells = (number, isMultiplier = false) => [...number.padStart(width, " ")].map((digit, column) =>
    `<td${position === width - column && (!active?.multiplierPosition || isMultiplier) ? ' class="is-active"' : ""}>${digit === " " ? "&nbsp;" : escapeHtml(digit)}</td>`).join("");

  let resultRows;
  if (operation === "×") {
    const partials = completed.filter((item) => item.multiplierPosition);
    resultRows = partials.map((item) => `<tr><th scope="row">${item.multiplierPosition}</th>${cells(item.fields[0].answer)}</tr>`).join("");
    if (!resultRows) resultRows = `<tr><th scope="row">=</th>${cells("?")}</tr>`;
  } else {
    const digits = Array(width).fill("·");
    completed.filter((item) => item.columnPosition).forEach((item) => { digits[width - item.columnPosition] = item.fields[0].answer; });
    resultRows = `<tr class="column-result"><th scope="row">=</th>${digits.map((digit, column) => `<td${position === width - column ? ' class="is-active"' : ""}>${escapeHtml(digit)}</td>`).join("")}</tr>`;
    const lastColumn = completed.filter((item) => item.columnPosition).at(-1);
    if (operation === "+" && lastColumn?.columnPosition === width && lastColumn.fields[1].answer === "1") {
      resultRows += `<tr><td colspan="${width + 1}" class="column-note">Перенос 1 запиши слева от полученных цифр.</td></tr>`;
    }
  }
  const carry = active?.columnPosition ? `<p class="column-note">${operation === "+" ? "Перенос" : "Займ"} из предыдущего разряда: ${active.incomingCarry}</p>` : "";
  return `<figure class="arithmetic-column"><figcaption>${operation === "×" ? "Умножение столбиком" : "Считаем столбиком"} · основание ${base}</figcaption><table aria-label="Вычисление столбиком"><tbody><tr><th scope="row">&nbsp;</th>${cells(left)}</tr><tr class="column-separator"><th scope="row">${operation}</th>${cells(right, true)}</tr>${resultRows}</tbody></table>${operation === "×" && completed.some((item) => item.multiplierPosition) ? '<p class="column-note">Частичные произведения после проверки каждого разряда.</p>' : carry}</figure>`;
}

function renderLearningTruthTable(guide) {
  const { task, steps, index } = guide;
  if (!task.meta.rows) return "";
  const variables = task.meta.variables;
  const headings = variables.map((name) => `<th scope="col">${escapeHtml(name)}</th>`).join("");
  const rows = task.meta.rows.map((row, rowIndex) => {
    const group = `Строка ${rowIndex + 1}:`;
    const lastStep = steps.findLastIndex((item) => item.group.startsWith(group));
    const shownResult = lastStep >= 0 && index > lastStep ? row.result : "?";
    const current = steps[index]?.group.startsWith(group);
    return `<tr${current ? ' class="is-current"' : ""}>${variables.map((name) => `<td>${row.values[name]}</td>`).join("")}<td>${shownResult}</td></tr>`;
  }).join("");
  return `<div class="truth-table-wrap guided-truth-table"><table class="truth-table"><caption>Таблица истинности</caption><thead><tr>${headings}<th scope="col">Результат</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderLearningExample(module) {
  const guide = state.studyGuide;
  const task = guide.task;
  return `<section class="task-panel ${module.color}" aria-labelledby="task-title">
    <div class="task-topline"><button class="text-button" type="button" data-action="new-task">Ещё пример ↻</button></div>
    <h2 id="task-title">${escapeHtml(task.prompt)}</h2>
    ${renderArithmeticColumn(guide) || renderTaskVisual(task)}${renderLearningTruthTable(guide)}${renderTrace(task, guide.steps[guide.index]?.codeLine ?? guide.steps[guide.index - 1]?.afterCodeLine)}
    ${renderLearningSteps(guide)}
  </section>`;
}

const systemNames = { 2: "Двоичная (2)", 8: "Восьмеричная (8)", 10: "Десятичная (10)", 16: "Шестнадцатеричная (16)" };

function renderVariants(module, selected) {
  if (module.id !== "systems") {
    const options = taskVariants[module.id].map((variant) => `<option value="${variant.id}"${variant.id === selected ? " selected" : ""}>${escapeHtml(variant.label)}</option>`).join("");
    return `<label class="variant-control" for="task-variant">Вид задания<select id="task-variant">${options}</select></label>`;
  }
  const isCompare = selected === "compare";
  const { source, target } = state.systemBases;
  const options = (selectedBase, otherBase) => Object.entries(systemNames).map(([base, label]) => `<option value="${base}"${Number(base) === selectedBase ? " selected" : ""}${Number(base) === otherBase ? " disabled" : ""}>${label}</option>`).join("");
  return `<div class="system-variants"><label class="variant-control" for="task-variant">Вид задания<select id="task-variant"><option value="convert"${isCompare ? "" : " selected"}>Перевод числа</option><option value="compare"${isCompare ? " selected" : ""}>Сравнение чисел</option></select></label>${isCompare ? "" : `<div class="base-controls"><label class="variant-control" for="source-base">Из какой системы<select id="source-base">${options(source, target)}</select></label><label class="variant-control" for="target-base">В какую систему<select id="target-base">${options(target, source)}</select></label></div>`}</div>`;
}

function renderModuleScreen() {
  const module = findModule(state.moduleId);
  const modeButtons = modes.map((mode) => `<button type="button" class="mode-tab ${state.mode === mode.id ? "is-active" : ""}" data-mode="${mode.id}" aria-pressed="${state.mode === mode.id}"><strong>${escapeHtml(mode.label)}</strong><span>${escapeHtml(mode.note)}</span></button>`).join("");
  const progress = state.progress.modules[module.id];
  const selected = getTaskVariant(state.studyTask);
  return `<main class="page-content module-page">
    <button class="back-link" type="button" data-action="home"><span aria-hidden="true">←</span> Все темы</button>
    <section class="module-heading ${module.color}"><div><h1>${escapeHtml(module.title)}</h1><p>${escapeHtml(module.description)}</p></div><div class="module-score"><span>Результат самопроверки</span><strong>${progress.attempts ? `${progress.correct} из ${progress.attempts}` : "Пока нет ответов"}</strong>${progress.attempts ? "<small>верно с первой попытки</small>" : ""}</div></section>
    <div class="lesson-controls"><div class="mode-switcher" role="group" aria-label="Режим занятия">${modeButtons}</div>${renderVariants(module, selected)}</div>
    <div class="learning-layout ${state.mode === "test" ? "solo-task" : "with-lesson"}">${state.mode === "study" ? renderLearningExample(module) : renderTaskPanel(module)}${renderLesson(module)}</div>
  </main>`;
}

function render() {
  // Сохраняем открытые подсказки и фокус при обновлении текущего экрана.
  const detailClasses = ["topic-theory", "learning-plan", "learning-history", "step-hint", "worked-example", "solution-details"];
  const openDetails = detailClasses.filter((name) => app.querySelector?.(`details.${name}`)?.open);
  const active = document.activeElement;
  const activeSelector = active?.id ? `#${active.id}` : active?.dataset?.mode ? `[data-mode="${active.dataset.mode}"]` : active?.dataset?.action ? `[data-action="${active.dataset.action}"]` : "";
  let screen = "";
  if (state.screen === "home") screen = renderHome();
  else if (state.screen === "progress") screen = renderProgress();
  else screen = renderModuleScreen();
  app.innerHTML = `${renderHeader()}${screen}<footer class="site-footer"><span>ИНФОЛАБ</span><span>Интерактивная лаборатория информатики</span></footer>`;
  for (const name of openDetails) {
    const detail = app.querySelector?.(`details.${name}`);
    if (detail) detail.open = true;
  }
  if (activeSelector) app.querySelector?.(activeSelector)?.focus?.({ preventScroll: true });
}

function setStudyTask(task) {
  state.studyTask = task;
  if (task.kind === "systems-conversion") state.systemBases = { source: task.meta.sourceBase, target: task.meta.targetBase };
  state.studyGuide = makeLearningGuide(task);
  state.reviewedTestTask = null;
}

function setTestTask(task) {
  state.task = task;
  state.testReference = state.studyTask;
  state.currentAnswer = null;
  state.feedback = null;
  state.attemptRecorded = false;
}

function startSelfTest(forceNew = false) {
  const module = findModule(state.moduleId);
  // Обычное переключение возвращает черновик. Разобранную задачу уже знаем,
  // поэтому после разбора начинаем новую самостоятельную попытку.
  if (forceNew || !state.task || state.testReference !== state.studyTask || state.reviewedTestTask === state.task) {
    setTestTask(generateSimilarTask(module, state.studyTask, Math.random, state.task ? [state.task] : []));
  }
  state.mode = "test";
}

function openModule(moduleId) {
  const module = findModule(moduleId);
  state.moduleId = module.id;
  state.screen = "module";
  state.mode = "study";
  state.task = null;
  state.testReference = null;
  state.feedback = null;
  state.currentAnswer = null;
  state.attemptRecorded = false;
  state.notice = "";
  setStudyTask(module.id === "systems" ? module.generateGuidedConversionTask() : module.generateTask());
  render();
}

function nextTask() {
  const module = findModule(state.moduleId);
  if (state.mode === "study") setStudyTask(generateSimilarTask(module, state.studyTask));
  else setTestTask(generateSimilarTask(module, state.studyTask, Math.random, [state.task]));
}

function reviewTestTask() {
  if (state.mode !== "test" || !state.attemptRecorded) return;
  setStudyTask(state.task);
  state.reviewedTestTask = state.task;
  state.mode = "study";
}

function goHome() {
  saveVisibleAnswer();
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

function saveVisibleAnswer() {
  if (typeof app.querySelector !== "function" || state.screen !== "module") return;
  if (state.mode === "test") {
    const form = app.querySelector("#exercise-form");
    if (form) state.currentAnswer = answerFromForm(form);
  } else {
    const form = app.querySelector("#learning-step-form");
    const step = state.studyGuide?.steps[state.studyGuide.index];
    if (form && step) state.studyGuide.draft = step.fields.map((_, index) => form.querySelector(`[name=learning-${index}]`)?.value ?? "");
  }
}

function submitLearningStep(form) {
  const guide = state.studyGuide;
  const step = guide?.steps[guide.index];
  if (!step) return;
  guide.draft = step.fields.map((_, index) => form.querySelector(`[name=learning-${index}]`)?.value ?? "");
  const result = checkLearningStep(step, guide.draft);
  guide.feedback = result;
  if (result.correct) {
    guide.history.push({ title: step.title, answerText: guide.draft.join(", "), explanation: step.explanation });
    guide.index += 1;
    guide.draft = [];
  }
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-module], [data-mode]");
  if (!target) return;
  if (target.dataset.module) { openModule(target.dataset.module); return; }
  if (target.dataset.mode) {
    if (state.screen !== "module" || !modes.some((mode) => mode.id === target.dataset.mode)) return;
    saveVisibleAnswer();
    if (target.dataset.mode === "test") startSelfTest();
    else state.mode = "study";
    render();
    return;
  }
  const action = target.dataset.action;
  if (["new-task", "review-task", "start-test"].includes(action) && state.screen !== "module") return;
  if (action === "home") goHome();
  else if (action === "progress") { saveVisibleAnswer(); state.screen = "progress"; state.notice = ""; render(); }
  else if (action === "hero-next") { state.heroStep = (state.heroStep + 1) % heroSteps.length; render(); }
  else if (action === "hero-step") { state.heroStep = Number(target.dataset.step); render(); }
  else if (action === "new-task") { nextTask(); render(); }
  else if (action === "review-task") { saveVisibleAnswer(); reviewTestTask(); render(); }
  else if (action === "start-test") { saveVisibleAnswer(); startSelfTest(state.attemptRecorded); render(); }
  else if (action === "clear-progress" && globalThis.confirm("Очистить все результаты? Это действие нельзя отменить.")) { state.progress = clearProgress(); state.notice = "Результаты очищены."; render(); }
});

app.addEventListener("change", (event) => {
  if (!["task-variant", "source-base", "target-base"].includes(event.target.id) || state.screen !== "module") return;
  const module = findModule(state.moduleId);
  saveVisibleAnswer();
  const hasAnswer = (value) => Array.isArray(value) ? value.some((item) => String(item).trim()) : Boolean(String(value ?? "").trim());
  const unfinishedStudy = state.studyGuide.index < state.studyGuide.steps.length
    && (state.studyGuide.index > 0 || hasAnswer(state.studyGuide.draft));
  const unfinishedTest = state.task && !state.attemptRecorded && hasAnswer(state.currentAnswer);
  const unfinished = unfinishedStudy || unfinishedTest;
  if (unfinished && !globalThis.confirm("Сменить вид задания? Незавершённое решение будет потеряно.")) { render(); return; }
  let variant = event.target.value;
  if (module.id === "systems") {
    const { source, target } = state.systemBases;
    if (event.target.id === "source-base") variant = `convert-${event.target.value}-${target}`;
    else if (event.target.id === "target-base") variant = `convert-${source}-${event.target.value}`;
    else if (variant === "convert") variant = `convert-${source}-${target}`;
  }
  if (!taskVariants[module.id].some((item) => item.id === variant)) { render(); return; }
  setStudyTask(generateTaskForVariant(module, variant));
  if (state.mode === "test") setTestTask(generateSimilarTask(module, state.studyTask));
  render();
});

app.addEventListener("submit", (event) => {
  if (state.screen !== "module") return;
  if (event.target.id === "learning-step-form" && state.mode === "study") {
    event.preventDefault();
    submitLearningStep(event.target);
    render();
    app.querySelector("[name=learning-0]")?.focus?.();
    return;
  }
  if (event.target.id !== "exercise-form" || state.mode !== "test") return;
  event.preventDefault();
  const module = findModule(state.moduleId);
  const answer = answerFromForm(event.target);
  state.currentAnswer = answer;
  const result = module.checkAnswer(state.task, answer);
  const counted = shouldCountAnswer(result.empty, state.attemptRecorded);
  if (counted) {
    state.progress = recordAttempt(module.id, result.correct);
    state.attemptRecorded = true;
  } else if (state.attemptRecorded) result.message += " В результатах учитывается первая попытка.";
  state.feedback = { result, counted };
  render();
  app.querySelector?.(".answer-feedback")?.focus?.({ preventScroll: true });
});

render();

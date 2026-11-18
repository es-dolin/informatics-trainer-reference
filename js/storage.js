// Хранит только обезличенные счётчики попыток в этом браузере.
const STORAGE_KEY = "informatics-trainer-reference-progress-v1";
const MODULE_IDS = ["systems", "arithmetic", "logic", "executors", "programs"];

function getBrowserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function emptyProgress() {
  const modules = {};
  for (const moduleId of MODULE_IDS) modules[moduleId] = { attempts: 0, correct: 0 };
  return { version: 1, modules };
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/** Первая непустая проверка задачи считается, следующие — нет. */
export function shouldCountAnswer(isEmpty, attemptAlreadyCounted) {
  return !isEmpty && !attemptAlreadyCounted;
}

/** При повреждённом JSON или недоступном хранилище возвращает пустой прогресс. */
export function loadProgress(storage) {
  if (storage === undefined) storage = getBrowserStorage();
  const fallback = emptyProgress();
  if (!storage) return fallback;

  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null");
    if (!saved || saved.version !== 1 || typeof saved.modules !== "object") return fallback;

    for (const moduleId of MODULE_IDS) {
      const entry = saved.modules[moduleId] ?? {};
      fallback.modules[moduleId] = {
        attempts: safeCount(entry.attempts),
        correct: Math.min(safeCount(entry.correct), safeCount(entry.attempts))
      };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function recordAttempt(moduleId, isCorrect, storage) {
  if (storage === undefined) storage = getBrowserStorage();
  const progress = loadProgress(storage);
  if (!MODULE_IDS.includes(moduleId)) return progress;
  progress.modules[moduleId].attempts += 1;
  if (isCorrect) progress.modules[moduleId].correct += 1;

  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Тренажёр продолжает работать и без сохранения, например в приватном окне.
  }
  return progress;
}

export function clearProgress(storage) {
  if (storage === undefined) storage = getBrowserStorage();
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Очистка не мешает пользоваться заданиями.
  }
  return emptyProgress();
}

export const progressStorageKey = STORAGE_KEY;

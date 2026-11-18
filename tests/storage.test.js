import test from "node:test";
import assert from "node:assert/strict";
import { clearProgress, emptyProgress, loadProgress, progressStorageKey, recordAttempt } from "../js/storage.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test("пустое и повреждённое сохранение безопасно заменяется нулевым прогрессом", () => {
  assert.deepEqual(loadProgress(null), emptyProgress());
  const storage = new MemoryStorage();
  storage.setItem(progressStorageKey, "это не JSON");
  assert.deepEqual(loadProgress(storage), emptyProgress());
});

test("попытки сохраняются отдельно для каждого модуля", () => {
  const storage = new MemoryStorage();
  recordAttempt("systems", true, storage);
  recordAttempt("systems", false, storage);
  const progress = loadProgress(storage);
  assert.deepEqual(progress.modules.systems, { attempts: 2, correct: 1 });
  assert.deepEqual(progress.modules.logic, { attempts: 0, correct: 0 });
});

test("неверные счётчики в сохранении не ломают экран результатов", () => {
  const storage = new MemoryStorage();
  storage.setItem(progressStorageKey, JSON.stringify({ version: 1, modules: { systems: { attempts: -5, correct: 99 } } }));
  assert.deepEqual(loadProgress(storage).modules.systems, { attempts: 0, correct: 0 });
});

test("очистка удаляет только прогресс тренажёра", () => {
  const storage = new MemoryStorage();
  storage.setItem("other-app", "keep");
  recordAttempt("logic", true, storage);
  clearProgress(storage);
  assert.equal(storage.getItem(progressStorageKey), null);
  assert.equal(storage.getItem("other-app"), "keep");
});

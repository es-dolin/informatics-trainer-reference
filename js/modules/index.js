// Этот список связывает чистую учебную логику с общими экранами приложения.
import * as systems from "./systems.js";
import * as arithmetic from "./arithmetic.js";
import * as logic from "./logic.js";
import * as executors from "./executors.js";
import * as programs from "./programs.js";

export const modules = [
  { id: "systems", number: "01", icon: "01", title: "Системы счисления", shortTitle: "Системы", color: "blue", description: "Перевод, разряды и сравнение чисел в разных основаниях.", skills: "ВПР 1–2", ...systems },
  { id: "arithmetic", number: "02", icon: "∑", title: "Арифметика", shortTitle: "Арифметика", color: "orange", description: "Сложение, вычитание и двоичные вычисления с разбором шагов.", skills: "ВПР 3–4", ...arithmetic },
  { id: "logic", number: "03", icon: "¬", title: "Математическая логика", shortTitle: "Логика", color: "violet", description: "Значения выражений, порядок действий и таблицы истинности.", skills: "ВПР 5–6, 10", ...logic },
  { id: "executors", number: "04", icon: "↗", title: "Алгоритмы и исполнители", shortTitle: "Исполнители", color: "green", description: "Команды исполнителей, повторения и путь на координатной сетке.", skills: "ВПР 7–8", ...executors },
  { id: "programs", number: "05", icon: "{ }", title: "Анализ программ", shortTitle: "Программы", color: "pink", description: "Условия, циклы, значения переменных и пошаговая трассировка.", skills: "ВПР 9", ...programs }
];

export function findModule(moduleId) {
  return modules.find((item) => item.id === moduleId) ?? modules[0];
}

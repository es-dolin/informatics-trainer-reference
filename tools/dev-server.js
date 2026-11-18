// Минимальный локальный сервер нужен браузерным ES-модулям.
// Он отдаёт только файлы внутри папки проекта и не требует внешних пакетов.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, relative, isAbsolute, sep } from "node:path";

const projectDirectory = resolve(process.cwd());
const port = Number(process.env.PORT) || 4173;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".md": "text/plain; charset=utf-8"
};

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", Allow: "GET, HEAD" });
    response.end("Метод не поддерживается.");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Некорректный адрес.");
    return;
  }

  if (pathname === "/") pathname = "/index.html";
  const filePath = resolve(projectDirectory, `.${pathname}`);
  const relativePath = relative(projectDirectory, filePath);
  const firstSegment = relativePath.split(sep)[0];
  const publicRoots = new Set(["index.html", "css", "js", "assets"]);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath) || !publicRoots.has(firstSegment)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Доступ запрещён.");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store"
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Файл не найден.");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Тренажёр доступен: http://localhost:${port}`);
  console.log("Остановить сервер: Ctrl+C");
});

// Asserts the calendar's alignment invariant in headless Chrome: dates differ by colour only.
// Usage: node test/render/alignment.mjs [pathToPopupHtml]

import { spawn } from "node:child_process";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { extname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const pageArg = process.argv[2] ?? "src/popup/index.html";
const pagePath = resolve(repoRoot, pageArg);

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CASES = [
  { theme: "light", lang: "en" },
  { theme: "dark", lang: "en" },
  { theme: "light", lang: "vi" },
];

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
};

async function serve(root) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    try {
      const body = await readFile(join(root, url.pathname));
      response.writeHead(200, {
        "Content-Type":
          MIME[extname(url.pathname)] ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end("not found");
    }
  });
  await new Promise((done) => server.listen(0, done));
  return { server, port: server.address().port };
}

function renderTitle(url) {
  return new Promise((resolveTitle, reject) => {
    const chrome = spawn(CHROME, [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--virtual-time-budget=4000",
      "--dump-dom",
      url,
    ]);
    let dom = "";
    chrome.stdout.on("data", (chunk) => {
      dom += chunk;
    });
    chrome.on("error", reject);
    chrome.on("close", () => {
      const match = dom.match(/<title>([\s\S]*?)<\/title>/);
      if (!match)
        return reject(
          new Error("page produced no <title> - it did not finish rendering"),
        );
      const decoded = match[1]
        .replaceAll("&quot;", '"')
        .replaceAll("&amp;", "&")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">");
      try {
        resolveTitle(JSON.parse(decoded));
      } catch {
        reject(
          new Error(
            `title was not the expected JSON: ${decoded.slice(0, 200)}`,
          ),
        );
      }
    });
  });
}

const work = await mkdtemp(join(tmpdir(), "attendance-render-"));
let failures = 0;

try {
  // Serve the root the page's asset URLs resolve against, or it renders blank.
  // Serve the tree the imports resolve against, or the page renders blank.
  const distRoot = resolve(repoRoot, "dist");
  const srcRoot = resolve(repoRoot, "src");
  const serveRoot = pagePath.startsWith(distRoot)
    ? distRoot
    : pagePath.startsWith(srcRoot)
      ? srcRoot
      : dirname(pagePath);
  await cp(serveRoot, work, { recursive: true });
  const pageUrlPath = pagePath.slice(serveRoot.length).replace(/^\//, "");

  const stubTemplate = await readFile(join(here, "chrome-stub.js"), "utf8");
  const pageSource = await readFile(pagePath, "utf8");
  const moduleTag = pageSource.match(/<script type="module"[^>]*><\/script>/);
  if (!moduleTag)
    throw new Error("could not find the page's module script tag");

  const { server, port } = await serve(work);

  for (const { theme, lang } of CASES) {
    const stubName = `chrome-stub-${theme}-${lang}.js`;
    await writeFile(
      join(work, stubName),
      stubTemplate.replace("__THEME__", theme).replace("__LANG__", lang),
      "utf8",
    );
    const pageName = pageUrlPath.replace(
      /[^/]+$/,
      `probe-${theme}-${lang}.html`,
    );
    await writeFile(
      join(work, pageName),
      pageSource.replace(
        moduleTag[0],
        `<script src="/${stubName}"></script>\n${moduleTag[0]}`,
      ),
      "utf8",
    );

    const result = await renderTitle(`http://localhost:${port}/${pageName}`);
    const label = `${theme}/${lang}`;
    const ok =
      result.geometries.length === 1 &&
      result.offsets.length === 1 &&
      result.cells >= 28;

    if (ok) {
      console.log(
        `  OK   ${label.padEnd(10)} ${result.cells} cells, ${result.geometries[0]}, glyph ${result.offsets[0]}`,
      );
    } else {
      failures++;
      console.log(`  FAIL ${label.padEnd(10)} cells=${result.cells}`);
      console.log(`       geometries: ${JSON.stringify(result.geometries)}`);
      console.log(`       glyph offsets: ${JSON.stringify(result.offsets)}`);
    }
  }

  server.close();
} finally {
  await rm(work, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(
    `\nAlignment invariant broken in ${failures} case(s): a date is not where every other date is.`,
  );
  process.exit(1);
}
console.log(
  `\nAlignment invariant holds for ${basename(pagePath)} in all ${CASES.length} cases.`,
);

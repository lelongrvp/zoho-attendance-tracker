// Drives the built options page in headless Chrome: every control round-trips through storage.
import { spawn } from "node:child_process";
import { readFile, writeFile, cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const distRoot = resolve(repoRoot, "dist");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };

const work = await mkdtemp(join(tmpdir(), "attendance-options-"));
let failed = false;

try {
  await cp(distRoot, work, { recursive: true });

  const stub = `
    const STORE = {};
    const writes = [];
    globalThis.chrome = {
      storage: {
        local: {
          get: async (keys) => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((k) => [k, STORE[k]])),
          set: async (obj) => { writes.push(obj); Object.assign(STORE, obj); },
          remove: async (keys) => { for (const k of [].concat(keys)) delete STORE[k]; },
        },
        onChanged: { addListener: () => {} },
      },
      runtime: { sendMessage: async () => ({ status: "success" }) },
    };
    globalThis.__probe = { STORE, writes };
  `;
  await writeFile(join(work, "options-stub.js"), stub, "utf8");

  const page = await readFile(join(distRoot, "options/index.html"), "utf8");
  const moduleTag = page.match(/<script type="module"[^>]*><\/script>/);
  await writeFile(
    join(work, "options/probe.html"),
    page.replace(moduleTag[0], `<script src="/options-stub.js"></script>\n${moduleTag[0]}`),
    "utf8",
  );

  const driver = `
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(400);
    const result = {};

    const setValue = (id, value, eventName) => {
      const element = document.getElementById(id);
      element.value = value;
      element.dispatchEvent(new Event(eventName, { bubbles: true }));
    };

    // every kind of control
    setValue("cycleStartDay", "15", "input");
    setValue("shortDayQuota", "7", "input");
    setValue("fullDaySeconds", "7.5", "input");
    setValue("lateStartAfterMinutes", "12:30", "input");
    setValue("portal-id", "hrportal9999", "input");
    setValue("holiday-statuses", "le, tet", "input");
    setValue("target-mode", "worked", "change");
    await wait(60);

    document.getElementById("save").click();
    await wait(250);

    const saved = globalThis.__probe.STORE;
    result.policy = {
      cycleStartDay: saved.policy?.cycleStartDay,
      shortDayQuota: saved.policy?.shortDayQuota,
      fullDaySeconds: saved.policy?.fullDaySeconds,
      lateStartAfterMinutes: saved.policy?.lateStartAfterMinutes,
      targetMode: saved.policy?.targetMode,
      holidayStatuses: saved.policy?.holidayStatuses,
    };
    result.portalId = saved.portalId;
    result.status = document.getElementById("status").textContent;

    // validation still rejects a short-day floor above the full day
    setValue("shortDaySeconds", "9", "input");
    await wait(60);
    document.getElementById("save").click();
    await wait(200);
    result.validationMessage = document.getElementById("status").textContent;

    // colour preview must follow a drag (input), not wait for blur (change).
    // Stamp light first: headless Chrome reports prefers-color-scheme dark, so
    // the preview would otherwise apply the dark side of the scheme.
    document.documentElement.dataset.theme = "light";
    setValue("scheme-select", "custom", "change");
    await wait(150);
    result.customVisible = Boolean(document.querySelector('input[type="color"]'));
    const before = getComputedStyle(document.documentElement).getPropertyValue("--color-paper").trim();
    const swatch = document.querySelector('input[type="color"]');
    swatch.value = "#123456";
    swatch.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(150);
    const after = getComputedStyle(document.documentElement).getPropertyValue("--color-paper").trim();
    result.previewFollowsInput = before !== after && after === "#123456";

    document.title = JSON.stringify(result);
  `;
  await writeFile(join(work, "driver.js"), `(async () => {${driver}})();`, "utf8");
  await writeFile(
    join(work, "options/probe.html"),
    (await readFile(join(work, "options/probe.html"), "utf8")).replace(
      "</body>",
      '<script type="module" src="/driver.js"></script></body>',
    ),
    "utf8",
  );

  const server = createServer(async (request, response) => {
    try {
      const body = await readFile(join(work, new URL(request.url, "http://x").pathname));
      response.writeHead(200, { "Content-Type": MIME[extname(request.url.split("?")[0])] ?? "text/plain" });
      response.end(body);
    } catch {
      response.writeHead(404).end("nope");
    }
  });
  await new Promise((done) => server.listen(0, done));
  const { port } = server.address();

  const dom = await new Promise((resolveDom, reject) => {
    const chrome = spawn(CHROME, ["--headless", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=6000", "--dump-dom", `http://localhost:${port}/options/probe.html`]);
    let text = "";
    chrome.stdout.on("data", (chunk) => { text += chunk; });
    chrome.on("error", reject);
    chrome.on("close", () => resolveDom(text));
  });
  server.close();

  const match = dom.match(/<title>([\s\S]*?)<\/title>/);
  const result = JSON.parse(
    match[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">"),
  );

  const checks = [
    ["plain number saved", result.policy.cycleStartDay === 15],
    ["quota saved", result.policy.shortDayQuota === 7],
    ["hours converted to seconds", result.policy.fullDaySeconds === 27000],
    ["time converted to minutes", result.policy.lateStartAfterMinutes === 750],
    ["select saved", result.policy.targetMode === "worked"],
    ["keywords split", Array.isArray(result.policy.holidayStatuses) && result.policy.holidayStatuses.join("|") === "le|tet"],
    ["portal id saved", result.portalId === "hrportal9999"],
    ["save confirmed", result.status === "Saved"],
    ["validation still rejects", result.validationMessage === "Short-day floor must be below the full day"],
    ["custom scheme revealed", result.customVisible === true],
    ["preview follows onInput, not onChange", result.previewFollowsInput === true],
  ];

  for (const [name, passed] of checks) {
    console.log(`  ${passed ? "OK  " : "FAIL"} ${name}`);
    if (!passed) failed = true;
  }
} finally {
  await rm(work, { recursive: true, force: true });
}

if (failed) {
  console.error("\nOptions page does not round-trip.");
  process.exit(1);
}
console.log("\nEvery control round-trips through storage.");

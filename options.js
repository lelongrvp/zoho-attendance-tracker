import {
  DEFAULT_POLICY,
  DEFAULT_PORTAL_ID,
  pad,
  readPolicy,
} from "./policy.js";
import { SCHEMES, applyTokens, listSchemes, resolveTokens } from "./themes.js";

const COLOR_KEYS = ["paper", "panel", "ink", "stamp", "moss", "amber"];

function customInput(mode, key) {
  return document.getElementById(`${mode === "light" ? "cl" : "cd"}-${key}`);
}

function readCustomFromForm() {
  const scheme = { name: "Custom", light: {}, dark: {} };
  for (const mode of ["light", "dark"]) {
    for (const key of COLOR_KEYS) {
      scheme[mode][key] = customInput(mode, key).value;
    }
  }
  return scheme;
}

function fillCustomForm(customScheme) {
  const source = customScheme || SCHEMES.gruvbox;
  for (const mode of ["light", "dark"]) {
    for (const key of COLOR_KEYS) {
      customInput(mode, key).value =
        source[mode]?.[key] || SCHEMES.gruvbox[mode][key];
    }
  }
}

function pageMode() {
  const stamped = document.documentElement.dataset.theme;
  if (stamped === "dark" || stamped === "light") return stamped;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applySchemeToPage(schemeId, customScheme) {
  applyTokens(
    document.documentElement,
    resolveTokens(schemeId, pageMode(), customScheme),
  );
}

function initSchemeSelect() {
  const select = document.getElementById("scheme-select");
  for (const { id, name } of listSchemes()) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = name;
    select.appendChild(option);
  }
  const custom = document.createElement("option");
  custom.value = "custom";
  custom.textContent = "Custom";
  select.appendChild(custom);

  const syncCustomVisibility = () => {
    document.getElementById("custom-scheme").hidden = select.value !== "custom";
    applySchemeToPage(select.value, readCustomFromForm());
  };
  select.addEventListener("change", syncCustomVisibility);
  document.getElementById("custom-scheme").addEventListener("input", () => {
    if (select.value === "custom") {
      applySchemeToPage("custom", readCustomFromForm());
    }
  });
}

const hourFields = {
  "full-day": "fullDaySeconds",
  "short-day": "shortDaySeconds",
};
const timeFields = {
  "late-start": "lateStartAfterMinutes",
  "late-threshold": "lateThresholdMinutes",
};
const plainFields = {
  "cycle-start": "cycleStartDay",
  "early-part": "earlyPartTimeHours",
  "early-full": "earlyFullTimeHours",
  "late-part": "latePartTimeHours",
  "late-full": "lateFullTimeHours",
  "quota-short": "shortDayQuota",
  "quota-request": "requestQuota",
  "quota-violation": "violationQuota",
  "stale-after": "staleAfterMinutes",
};

const statusElem = document.getElementById("status");

function minutesToTimeValue(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function timeValueToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

async function applyStoredTheme() {
  const { theme } = await chrome.storage.local.get("theme");
  if (theme === "dark" || theme === "light") {
    document.documentElement.dataset.theme = theme;
  }
}

async function loadForm() {
  const policy = await readPolicy();
  const { portalId } = await chrome.storage.local.get("portalId");

  document.getElementById("portal-id").value = portalId || DEFAULT_PORTAL_ID;
  document.getElementById("target-mode").value = policy.targetMode;

  const { scheme, customScheme } = await chrome.storage.local.get([
    "scheme",
    "customScheme",
  ]);
  const select = document.getElementById("scheme-select");
  select.value =
    scheme && (scheme === "custom" || SCHEMES[scheme]) ? scheme : "gruvbox";
  fillCustomForm(customScheme);
  document.getElementById("custom-scheme").hidden = select.value !== "custom";
  applySchemeToPage(select.value, customScheme);
  for (const [inputId, key] of Object.entries(plainFields)) {
    document.getElementById(inputId).value = policy[key];
  }
  for (const [inputId, key] of Object.entries(hourFields)) {
    document.getElementById(inputId).value = policy[key] / 3600;
  }
  for (const [inputId, key] of Object.entries(timeFields)) {
    document.getElementById(inputId).value = minutesToTimeValue(policy[key]);
  }
}

function showStatus(message, isError = false) {
  statusElem.textContent = message;
  statusElem.className = isError ? "error" : "";
}

async function save() {
  const policy = {};

  for (const [inputId, key] of Object.entries(plainFields)) {
    const value = Number(document.getElementById(inputId).value);
    if (!Number.isFinite(value)) {
      showStatus(`Invalid value for ${key}`, true);
      return;
    }
    policy[key] = value;
  }
  for (const [inputId, key] of Object.entries(hourFields)) {
    const value = Number(document.getElementById(inputId).value);
    if (!Number.isFinite(value) || value <= 0) {
      showStatus(`Invalid value for ${key}`, true);
      return;
    }
    policy[key] = Math.round(value * 3600);
  }
  for (const [inputId, key] of Object.entries(timeFields)) {
    const value = document.getElementById(inputId).value;
    if (!/^\d{2}:\d{2}$/.test(value)) {
      showStatus(`Invalid time for ${key}`, true);
      return;
    }
    policy[key] = timeValueToMinutes(value);
  }
  const targetMode = document.getElementById("target-mode").value;
  if (targetMode !== "offset" && targetMode !== "worked") {
    showStatus("Invalid target model", true);
    return;
  }
  policy.targetMode = targetMode;

  if (policy.shortDaySeconds >= policy.fullDaySeconds) {
    showStatus("Short-day floor must be below the full day", true);
    return;
  }

  const portalId = document.getElementById("portal-id").value.trim();
  const schemeId = document.getElementById("scheme-select").value;
  const writes = {
    policy,
    scheme: schemeId,
    customScheme: readCustomFromForm(),
  };
  if (portalId && portalId !== DEFAULT_PORTAL_ID) {
    writes.portalId = portalId;
  } else {
    await chrome.storage.local.remove("portalId");
  }

  await chrome.storage.local.set(writes);
  applySchemeToPage(schemeId, writes.customScheme);
  showStatus("Saved");
}

async function reset() {
  await chrome.storage.local.remove([
    "policy",
    "portalId",
    "scheme",
    "customScheme",
  ]);
  await loadForm();
  showStatus("Defaults restored");
}

document.getElementById("save").addEventListener("click", save);
document.getElementById("reset").addEventListener("click", reset);

applyStoredTheme();
initSchemeSelect();
loadForm();

import { render } from "preact";
import { App } from "./App.tsx";
import "../styles/app.css";
import { readOne } from "@/lib/storage.ts";

/** Stamp the stored mode before first paint so the page does not flash. */
const stored: "light" | "dark" | undefined = await readOne("theme");
if (stored === "dark" || stored === "light") {
  document.documentElement.dataset["theme"] = stored;
}

const root: HTMLElement | null = document.getElementById("root");
if (root) {
  render(<App />, root);
}

import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { AlertStrip } from "../../src/popup/components/AlertStrip.tsx";
import { makeTranslator } from "../../src/lib/i18n.ts";
import type { Translator } from "../../src/lib/i18n.ts";

afterEach((): void => {
  cleanup();
});

const translate: Translator = makeTranslator("en");
const translateVi: Translator = makeTranslator("vi");

describe("AlertStrip", () => {
  it("renders nothing when hidden", () => {
    const { container } = render(
      <AlertStrip state={{ kind: "hidden" }} translate={translate} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the login prompt as text around a real anchor, with no literal placeholder", () => {
    const { container } = render(
      <AlertStrip state={{ kind: "login" }} translate={translate} />,
    );
    const link: HTMLAnchorElement | null =
      container.querySelector("a.border-b");
    expect(link?.getAttribute("href")).toBe("https://people.zoho.com/");
    expect(link?.textContent).toBe("Zoho People");
    expect(container.textContent).toBe("Please log in to Zoho People");
    expect(container.textContent).not.toContain("{link}");
  });

  it("keeps the anchor inside the sentence when the language puts it elsewhere", () => {
    const { container } = render(
      <AlertStrip state={{ kind: "login" }} translate={translateVi} />,
    );
    expect(container.textContent).toBe("Vui lòng đăng nhập Zoho People");
    expect(container.querySelectorAll("a").length).toBe(1);
  });

  it("renders an error message as plain text, not markup", () => {
    const { container } = render(
      <AlertStrip
        state={{ kind: "error", message: "<b>boom</b>" }}
        translate={translate}
      />,
    );
    expect(container.textContent).toContain("<b>boom</b>");
    expect(container.querySelectorAll("b").length).toBe(0);
  });
});

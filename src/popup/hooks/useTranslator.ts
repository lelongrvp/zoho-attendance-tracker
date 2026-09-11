import { useMemo } from "preact/hooks";
import type { Lang } from "../../lib/types.ts";
import type { Translator } from "../../lib/i18n.ts";
import { makeTranslator } from "../../lib/i18n.ts";

export function useTranslator(lang: Lang): Translator {
  return useMemo((): Translator => makeTranslator(lang), [lang]);
}

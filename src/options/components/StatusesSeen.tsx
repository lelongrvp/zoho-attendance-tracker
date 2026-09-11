import type { VNode } from "preact";
import type { StatusCount } from "../../lib/types.ts";

type StatusesSeenProps = {
  statuses: StatusCount[];
};

/** What this portal actually sends, so the keyword lists can be matched to it. */
export function StatusesSeen({ statuses }: StatusesSeenProps): VNode {
  const text: string =
    statuses.length > 0
      ? statuses
          .map(
            (entry: StatusCount): string => `${entry.status} (${entry.count})`,
          )
          .join(", ")
      : "nothing cached yet - open the popup once";

  return (
    <span class="max-w-[50%] text-right font-num text-[12px] text-ink-2">
      {text}
    </span>
  );
}

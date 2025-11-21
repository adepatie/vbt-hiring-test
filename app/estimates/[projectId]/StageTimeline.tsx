import { formatEstimateStageLabel } from "@/lib/utils/estimates";
import type { SerializableStageTransition } from "./project-types";

const dateTimeFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function StageTimeline({
  transitions,
}: {
  transitions: SerializableStageTransition[];
}) {
  return (
    <div className="space-y-4 p-4">
      <h3 className="text-lg font-semibold">Stage timeline</h3>
      <div className="space-y-4">
        {transitions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            This project has not advanced to the next stage yet.
          </p>
        )}
        {transitions.map((transition) => (
          <div key={transition.id} className="border-l-2 border-border pl-4">
            <p className="font-semibold">
              {formatEstimateStageLabel(transition.from)} →{" "}
              {formatEstimateStageLabel(transition.to)}
            </p>
            <p className="text-xs text-muted-foreground">
              {dateTimeFormat.format(new Date(transition.timestamp))}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}


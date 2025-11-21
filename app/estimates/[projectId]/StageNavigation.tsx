import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatEstimateStageLabel } from "@/lib/utils/estimates";
import { estimateStageOrder, type EstimateStage } from "@/lib/zod/estimates";

type StageNavigatorProps = {
  currentStage: EstimateStage;
  selectedStage: EstimateStage;
  onSelect: (stage: EstimateStage) => void;
  restrictFuture?: boolean;
};

export function StageNavigator({
  currentStage,
  selectedStage,
  onSelect,
  restrictFuture = false,
}: StageNavigatorProps) {
  const currentIdx = estimateStageOrder.indexOf(currentStage);

  return (
    <Card className="shadow-sm">
      <CardBody>
        <div className="flex flex-wrap gap-3">
          {estimateStageOrder.map((stage, index) => {
            const isCurrent = stage === selectedStage;
            const isComplete = index < currentIdx;
            const isDisabled =
              restrictFuture && index > currentIdx && stage !== selectedStage;

            return (
              <Button
                key={stage}
                variant={isCurrent ? "default" : "outline"}
                className={cn(
                  "text-sm",
                  isComplete && !isCurrent
                    ? "border-green-200 text-green-700 hover:bg-green-50"
                    : null,
                )}
                disabled={isDisabled}
                onClick={() => onSelect(stage)}
              >
                {formatEstimateStageLabel(stage)}
              </Button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

export function StageSidebar({
  currentStage,
  selectedStage,
  onSelect,
  restrictFuture = false,
}: StageNavigatorProps) {
  const currentIdx = estimateStageOrder.indexOf(currentStage);

  return (
    <nav className="space-y-1">
      {estimateStageOrder.map((stage, index) => {
        const isSelected = stage === selectedStage;
        const isCurrent = stage === currentStage;
        const isComplete = index < currentIdx;
        const isDisabled = restrictFuture && index > currentIdx;

        return (
          <button
            key={stage}
            onClick={() => !isDisabled && onSelect(stage)}
            disabled={isDisabled}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isSelected
                ? "bg-primary/10 text-primary"
                : isDisabled
                ? "text-muted-foreground/40 cursor-not-allowed"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              isComplete && !isSelected && !isDisabled ? "text-foreground" : "",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-xs font-mono",
                  isSelected ? "text-primary/70" : "text-muted-foreground/50",
                )}
              >
                {(index + 1).toString().padStart(2, "0")}
              </span>
              <span className="truncate">
                {formatEstimateStageLabel(stage)}
              </span>
              {isCurrent && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );
}


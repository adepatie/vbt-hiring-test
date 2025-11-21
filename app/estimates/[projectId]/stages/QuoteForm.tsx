"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { appToaster } from "@/lib/ui/toaster";
import type {
  EstimateStage,
  Quote,
  WbsItem,
} from "@/lib/zod/estimates";
import { saveQuoteAction } from "../../actions";
import { useStageActions } from "../useStageActionBar";
import { buildWbsSummaryFromItems, callCopilot } from "../copilotHelpers";

const quoteFormSchema = z.object({
  paymentTerms: z
    .string()
    .trim()
    .max(20000, "Payment terms content is too long.")
    .optional(),
  timeline: z
    .string()
    .trim()
    .max(20000, "Timeline content is too long.")
    .optional(),
  overheadFee: z
    .number({ invalid_type_error: "Overhead fee must be a number." })
    .nonnegative("Overhead fee must be positive.")
    .optional(),
  delivered: z.boolean().optional(),
});

type QuoteFormProps = {
  projectId: string;
  projectName: string;
  clientName: string | null;
  quote: Quote | null;
  wbsItems: WbsItem[];
  canEdit: boolean;
  nextStage?: EstimateStage;
};

export function QuoteForm({
  projectId,
  projectName,
  clientName,
  quote,
  wbsItems,
  canEdit,
  nextStage,
}: QuoteFormProps) {
  const toast = appToaster;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const subtotal = useMemo(() => {
    return wbsItems.reduce((sum, item) => sum + item.hours * item.roleRate, 0);
  }, [wbsItems]);

  const overheadFee = quote?.overheadFee ?? 0;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<z.infer<typeof quoteFormSchema>>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      paymentTerms: quote?.paymentTerms ?? "",
      timeline: quote?.timeline ?? "",
      overheadFee: quote?.overheadFee ?? 0,
      delivered: quote?.delivered ?? false,
    },
  });

  const finalTotal = subtotal + overheadFee;

  useEffect(() => {
    reset({
      paymentTerms: quote?.paymentTerms ?? "",
      timeline: quote?.timeline ?? "",
      overheadFee: quote?.overheadFee ?? 0,
      delivered: quote?.delivered ?? false,
    });
  }, [quote, reset]);

  const persistQuote = useCallback((
    values: z.infer<typeof quoteFormSchema>,
    markDelivered = false,
  ) => {
    startTransition(async () => {
      try {
        await saveQuoteAction({
          projectId,
          paymentTerms: values.paymentTerms,
          timeline: values.timeline,
          // Overhead fee is system-controlled (seeded / Copilot), not edited here
          overheadFee,
          delivered: markDelivered || values.delivered,
        });
        toast.success({ title: "Quote saved." });

        if (markDelivered) {
          toast.success({
            title: "Quote marked as delivered.",
          });
        }

        router.refresh();
      } catch (error) {
        console.error(error);
        toast.error({
          title: "Unable to save quote",
          description:
            error instanceof Error ? error.message : "Unexpected error.",
        });
      }
    });
  }, [projectId, router, toast, overheadFee]);

  const handleRegenerateTerms = useCallback(async () => {
    if (!canEdit) return;
    setIsRegenerating(true);
    try {
      const wbsSummary = buildWbsSummaryFromItems(wbsItems);

      const result = await callCopilot<{
        result: { paymentTerms: string; timeline: string };
      }>("generateQuoteTerms", projectId, {
        projectId,
        subtotal,
        overheadFee,
        total: finalTotal,
        wbsSummary,
      });

      const terms = result.result?.paymentTerms ?? "";
      const timeline = result.result?.timeline ?? "";

      await saveQuoteAction({
        projectId,
        paymentTerms: terms,
        timeline: timeline,
        overheadFee,
        delivered: undefined, // Don't change delivered status on regen
      });

      toast.success({
        title: "Quote terms regenerated.",
        description:
          "Copilot generated new payment terms and timeline based on the WBS.",
      });
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error({
        title: "Copilot error",
        description:
          error instanceof Error ? error.message : "Unexpected Copilot error.",
      });
    } finally {
      setIsRegenerating(false);
    }
  }, [canEdit, finalTotal, overheadFee, projectId, router, subtotal, toast, wbsItems]);

  const handleCopyToClipboard = useCallback(async () => {
    setIsCopying(true);
    try {
      const exportData = await fetch(
        `/api/projects/${projectId}/quote/export?format=text`,
      ).then((r) => r.text());
      await navigator.clipboard.writeText(exportData);
      toast.success({ title: "Quote copied to clipboard." });
    } catch (error) {
      console.error(error);
      toast.error({
        title: "Unable to copy",
        description:
          error instanceof Error ? error.message : "Unexpected error.",
      });
    } finally {
      setIsCopying(false);
    }
  }, [projectId, toast]);

  const handleExportCSV = useCallback(() => {
    window.open(`/api/projects/${projectId}/quote/export?format=csv`, "_blank");
  }, [projectId]);

  const roleTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const item of wbsItems) {
      totals[item.roleName] =
        (totals[item.roleName] || 0) + item.hours * item.roleRate;
    }
    return totals;
  }, [wbsItems]);

  // Cleanup actions on unmount
  useStageActions(() => {
    if (!canEdit) {
      return null;
    }

    return (
      <>
        <Button
          type="button"
          variant="outline"
          className="inline-flex items-center gap-2"
          onClick={handleCopyToClipboard}
          disabled={isCopying}
        >
          {isCopying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Copying...
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy to clipboard
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="inline-flex items-center gap-2"
          onClick={handleExportCSV}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          className="inline-flex items-center gap-2"
          onClick={handleRegenerateTerms}
          disabled={isPending || isRegenerating}
        >
          {isRegenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Regenerate terms with Copilot
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={handleSubmit((values) => persistQuote(values, false))}
          disabled={isPending || isRegenerating}
        >
          {isPending ? "Saving..." : "Save details"}
        </Button>
        <Button
          onClick={handleSubmit((values) => persistQuote(values, true))}
          disabled={isPending || isRegenerating || quote?.delivered}
        >
          {isPending ? "Working..." : "Mark delivered"}
        </Button>
      </>
    );
  }, [canEdit, isCopying, isPending, isRegenerating, quote, handleSubmit, persistQuote, handleCopyToClipboard, handleExportCSV, handleRegenerateTerms]);

  return (
    <div className="flex flex-col gap-4">
      {quote?.delivered && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Quote has been delivered to the client.</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Pricing Breakdown</h3>
        <div className="space-y-2 text-sm">
          {Object.entries(roleTotals).map(([roleName, total]) => (
            <div key={roleName} className="flex justify-between">
              <span className="text-muted-foreground">{roleName}</span>
              <span className="font-medium">${total.toLocaleString()}</span>
            </div>
          ))}
          <div className="border-t pt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Overhead Fee</span>
              <span className="font-medium">
                ${overheadFee.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>${finalTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Payment terms</label>
        <Textarea
          rows={4}
          {...register("paymentTerms")}
          readOnly={!canEdit}
          className={!canEdit ? "bg-muted/30" : undefined}
        />
        {errors.paymentTerms && (
          <p className="text-sm text-destructive">
            {errors.paymentTerms.message}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Timeline</label>
        <Textarea
          rows={4}
          {...register("timeline")}
          readOnly={!canEdit}
          className={!canEdit ? "bg-muted/30" : undefined}
        />
        {errors.timeline && (
          <p className="text-sm text-destructive">
            {errors.timeline.message}
          </p>
        )}
      </div>
    </div>
  );
}


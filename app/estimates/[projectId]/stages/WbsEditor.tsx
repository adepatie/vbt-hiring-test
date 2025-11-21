"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { appToaster } from "@/lib/ui/toaster";
import {
  type WbsItem,
  wbsItemInputSchema,
} from "@/lib/zod/estimates";
import {
  advanceStageAction,
  saveQuoteAction,
  updateWbsItemsAction,
} from "../../actions";
import type { RoleOption } from "../project-types";
import { useStageActions } from "../useStageActionBar";
import { buildWbsSummaryFromRoleOptions, callCopilot } from "../copilotHelpers";

const wbsFormSchema = z.object({
  items: z
    .array(
      wbsItemInputSchema.extend({
        task: z.string().trim().min(1, "Task is required.").max(240),
        role: z.string().trim().min(1, "Role is required.").max(120),
        hours: z
          .number({ invalid_type_error: "Hours must be a number." })
          .positive("Hours must be greater than zero.")
          .max(10000, "Hours is unrealistically large."),
      }),
    )
    .min(1, "Add at least one WBS item."),
});

const normalizeWbsItems = (items: WbsItem[], fallbackRoleId: string) =>
  (items.length > 0
    ? items
    : [
        {
          id: undefined,
          task: "",
          roleId: fallbackRoleId,
          hours: 0,
        },
      ]
  ).map(({ id, task, roleId, hours }) => ({
    id,
    task,
    roleId: roleId ?? fallbackRoleId,
    hours,
  }));

type WbsFormValues = z.infer<typeof wbsFormSchema>;

type WbsEditorProps = {
  projectId: string;
  items: WbsItem[];
  canEdit: boolean;
  roles: RoleOption[];
};

export function WbsEditor({
  projectId,
  items,
  canEdit,
  roles,
}: WbsEditorProps) {
  const router = useRouter();
  const toast = appToaster;
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
  const hasRoles = roles.length > 0;
  const fallbackRoleId = roles[0]?.id ?? "";
  const initialItems = normalizeWbsItems(items, fallbackRoleId);
  const {
    register,
    control,
    formState: { errors, isDirty },
    reset,
    setValue,
  } = useForm<WbsFormValues>({
    resolver: zodResolver(wbsFormSchema),
    defaultValues: { items: initialItems },
  });
  const canModify = canEdit && hasRoles;
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousItemsRef = useRef<string>(JSON.stringify(initialItems));

  useEffect(() => {
    reset({ items: normalizeWbsItems(items, fallbackRoleId) });
    previousItemsRef.current = JSON.stringify(normalizeWbsItems(items, fallbackRoleId));
  }, [items, reset, fallbackRoleId]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = useWatch({ control, name: "items" }) ?? [];
  const totalHours = watchedItems.reduce(
    (sum, item) => sum + (Number(item.hours) || 0),
    0,
  );

  const saveWbsItems = useCallback(async (
    itemsToSave: typeof watchedItems,
    options?: { refresh?: boolean },
  ) => {
    if (!hasRoles) {
      return;
    }

    try {
      await updateWbsItemsAction({
        projectId,
        items: itemsToSave
          .filter((item) => item.task.trim() || item.hours > 0)
          .map((item) => ({
            ...item,
            hours: Number(item.hours),
          })),
      });
      previousItemsRef.current = JSON.stringify(itemsToSave);
      if (options?.refresh) {
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      toast.error({
        title: "Unable to auto-save WBS",
        description:
          error instanceof Error ? error.message : "Unexpected error.",
      });
    }
  }, [hasRoles, projectId, router, toast]);

  useEffect(() => {
    if (!canModify || !hasRoles || isAutoSaving) {
      return;
    }

    const currentItemsStr = JSON.stringify(watchedItems);
    if (currentItemsStr === previousItemsRef.current) {
      return;
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      setIsAutoSaving(true);
      await saveWbsItems(watchedItems);
      setIsAutoSaving(false);
    }, 500);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [watchedItems, canModify, hasRoles, isAutoSaving, saveWbsItems]);

  const calculateSubtotal = (wbsItems: typeof watchedItems): number => {
    return wbsItems.reduce((sum, item) => {
      const role = roles.find((r) => r.id === item.roleId);
      if (!role) return sum;
      return sum + (Number(item.hours) || 0) * role.rate;
    }, 0);
  };

  const handleRegenerate = useCallback(async () => {
    if (!canModify) return;
    setIsRegenerating(true);
    try {
      await callCopilot("generateEffortFromSolution", projectId, { projectId });

      toast.success({
        title: "Effort regenerated.",
        description:
          "Copilot replaced the WBS items using the current Solution draft.",
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
  }, [canModify, projectId, router, toast]);

  const handleGenerateQuoteAndAdvance = useCallback(async () => {
    if (!canModify || !hasRoles) return;

    const validItems = watchedItems.filter(
      (item) => item.task.trim() || item.hours > 0,
    );

    if (validItems.length === 0) {
      toast.error({
        title: "No WBS items",
        description: "Add at least one WBS item before generating a quote.",
      });
      return;
    }

    setIsGeneratingQuote(true);
    try {
      // 1. Ensure WBS items are saved first
      if (isDirty) {
        await saveWbsItems(watchedItems, { refresh: true });
      }

      // 2. Calculate totals
      const subtotal = calculateSubtotal(validItems);
      // Use default overhead fee (service will handle defaults when saving)
      const overheadFee = 0;
      const total = subtotal + overheadFee;

      // 3. Build WBS summary
      const wbsSummary = buildWbsSummaryFromRoleOptions(validItems, roles);

      // 4. Generate quote terms
      const result = await callCopilot<{
        result: { paymentTerms: string; timeline: string };
      }>("generateQuoteTerms", projectId, {
        projectId,
        subtotal,
        overheadFee,
        total,
        wbsSummary,
      });

      const paymentTerms = result.result?.paymentTerms ?? "";
      const timeline = result.result?.timeline ?? "";

      // 5. Advance stage to QUOTE before persisting quote data
      await advanceStageAction({ projectId, targetStage: "QUOTE" });

      // 6. Save quote (now allowed because project is at QUOTE)
      await saveQuoteAction({
        projectId,
        paymentTerms,
        timeline,
        overheadFee,
        delivered: undefined,
      });

      toast.success({
        title: "Quote generated",
        description:
          "Quote terms have been generated and you've advanced to the Quote stage.",
      });
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error({
        title: "Unable to generate quote",
        description:
          error instanceof Error ? error.message : "Unexpected error.",
      });
    } finally {
      setIsGeneratingQuote(false);
    }
  }, [canModify, hasRoles, watchedItems, isDirty, saveWbsItems, projectId, toast, router, roles]);

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
          onClick={handleRegenerate}
          disabled={
            isRegenerating ||
            isGeneratingQuote ||
            isAutoSaving ||
            !hasRoles
          }
        >
          {isRegenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Regenerating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Regenerate with Copilot
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="default"
          className="inline-flex items-center gap-2"
          onClick={handleGenerateQuoteAndAdvance}
          disabled={
            isRegenerating ||
            isGeneratingQuote ||
            isAutoSaving ||
            !hasRoles ||
            watchedItems.filter((item) => item.task.trim() || item.hours > 0)
              .length === 0
          }
        >
          {isGeneratingQuote ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating quote…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Quote & Advance
            </>
          )}
        </Button>
        {isAutoSaving && (
          <span className="text-sm text-muted-foreground self-center">
            Auto-saving...
          </span>
        )}
      </>
    );
  }, [canEdit, isRegenerating, isGeneratingQuote, isAutoSaving, hasRoles, watchedItems, handleRegenerate, handleGenerateQuoteAndAdvance]);

  return (
    <div className="flex flex-col gap-4">
      {!hasRoles && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No delivery roles are configured. Ask Copilot to add roles before editing the WBS.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {fields.map((field, index) => {
            const currentRoleId =
              watchedItems[index]?.roleId ?? fallbackRoleId;
            const selectedRole = roles.find(
              (role) => role.id === currentRoleId,
            );
            return (
              <div
                key={field.id}
                className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-[2fr_1fr_1fr_auto]"
              >
                <div className="space-y-1">
                  <label className="text-sm font-medium">Task</label>
                  <Input
                    {...register(`items.${index}.task` as const)}
                    placeholder="Describe the work"
                    disabled={!canModify}
                  />
                  {errors.items?.[index]?.task && (
                    <p className="text-sm text-destructive">
                      {errors.items?.[index]?.task?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Role</label>
                  <input
                    type="hidden"
                    {...register(`items.${index}.roleId` as const)}
                  />
                  <Select
                    value={currentRoleId || undefined}
                    onValueChange={(value) =>
                      setValue(`items.${index}.roleId`, value, {
                        shouldDirty: true,
                      })
                    }
                    disabled={!canModify}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.items?.[index]?.roleId && (
                    <p className="text-sm text-destructive">
                      {errors.items?.[index]?.roleId?.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {selectedRole
                      ? `Rate: $${selectedRole.rate.toFixed(2)}/hr`
                      : "Select a role from the catalog."}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Hours</label>
                  <Input
                    type="number"
                    step="0.5"
                    {...register(`items.${index}.hours` as const, {
                      valueAsNumber: true,
                    })}
                    disabled={!canModify}
                  />
                  {errors.items?.[index]?.hours && (
                    <p className="text-sm text-destructive">
                      {errors.items?.[index]?.hours?.message}
                    </p>
                  )}
                </div>
                {canModify && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              className="inline-flex items-center gap-2"
              onClick={() =>
                append({
                  task: "",
                  roleId: fallbackRoleId,
                  role: "",
                  hours: 0,
                  id: undefined,
                })
              }
              disabled={!canModify}
            >
              <Plus className="h-4 w-4" />
              Add row
            </Button>
          </div>
        )}
        <p className="text-sm font-semibold">
          Total hours: <span className="font-normal">{totalHours || 0}</span>
        </p>
      </div>
      {!canEdit && null}
    </div>
  );
}


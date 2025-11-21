"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listPoliciesAction } from "../actions";

interface PolicyRule {
  id: string;
  description: string;
}

interface PolicyOverrideSelectorProps {
  onExclusionsChange: (excludedIds: string[]) => void;
}

export function PolicyOverrideSelector({ onExclusionsChange }: PolicyOverrideSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadPolicies() {
      try {
        const data = await listPoliciesAction();
        setPolicies(data);
      } catch (error) {
        console.error("Failed to load policies:", error);
      } finally {
        setLoading(false);
      }
    }
    loadPolicies();
  }, []);

  const handleToggle = (id: string, checked: boolean) => {
    const next = new Set(excludedIds);
    if (checked) {
      next.delete(id); // Checked means included, so remove from exclusion
    } else {
      next.add(id); // Unchecked means excluded
    }
    setExcludedIds(next);
    onExclusionsChange(Array.from(next));
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading policies...</div>;
  }

  if (policies.length === 0) {
    return null; // No policies to override
  }

  return (
    <div className="border rounded-md">
      <Button
        variant="ghost"
        type="button"
        className="w-full flex justify-between items-center p-4 h-auto hover:bg-transparent"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col items-start text-left">
          <span className="font-medium">Policy Overrides</span>
          <span className="text-xs text-muted-foreground font-normal">
            {excludedIds.size === 0 
              ? "All policies active" 
              : `${excludedIds.size} policy rule${excludedIds.size === 1 ? '' : 's'} excluded`}
          </span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {isOpen && (
        <div className="px-4 pb-4 border-t pt-4 bg-muted/5">
            <p className="text-xs text-muted-foreground mb-3">
                Uncheck any policies you want to ignore for this generation.
            </p>
          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-3">
              {policies.map((policy) => (
                <div key={policy.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={`policy-${policy.id}`}
                    checked={!excludedIds.has(policy.id)}
                    onCheckedChange={(checked) => handleToggle(policy.id, checked as boolean)}
                  />
                  <Label
                    htmlFor={`policy-${policy.id}`}
                    className="text-sm leading-tight font-normal cursor-pointer"
                  >
                    {policy.description}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}


"use client";

import { createAgreementAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useContractGeneration } from "../contract-generation-context";
import { toast } from "sonner";
import { EstimatePicker } from "../components/estimate-picker";
import { PolicyOverrideSelector } from "../components/policy-override-selector";

export default function NewAgreementPage() {
  const router = useRouter();
  const { startGeneration } = useContractGeneration();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [type, setType] = useState("MSA");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [excludedPolicyIds, setExcludedPolicyIds] = useState<string[]>([]);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    const notes = formData.get("notes") as string;
    const counterparty = formData.get("counterparty") as string;
    
    // Ensure type is correct
    const finalType = (formData.get("type") as string) || type;
    
    const payload = {
        type: finalType as "MSA" | "SOW",
        counterparty,
        projectId: selectedProjectId || undefined
    };
    
    // 1. Create agreement (fast)
    const result = await createAgreementAction(payload);
    
    if (result.success && result.agreementId) {
      // 2. Start generation (background/toast)
      // We pass excludedPolicyIds as the third argument now
      startGeneration(result.agreementId, notes, excludedPolicyIds);
      
      // 3. Navigate immediately
      router.push(`/contracts/${result.agreementId}`);
    } else {
      setIsSubmitting(false);
      toast.error(result.error || "Failed to create agreement");
      console.error(result.error);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>New Agreement</CardTitle>
          <CardDescription>
            Start a new contract draft. You can link it to an estimate later if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="type">Agreement Type</Label>
              <Select name="type" required value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MSA">Master Services Agreement (MSA)</SelectItem>
                  <SelectItem value="SOW">Statement of Work (SOW)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="counterparty">Counterparty Name</Label>
              <Input 
                id="counterparty" 
                name="counterparty" 
                placeholder="e.g. Acme Corp" 
                required 
              />
            </div>

            {type === "SOW" && (
                <div className="space-y-2">
                <Label htmlFor="projectId">Link to Project (Optional)</Label>
                <EstimatePicker 
                    selectedProjectId={selectedProjectId}
                    onSelect={setSelectedProjectId}
                />
                <input type="hidden" name="projectId" value={selectedProjectId || ""} />
                <p className="text-xs text-muted-foreground">
                    Linking a project allows the AI to pull scope and estimate details into the contract.
                </p>
                </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Instructions</Label>
              <Textarea 
                id="notes" 
                name="notes" 
                placeholder="Add any specific instructions for the AI (e.g., 'Include a non-compete clause', 'Use the special payment terms')..." 
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                These notes will be used along with our standard policies and sample agreements to generate the initial draft.
              </p>
            </div>

            <div className="space-y-2">
              <PolicyOverrideSelector onExclusionsChange={setExcludedPolicyIds} />
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Draft
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

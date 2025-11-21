"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link as LinkIcon, Loader2 } from "lucide-react";
import { EstimatePicker } from "../components/estimate-picker";
import { linkEstimateAction } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useContractGeneration } from "../contract-generation-context";

function LinkEstimateDialogContent({ agreementId, setOpen }: { agreementId: string, setOpen: (open: boolean) => void }) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const router = useRouter();
  const { startGeneration } = useContractGeneration();

  async function handleLink() {
    if (!selectedProjectId) return;
    
    setIsLinking(true);
    
    // 1. Link the estimate
    const linkResult = await linkEstimateAction(agreementId, selectedProjectId);
    
    if (linkResult.success) {
      toast.success("Estimate linked successfully");
      
      // 2. Trigger regeneration via context (handles toast & state)
      startGeneration(agreementId, "Incorporating linked estimate details", undefined, {
        runAutoReview: true,
      });
      
      setOpen(false);
      router.refresh();
      router.push(`/contracts/${agreementId}?view=review`);
    } else {
      toast.error("Failed to link estimate");
    }
    
    setIsLinking(false);
  }

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Link Estimate</DialogTitle>
        <DialogDescription>
          Select an estimate to link to this SOW. This will trigger a new version generation incorporating the estimate details.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <EstimatePicker 
          selectedProjectId={selectedProjectId}
          onSelect={setSelectedProjectId}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setOpen(false)} disabled={isLinking}>
          Cancel
        </Button>
        <Button onClick={handleLink} disabled={!selectedProjectId || isLinking}>
          {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Link & Regenerate
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function LinkEstimateDialog({ agreementId }: { agreementId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LinkIcon className="mr-2 h-4 w-4" />
          Link Estimate
        </Button>
      </DialogTrigger>
      <LinkEstimateDialogContent agreementId={agreementId} setOpen={setOpen} />
    </Dialog>
  );
}


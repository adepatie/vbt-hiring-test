import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import ReviewInterface from "./review-interface";

export default function StandaloneReviewPage() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/contracts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Review Incoming Agreement</h1>
            <p className="text-muted-foreground">
              Upload or paste a client agreement to review it against our governance policies.
            </p>
          </div>
        </div>

        <ReviewInterface />
      </div>
    </div>
  );
}

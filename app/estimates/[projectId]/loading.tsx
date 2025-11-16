import { Skeleton } from "@/components/ui/skeleton";

export default function EstimateDetailLoading() {
  return (
    <div className="container max-w-6xl py-10 md:py-16 space-y-6">
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-[420px] rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}



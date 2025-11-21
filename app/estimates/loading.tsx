import { Skeleton } from "@/components/ui/skeleton";

export default function EstimatesLoading() {
  return (
    <div className="container py-10 md:py-16 space-y-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}



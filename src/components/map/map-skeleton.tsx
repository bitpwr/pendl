import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MapSkeleton({ height }: { height: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-8" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Skeleton style={{ height }} className="rounded-b-lg" />
      </CardContent>
    </Card>
  );
}

import { Badge } from "@/components/ui/badge";
import { RouteType, routeTypeColor } from "@/types/gtfs";
import { cn } from "@/lib/utils";
import { Bus, Train, TramFront, Ship } from "lucide-react";

interface RouteBadgeProps {
  shortName: string;
  routeType: RouteType;
  size?: "sm" | "md" | "lg";
}

export function RouteBadge({
  shortName,
  routeType,
  size = "md",
}: RouteBadgeProps) {
  const sizeClasses = {
    sm: "text-xs min-w-9 px-1.5 py-0.5 gap-1",
    md: "text-sm min-w-12 px-1.5 py-1 gap-1.5",
    lg: "text-base min-w-14 px-2 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const bgColor = routeTypeColor(routeType, parseInt(shortName));

  return (
    <Badge
      className={cn(
        "inline-flex items-center justify-center rounded-md font-bold tracking-wide",
        sizeClasses[size],
      )}
      style={{
        backgroundColor: bgColor,
        color: "#FFFFFF",
      }}
    >
      {routeType === RouteType.Tram && (
        <TramFront className={iconSizes[size]} />
      )}
      {(routeType === RouteType.Metro || routeType === RouteType.Train) && (
        <Train className={iconSizes[size]} />
      )}
      {routeType === RouteType.Ferry && <Ship className={iconSizes[size]} />}
      {(routeType === RouteType.Bus || routeType === RouteType.Taxi) && (
        <Bus className={iconSizes[size]} />
      )}
      <span>{shortName}</span>
    </Badge>
  );
}

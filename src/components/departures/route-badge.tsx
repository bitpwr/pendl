import { Badge } from "@/components/ui/badge";
import { RouteType, routeTypeColor } from "@/types/gtfs";
import { cn } from "@/lib/utils";
import { Bus, Train, TramFront, Ship } from "lucide-react";

interface RouteBadgeProps {
  shortName: string;
  routeType: RouteType;
  size?: "sm" | "md" | "lg";
}

function getRouteIcon(routeType: RouteType) {
  switch (routeType) {
    case RouteType.Tram:
      return TramFront;
    case RouteType.Metro:
    case RouteType.Train:
      return Train;
    case RouteType.Ferry:
      return Ship;
    case RouteType.Bus:
    case RouteType.Taxi:
    default:
      return Bus;
  }
}

export function RouteBadge({
  shortName,
  routeType,
  size = "md",
}: RouteBadgeProps) {
  const Icon = getRouteIcon(routeType);

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const { bg: bgColor, text: txtColor } = routeTypeColor(routeType);

  return (
    <Badge
      className={cn(
        "inline-flex items-center font-semibold",
        sizeClasses[size],
      )}
      style={{
        backgroundColor: bgColor,
        color: txtColor,
      }}
    >
      <Icon className={iconSizes[size]} />
      <span>{shortName}</span>
    </Badge>
  );
}

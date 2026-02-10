"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, MapPin } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import type { AreaSearchResult } from "@/types/api";
import { cn } from "@/lib/utils";
import { routeTypeName, toRouteType } from "@/types/gtfs";
import { RouteBadge } from "../departures/route-badge";

interface AreaSearchResultsProps {
  results: AreaSearchResult[];
  isLoading?: boolean;
}

export function AreaSearchResults({
  results,
  isLoading,
}: AreaSearchResultsProps) {
  const { isFavorite, toggleFavorite } = useFavorites();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-5 w-48 rounded bg-muted" />
              <div className="mt-2 h-4 w-24 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <MapPin className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>Inga områden hittades</p>
          <p className="text-sm mt-1">Prova ett annat sökord</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((area) => (
        <Card
          key={area.areaId}
          className="group transition-colors hover:bg-accent/50 py-0"
        >
          <CardContent className="p-0">
            <div className="flex items-center">
              <Link href={`/area/${area.areaId}`} className="flex-1 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{area.areaName}</h3>
                    {area.distance !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        {area.distance < 1000
                          ? `${Math.round(area.distance)} m`
                          : `${(area.distance / 1000).toFixed(1)} km`}
                      </p>
                    )}
                  </div>
                </div>
                {area.routeTypes && area.routeTypes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {area.routeTypes.map((type) => (
                      <RouteBadge
                        key={type}
                        shortName={routeTypeName(toRouteType(type))}
                        routeType={toRouteType(type)}
                        size="sm"
                      />
                    ))}
                  </div>
                )}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="mr-2"
                onClick={() => toggleFavorite(area.areaId, area.areaName)}
                title={
                  isFavorite(area.areaId)
                    ? "Ta bort favorit"
                    : "Lägg till favorit"
                }
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    isFavorite(area.areaId)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground",
                  )}
                />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, MapPin } from 'lucide-react';
import { useFavorites } from '@/hooks/use-favorites';
import type { StopSearchResult } from '@/types/api';
import { cn } from '@/lib/utils';

interface SearchResultsProps {
  results: StopSearchResult[];
  isLoading?: boolean;
}

export function SearchResults({ results, isLoading }: SearchResultsProps) {
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
          <p>Inga hållplatser hittades</p>
          <p className="text-sm mt-1">Prova ett annat sökord</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((stop) => (
        <Card key={stop.stopId} className="group transition-colors hover:bg-accent/50">
          <CardContent className="p-0">
            <div className="flex items-center">
              <Link
                href={`/stop/${stop.stopId}`}
                className="flex-1 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{stop.stopName}</h3>
                    {stop.stopCode && (
                      <p className="text-sm text-muted-foreground">
                        Hållplatsnummer: {stop.stopCode}
                      </p>
                    )}
                    {stop.distance !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        {stop.distance < 1000
                          ? `${Math.round(stop.distance)} m`
                          : `${(stop.distance / 1000).toFixed(1)} km`}
                      </p>
                    )}
                  </div>
                </div>
                {stop.routes && stop.routes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {stop.routes.slice(0, 5).map((route) => (
                      <Badge
                        key={route.routeId}
                        variant="secondary"
                        className="text-xs"
                        style={{
                          backgroundColor: route.routeColor
                            ? `#${route.routeColor}`
                            : undefined,
                          color: route.routeColor ? '#fff' : undefined,
                        }}
                      >
                        {route.routeShortName}
                      </Badge>
                    ))}
                    {stop.routes.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{stop.routes.length - 5}
                      </Badge>
                    )}
                  </div>
                )}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="mr-2"
                onClick={() => toggleFavorite(stop.stopId, stop.stopName)}
                title={isFavorite(stop.stopId) ? 'Ta bort favorit' : 'Lägg till favorit'}
              >
                <Star
                  className={cn(
                    'h-4 w-4',
                    isFavorite(stop.stopId)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground'
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

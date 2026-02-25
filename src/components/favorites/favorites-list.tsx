"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ChevronRight, Trash2 } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";

export function FavoritesList() {
  const { favorites, removeFavorite } = useFavorites();

  if (favorites.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <Star className="mx-auto h-10 w-10 mb-3 opacity-40" />
          <p className="text-base font-medium text-foreground">
            Du har inga sparade favoriter
          </p>
          <p className="text-sm mt-1.5">
            Tryck på stjärnan vid en hållplats för att spara den
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {favorites.map((favorite) => (
        <Card
          key={favorite.areaId}
          className="group py-0 transition-colors hover:bg-muted/60"
        >
          <CardContent className="p-0">
            <div className="flex items-center">
              <Link
                href={`/area/${favorite.areaId}`}
                className="flex flex-1 items-center justify-between rounded-lg py-3 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-3">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{favorite.areaName}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="mr-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeFavorite(favorite.areaId)}
                title="Ta bort favorit"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function FavoritesSection() {
  const { favorites } = useFavorites();

  if (favorites.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          Favoriter
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {favorites.slice(0, 5).map((favorite) => (
            <Link
              key={favorite.areaId}
              href={`/area/${favorite.areaId}`}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{favorite.areaName}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
          {favorites.length > 5 && (
            <Link
              href="/favorites"
              className="block text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Visa alla ({favorites.length})
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

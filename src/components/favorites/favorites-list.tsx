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
        <CardContent className="p-6 text-center text-muted-foreground">
          <Star className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>Du har inga sparade favoriter</p>
          <p className="text-sm mt-1">
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
          key={favorite.stopId}
          className="group transition-colors hover:bg-accent/50"
        >
          <CardContent className="p-0">
            <div className="flex items-center">
              <Link
                href={`/stop/${favorite.stopId}`}
                className="flex flex-1 items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{favorite.stopName}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="mr-2 text-muted-foreground hover:text-destructive"
                onClick={() => removeFavorite(favorite.stopId)}
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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          Favoriter
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {favorites.slice(0, 3).map((favorite) => (
            <Link
              key={favorite.stopId}
              href={`/stop/${favorite.stopId}`}
              className="flex items-center justify-between rounded-md p-2 text-sm transition-colors hover:bg-accent"
            >
              <span>{favorite.stopName}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
          {favorites.length > 3 && (
            <Link
              href="/favoriter"
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

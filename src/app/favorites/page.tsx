"use client";

import { FavoritesList } from "@/components/favorites/favorites-list";
import { useEffect } from "react";

export default function FavoritesPage() {
  useEffect(() => {
    document.title = "Favoriter | Pendl";
  }, []);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Favoriter</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Dina sparade hållplatser för snabb åtkomst
          </p>
        </div>
        <FavoritesList />
      </section>
    </div>
  );
}

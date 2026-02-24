import { FavoritesList } from "@/components/favorites/favorites-list";

export default function FavoriterPage() {
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

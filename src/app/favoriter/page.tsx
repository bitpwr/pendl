import { FavoritesList } from '@/components/favorites/favorites-list';

export default function FavoriterPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold mb-4">Favoriter</h1>
        <p className="text-muted-foreground mb-6">
          Dina sparade hållplatser för snabb åtkomst
        </p>
        <FavoritesList />
      </section>
    </div>
  );
}

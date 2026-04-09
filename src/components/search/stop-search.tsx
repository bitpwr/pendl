"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Loader2, X } from "lucide-react";

interface StopSearchProps {
  onSearch: (query: string) => void;
  onNearby: () => void;
  isLoading?: boolean;
  isLocating?: boolean;
  initialValue?: string;
}

export function StopSearch({
  onSearch,
  onNearby,
  isLoading,
  isLocating,
  initialValue = "",
}: StopSearchProps) {
  const [query, setQuery] = useState(initialValue);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        onSearch(query.trim());
      }
    },
    [query, onSearch],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      // Debounced search on typing
      if (value.trim().length >= 2) {
        onSearch(value.trim());
      }
    },
    [onSearch],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    onSearch("");
  }, [onSearch]);

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Sök station eller hållplats..."
          value={query}
          onChange={handleInputChange}
          className="h-11 pl-10 pr-10 text-base bg-card dark:bg-card"
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Rensa"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          isLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11"
        onClick={onNearby}
        disabled={isLocating}
        title="Hitta hållplatser nära mig"
      >
        {isLocating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MapPin className="h-4 w-4" />
        )}
      </Button>
    </form>
  );
}

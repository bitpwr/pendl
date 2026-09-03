"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Search, Star, Info, X } from "lucide-react";
import { useAgency } from "@/hooks/use-agency";
import { cn } from "@/lib/utils";

const itemClass =
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function NavMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const { agencyId, setAgency, agencies } = useAgency();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const navItem = (href: string, label: string, Icon: typeof Search) => {
    const isActive = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        role="menuitem"
        aria-current={isActive ? "page" : undefined}
        onClick={() => setOpen(false)}
        className={cn(
          itemClass,
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Stäng meny" : "Öppna meny"}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="header-menu"
        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div
          id="header-menu"
          role="menu"
          aria-label="Meny"
          className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border/60 bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-1"
        >
          {navItem("/", "Sök", Search)}
          {navItem("/favorites", "Favoriter", Star)}

          <div role="separator" className="my-1 h-px bg-border/60" />

          <div role="group" aria-label="Trafikområde">
            <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Trafikområde
            </p>
            {agencies.map((a) => {
              const isSelected = a.id === agencyId;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setAgency(a.id);
                    setOpen(false);
                  }}
                  className={cn(
                    itemClass,
                    isSelected ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                      isSelected ? "border-primary" : "border-input",
                    )}
                  >
                    {isSelected && (
                      <span className="size-2 rounded-full bg-primary" />
                    )}
                  </span>
                  {a.longName}
                </button>
              );
            })}
          </div>

          <div role="separator" className="my-1 h-px bg-border/60" />

          {navItem("/about", "Om", Info)}
        </div>
      )}
    </div>
  );
}

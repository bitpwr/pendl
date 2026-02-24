import Link from "next/link";
import { Train, Map } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/90 backdrop-blur-lg supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-14 max-w-3xl items-center px-5">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold tracking-tight text-foreground"
        >
          <Train className="h-5 w-5" />
          <span className="text-lg">Pendl</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sök
          </Link>
          <Link
            href="/favoriter"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Favoriter
          </Link>
          <Link
            href="/map"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Map className="h-4 w-4" />
            Karta
          </Link>
        </nav>
      </div>
    </header>
  );
}

import Link from 'next/link';
import { Train } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Train className="h-5 w-5 text-primary" />
          <span className="text-lg">Pendl</span>
        </Link>
        <nav className="ml-auto flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Sök
          </Link>
          <Link
            href="/favoriter"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Favoriter
          </Link>
        </nav>
      </div>
    </header>
  );
}

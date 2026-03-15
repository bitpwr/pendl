export function Footer() {
  return (
    <footer className="w-full h-12 shrink-0 border-t border-border/50">
      <div className="mx-auto flex h-full max-w-3xl items-center justify-center px-5">
        <a
          href="https://hsolutions.se"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="font-mono text-xs">&lt;/&gt;</span>
          <span>hsolutions</span>
        </a>
      </div>
    </footer>
  );
}

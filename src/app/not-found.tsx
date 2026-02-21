import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-3xl font-bold tracking-tight">Sidan hittades inte</h1>
      <p className="text-muted-foreground">
        Sidan du försöker nå finns inte eller har flyttats.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/">Till startsidan</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/map">Öppna kartan</Link>
        </Button>
      </div>
    </div>
  );
}

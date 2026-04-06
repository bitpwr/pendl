import { NextResponse } from "next/server";
import { INCLUDED_AGENCIES } from "@/lib/config/agencies";

export async function GET() {
  const agencies = INCLUDED_AGENCIES.map((a) => ({
    id: a.id,
    name: a.name,
    tag: a.tag,
  }));
  return NextResponse.json({ agencies });
}

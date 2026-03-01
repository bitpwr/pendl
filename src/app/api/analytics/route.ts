import { NextRequest, NextResponse } from "next/server";
import { trackPageLoad } from "@/lib/analytics/influx";

interface AnalyticsPayload {
  key?: string;
  value?: string;
}

// always return 200 to avoid any issues with analytics requests
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as AnalyticsPayload;

    if (!payload.key || payload.value === undefined) {
      console.warn("Analytics key or value missing", payload);
      return NextResponse.json({ ok: true });
    }

    if (
      payload.key !== "area" &&
      payload.key !== "trip" &&
      payload.key !== "map"
    ) {
      console.warn("Invalid analytics key:", payload.key);
      return NextResponse.json({ ok: true });
    }

    console.info("[analytics]", {
      key: payload.key,
      value: payload.value,
    });

    trackPageLoad(payload.key, payload.value);
  } catch (error) {
    console.error("Error logging analytics:", error);
  }

  return NextResponse.json({ ok: true });
}

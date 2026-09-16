import { NextResponse } from "next/server";
import { FRONTEND_VERSION } from "@/lib/version";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({
    service: "frontend",
    version: FRONTEND_VERSION,
  });
}

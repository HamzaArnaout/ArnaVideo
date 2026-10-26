import { NextResponse } from "next/server";
import { estimateGeneration } from "@/lib/pricing";
import { readSettings } from "@/lib/settings";
import type { Resolution } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    model?: string;
    resolution?: Resolution;
    count?: number;
    durationSeconds?: number;
    extending?: boolean;
  };

  if (!body.model || !body.resolution || !body.count) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const settings = readSettings();
  const estimate = estimateGeneration({
    modelId: body.model,
    resolution: body.resolution,
    count: body.count,
    apiBalanceUsd: settings.apiBalanceUsd,
    durationSeconds: body.durationSeconds,
    extending: body.extending,
  });

  return NextResponse.json(estimate);
}

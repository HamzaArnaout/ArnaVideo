import { NextResponse } from "next/server";
import { readSettings, settingsPublicView, writeSettings } from "@/lib/settings";
import type { Resolution } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ settings: settingsPublicView() });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    outputDir?: string;
    videoOutputDir?: string;
    billingUrl?: string;
    apiBalanceUsd?: number | string;
    defaultModelId?: string;
    defaultAspectRatio?: string;
    defaultResolution?: Resolution;
  };

  const patch: Parameters<typeof writeSettings>[0] = {};

  if (typeof body.outputDir === "string" && body.outputDir.trim()) {
    patch.outputDir = body.outputDir.trim();
  }
  if (typeof body.videoOutputDir === "string" && body.videoOutputDir.trim()) {
    patch.videoOutputDir = body.videoOutputDir.trim();
  }
  if (typeof body.billingUrl === "string" && body.billingUrl.trim()) {
    patch.billingUrl = body.billingUrl.trim();
  }
  if (body.apiBalanceUsd !== undefined && body.apiBalanceUsd !== "") {
    const value = Number(body.apiBalanceUsd);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: "API balance must be a positive number" }, { status: 400 });
    }
    patch.apiBalanceUsd = value;
  }
  if (typeof body.defaultModelId === "string") {
    patch.defaultModelId = body.defaultModelId;
  }
  if (typeof body.defaultAspectRatio === "string") {
    patch.defaultAspectRatio = body.defaultAspectRatio;
  }
  if (body.defaultResolution) {
    patch.defaultResolution = body.defaultResolution;
  }

  const settings = writeSettings(patch);
  return NextResponse.json({ settings: settingsPublicView(settings) });
}

export async function POST() {
  const settings = readSettings();
  writeSettings({});
  return NextResponse.json({ settings: settingsPublicView(settings) });
}

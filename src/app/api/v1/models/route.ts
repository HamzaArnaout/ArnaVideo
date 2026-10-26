import { NextResponse } from "next/server";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/lib/models";

export async function GET() {
  return NextResponse.json({
    models: IMAGE_MODELS,
    videoModels: VIDEO_MODELS,
  });
}

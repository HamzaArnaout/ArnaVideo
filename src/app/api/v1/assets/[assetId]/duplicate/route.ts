import { NextResponse } from "next/server";
import { duplicateAsset } from "@/lib/store";

type Params = { params: Promise<{ assetId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { assetId } = await params;
  const asset = duplicateAsset(assetId);
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ asset });
}

import { NextResponse } from "next/server";
import { toggleFavorite } from "@/lib/store";

type Params = { params: Promise<{ assetId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { assetId } = await params;
  const asset = toggleFavorite(assetId);
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ asset });
}

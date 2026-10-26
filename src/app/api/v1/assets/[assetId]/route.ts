import { NextResponse } from "next/server";
import { deleteAsset } from "@/lib/store";

type Params = { params: Promise<{ assetId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { assetId } = await params;
  const removed = deleteAsset(assetId);
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

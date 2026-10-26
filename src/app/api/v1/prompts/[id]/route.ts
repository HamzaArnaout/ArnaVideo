import { NextResponse } from "next/server";
import { deletePrompt, updatePrompt } from "@/lib/prompts";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as {
    title?: string;
    body?: string;
    negativePrompt?: string;
  };
  const prompt = updatePrompt(id, body);
  if (!prompt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ prompt });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!deletePrompt(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

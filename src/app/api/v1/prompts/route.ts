import { NextResponse } from "next/server";
import { createPrompt, listPrompts } from "@/lib/prompts";

export async function GET() {
  return NextResponse.json({ prompts: listPrompts() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    body?: string;
    negativePrompt?: string;
  };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Prompt text is required" }, { status: 400 });
  }
  const prompt = createPrompt({
    title: body.title?.trim() || "Untitled prompt",
    body: body.body,
    negativePrompt: body.negativePrompt,
  });
  return NextResponse.json({ prompt }, { status: 201 });
}

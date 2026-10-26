import { NextResponse } from "next/server";
import { getJob } from "@/lib/store";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ job });
}

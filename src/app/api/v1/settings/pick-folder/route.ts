import { NextResponse } from "next/server";
import { pickFolderNative } from "@/lib/pick-folder";
import { readSettings } from "@/lib/settings";

export async function POST() {
  try {
    const settings = readSettings();
    const path = await pickFolderNative(settings.outputDir);
    if (!path) {
      return NextResponse.json({ cancelled: true });
    }
    return NextResponse.json({ path, cancelled: false });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to open folder picker",
      },
      { status: 500 },
    );
  }
}

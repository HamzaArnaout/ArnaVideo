import { NextResponse } from "next/server";
import {
  getProject,
  getWorkspace,
  listGalleryAssets,
} from "@/lib/store";
import { settingsPublicView } from "@/lib/settings";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter");
  const kindParam = searchParams.get("kind");
  const kind =
    kindParam === "video" || kindParam === "image" ? kindParam : undefined;

  const assets = listGalleryAssets({
    favorites: filter === "favorites",
    kind,
  });

  return NextResponse.json({
    workspace: getWorkspace(),
    project: getProject(),
    assets,
    settings: settingsPublicView(),
  });
}

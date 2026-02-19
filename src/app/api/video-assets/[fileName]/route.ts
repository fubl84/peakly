import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Readable } from "stream";

export const runtime = "nodejs";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".ogv": "video/ogg",
};

function resolveMimeType(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

function isSafeFileName(fileName: string) {
  if (!fileName) {
    return false;
  }

  if (fileName !== path.basename(fileName)) {
    return false;
  }

  if (fileName.includes("..")) {
    return false;
  }

  return /^[a-zA-Z0-9._-]+$/.test(fileName);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await params;

  if (!isSafeFileName(fileName)) {
    return NextResponse.json(
      { error: "Datei nicht gefunden." },
      { status: 404 },
    );
  }

  const absoluteFilePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    "videos",
    fileName,
  );

  try {
    const fileStat = await stat(absoluteFilePath);

    if (!fileStat.isFile()) {
      return NextResponse.json(
        { error: "Datei nicht gefunden." },
        { status: 404 },
      );
    }

    const stream = createReadStream(absoluteFilePath);
    const body = Readable.toWeb(stream) as ReadableStream;

    return new NextResponse(body, {
      headers: {
        "content-type": resolveMimeType(fileName),
        "content-length": String(fileStat.size),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Datei nicht gefunden." },
      { status: 404 },
    );
  }
}

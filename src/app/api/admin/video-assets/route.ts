import { requireAdminApi } from "@/lib/api-access";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;

function sanitizeBaseName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-_\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
}

function extractFileExtension(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (!ext) {
    return ".mp4";
  }

  return ext;
}

export async function GET(request: Request) {
  const accessError = await requireAdminApi();
  if (accessError) {
    return accessError;
  }

  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";

  const assets = await prisma.videoAsset.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { originalFileName: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ createdAt: "desc" }],
    take: 40,
    select: {
      id: true,
      name: true,
      originalFileName: true,
      url: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  const accessError = await requireAdminApi();
  if (accessError) {
    return accessError;
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const overrideName = String(formData.get("name") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Bitte eine Videodatei auswählen." },
      { status: 400 },
    );
  }

  if (!file.type.startsWith("video/")) {
    return NextResponse.json(
      { error: "Nur Videodateien sind erlaubt." },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_VIDEO_SIZE_BYTES) {
    return NextResponse.json(
      {
        error:
          "Ungültige Dateigröße. Erlaubt sind bis zu 200 MB pro Video.",
      },
      { status: 400 },
    );
  }

  const extension = extractFileExtension(file.name);
  const safeBase =
    sanitizeBaseName(overrideName || file.name.replace(/\.[^.]+$/, "")) ||
    "video";
  const fileName = `${safeBase}-${randomUUID()}${extension}`;
  const absoluteTargetDir = path.join(process.cwd(), "public", "uploads", "videos");
  const absoluteTargetFile = path.join(absoluteTargetDir, fileName);
  const publicUrl = `/uploads/videos/${fileName}`;

  await mkdir(absoluteTargetDir, { recursive: true });
  const bytes = await file.arrayBuffer();
  await writeFile(absoluteTargetFile, Buffer.from(bytes));

  const asset = await prisma.videoAsset.create({
    data: {
      name: overrideName || file.name.replace(/\.[^.]+$/, ""),
      originalFileName: file.name,
      url: publicUrl,
      mimeType: file.type,
      sizeBytes: file.size,
    },
    select: {
      id: true,
      name: true,
      originalFileName: true,
      url: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ asset }, { status: 201 });
}

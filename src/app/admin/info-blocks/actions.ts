"use server";

import { assertAdminAction } from "@/lib/admin-action";
import {
  assertWeekRange,
  getRequiredInt,
  getRequiredString,
} from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { InfoCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";

function parseCategory(value: string) {
  if (
    value === "FOOD" ||
    value === "WORKOUT" ||
    value === "MOTIVATION" ||
    value === "GENERAL"
  ) {
    return value as InfoCategory;
  }

  throw new Error("Ungültige Kategorie.");
}

function parseWeekRange(formData: FormData, isFullPath: boolean) {
  if (isFullPath) {
    return { weekStart: null, weekEnd: null };
  }

  const weekStart = getRequiredInt(formData, "weekStart");
  const weekEnd = getRequiredInt(formData, "weekEnd");
  assertWeekRange(weekStart, weekEnd);

  return { weekStart, weekEnd };
}

function getContentMarkdown(formData: FormData) {
  const markdown = String(formData.get("contentMarkdown") ?? "").trim();
  if (markdown) {
    return markdown;
  }

  return getRequiredString(formData, "contentHtml");
}

function getOptionalVideoUrl(formData: FormData) {
  const value = String(formData.get("videoUrl") ?? "").trim();
  return value.length > 0 ? value : null;
}

export async function createInfoBlock(formData: FormData) {
  await assertAdminAction();

  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const contentHtml = getContentMarkdown(formData);
  const videoUrl = getOptionalVideoUrl(formData);
  const isFullPath = getRequiredString(formData, "scope") === "FULL_PATH";
  const category = parseCategory(getRequiredString(formData, "category"));
  const { weekStart, weekEnd } = parseWeekRange(formData, isFullPath);

  await prisma.infoBlock.create({
    data: {
      name,
      internalName,
      contentHtml,
      videoUrl,
      isFullPath,
      weekStart,
      weekEnd,
      category,
    },
  });

  revalidatePath("/admin/info-blocks");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/planner/training");
  revalidatePath("/dashboard/planner/nutrition");
}

export async function updateInfoBlock(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const contentHtml = getContentMarkdown(formData);
  const videoUrl = getOptionalVideoUrl(formData);
  const isFullPath = getRequiredString(formData, "scope") === "FULL_PATH";
  const category = parseCategory(getRequiredString(formData, "category"));
  const { weekStart, weekEnd } = parseWeekRange(formData, isFullPath);

  await prisma.infoBlock.update({
    where: { id },
    data: {
      name,
      internalName,
      contentHtml,
      videoUrl,
      isFullPath,
      weekStart,
      weekEnd,
      category,
    },
  });

  revalidatePath("/admin/info-blocks");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/planner/training");
  revalidatePath("/dashboard/planner/nutrition");
}

export async function deleteInfoBlock(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  await prisma.infoBlock.delete({ where: { id } });

  revalidatePath("/admin/info-blocks");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/planner/training");
  revalidatePath("/dashboard/planner/nutrition");
}

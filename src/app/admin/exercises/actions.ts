"use server";

import { assertAdminAction } from "@/lib/admin-action";
import { getOptionalString, getRequiredString } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { ExerciseMetricType, ExerciseSideMode } from "@prisma/client";
import { revalidatePath } from "next/cache";

function parseMetricType(value: string) {
  if (value === "REPETITIONS" || value === "DURATION") {
    return value as ExerciseMetricType;
  }

  throw new Error("Ungültiger Modus für Übung.");
}

function parseSideMode(value: string) {
  if (value === "NONE" || value === "ONE_SIDE" || value === "BOTH_SIDES") {
    return value as ExerciseSideMode;
  }

  throw new Error("Ungültiger Seitenmodus.");
}

export async function createExercise(formData: FormData) {
  await assertAdminAction();

  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const description = getOptionalString(formData, "description");
  const metricType = parseMetricType(getRequiredString(formData, "metricType"));
  const sideMode = parseSideMode(getRequiredString(formData, "sideMode"));
  const mediaUrl = getOptionalString(formData, "mediaUrl");
  const optionId = getOptionalString(formData, "optionId");

  await prisma.exercise.create({
    data: {
      name,
      internalName,
      description,
      metricType,
      sideMode,
      mediaUrl,
      optionId,
    },
  });

  revalidatePath("/admin/exercises");
}

export async function updateExercise(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const description = getOptionalString(formData, "description");
  const metricType = parseMetricType(getRequiredString(formData, "metricType"));
  const sideMode = parseSideMode(getRequiredString(formData, "sideMode"));
  const mediaUrl = getOptionalString(formData, "mediaUrl");
  const optionId = getOptionalString(formData, "optionId");

  await prisma.exercise.update({
    where: { id },
    data: {
      name,
      internalName,
      description,
      metricType,
      sideMode,
      mediaUrl,
      optionId,
    },
  });

  revalidatePath("/admin/exercises");
}

export async function deleteExercise(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  await prisma.exercise.delete({ where: { id } });

  revalidatePath("/admin/exercises");
}

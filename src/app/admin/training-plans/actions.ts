"use server";

import { assertAdminAction } from "@/lib/admin-action";
import {
  assertWeekRange,
  getOptionalNumber,
  getOptionalString,
  getRequiredInt,
  getRequiredString,
} from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type TrainingExerciseBlockKind = "WARMUP" | "TRAINING_SET" | "COOLDOWN";

function isValidBlock(value: string) {
  return value === "WARMUP" || value === "COOLDOWN" || /^SET-\d+$/.test(value);
}

function parseBlock(
  explicitBlockRaw: string | null,
  blockKind: TrainingExerciseBlockKind,
  setIndexRaw: string | null,
) {
  const explicitBlock = String(explicitBlockRaw ?? "").trim();
  if (explicitBlock) {
    if (!isValidBlock(explicitBlock)) {
      throw new Error("Ungültiger Block.");
    }
    return explicitBlock;
  }

  if (blockKind === "WARMUP") return "WARMUP";
  if (blockKind === "COOLDOWN") return "COOLDOWN";

  const setIndex = Number(String(setIndexRaw ?? "").trim());
  if (!Number.isInteger(setIndex) || setIndex < 1) {
    throw new Error(
      "Für Trainings-Sets ist eine gültige Set-Nummer erforderlich.",
    );
  }

  return `SET-${setIndex}`;
}

async function assertMetricInput(
  exerciseId: string,
  reps: number | null,
  durationSec: number | null,
) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { id: true },
  });

  if (!exercise) {
    throw new Error("Übung nicht gefunden.");
  }

  if (reps !== null && reps < 1) {
    throw new Error("Wiederholungen müssen größer oder gleich 1 sein.");
  }

  if (durationSec !== null && durationSec < 1) {
    throw new Error("Dauer in Sekunden muss größer oder gleich 1 sein.");
  }

  const hasReps = reps !== null;
  const hasDuration = durationSec !== null;

  if (hasReps === hasDuration) {
    throw new Error(
      "Bitte genau eine Metrik angeben: entweder Wiederholungen oder Dauer in Sekunden.",
    );
  }
}

function getNextSetBlock(existingBlocks: string[]) {
  const indexes = existingBlocks
    .map((block) => {
      const match = /^SET-(\d+)$/.exec(block);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value !== null);

  const nextIndex = indexes.length === 0 ? 1 : Math.max(...indexes) + 1;
  return `SET-${nextIndex}`;
}

export async function createTrainingPlan(formData: FormData) {
  await assertAdminAction();

  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const description = getOptionalString(formData, "description");
  const videoUrl = getOptionalString(formData, "videoUrl");
  const weekStart = getRequiredInt(formData, "weekStart");
  const weekEnd = getRequiredInt(formData, "weekEnd");
  const variantOptionId = getOptionalString(formData, "variantOptionId");

  assertWeekRange(weekStart, weekEnd);

  await prisma.trainingPlan.create({
    data: {
      name,
      internalName,
      description,
      videoUrl,
      weekStart,
      weekEnd,
      variantOptionId,
    },
  });

  revalidatePath("/admin/training-plans");
}

export async function reorderTrainingPlanExercises(formData: FormData) {
  await assertAdminAction();

  const trainingPlanId = getRequiredString(formData, "trainingPlanId");
  const block = getRequiredString(formData, "block");
  const orderedExerciseIdsRaw = getRequiredString(
    formData,
    "orderedExerciseIds",
  );

  if (!isValidBlock(block)) {
    throw new Error("Ungültiger Block.");
  }

  let orderedExerciseIds: string[];
  try {
    const parsed: unknown = JSON.parse(orderedExerciseIdsRaw);
    if (
      !Array.isArray(parsed) ||
      parsed.some((value) => typeof value !== "string")
    ) {
      throw new Error();
    }
    orderedExerciseIds = parsed;
  } catch {
    throw new Error("Ungültige Reihenfolge übergeben.");
  }

  const existingEntries = await prisma.trainingPlanExercise.findMany({
    where: { trainingPlanId, block },
    select: { id: true },
    orderBy: { position: "asc" },
  });

  if (existingEntries.length !== orderedExerciseIds.length) {
    throw new Error("Die Reihenfolge passt nicht zum aktuellen Block.");
  }

  const existingIds = new Set(
    existingEntries.map((entry: { id: string }) => entry.id),
  );
  if (orderedExerciseIds.some((id) => !existingIds.has(id))) {
    throw new Error("Die Reihenfolge enthält ungültige Übungen.");
  }

  await prisma.$transaction(
    orderedExerciseIds.map((id, index) =>
      prisma.trainingPlanExercise.update({
        where: { id },
        data: { position: index + 1 },
      }),
    ),
  );

  revalidatePath("/admin/training-plans");
}

export async function updateTrainingPlan(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const description = getOptionalString(formData, "description");
  const videoUrl = getOptionalString(formData, "videoUrl");
  const weekStart = getRequiredInt(formData, "weekStart");
  const weekEnd = getRequiredInt(formData, "weekEnd");
  const variantOptionId = getOptionalString(formData, "variantOptionId");

  assertWeekRange(weekStart, weekEnd);

  await prisma.trainingPlan.update({
    where: { id },
    data: {
      name,
      internalName,
      description,
      videoUrl,
      weekStart,
      weekEnd,
      variantOptionId,
    },
  });

  revalidatePath("/admin/training-plans");
}

export async function deleteTrainingPlan(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  await prisma.trainingPlan.delete({ where: { id } });

  revalidatePath("/admin/training-plans");
}

export async function createTrainingPlanExercise(formData: FormData) {
  await assertAdminAction();

  const trainingPlanId = getRequiredString(formData, "trainingPlanId");
  const exerciseId = getRequiredString(formData, "exerciseId");
  const blockKind = getRequiredString(
    formData,
    "blockKind",
  ) as TrainingExerciseBlockKind;
  const position = getRequiredInt(formData, "position");
  const reps = getOptionalNumber(formData, "reps");
  const durationSec = getOptionalNumber(formData, "durationSec");
  const restSec = getOptionalNumber(formData, "restSec");
  const info = getOptionalString(formData, "info");
  const block = parseBlock(
    formData.get("block")?.toString() ?? null,
    blockKind,
    formData.get("setIndex")?.toString() ?? null,
  );

  if (position < 1) {
    throw new Error("Position muss größer oder gleich 1 sein.");
  }

  await assertMetricInput(exerciseId, reps, durationSec);

  await prisma.trainingPlanExercise.create({
    data: {
      trainingPlanId,
      exerciseId,
      block,
      position,
      reps,
      durationSec,
      restSec,
      info,
    },
  });

  revalidatePath("/admin/training-plans");
}

export async function updateTrainingPlanExercise(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const exerciseId = getRequiredString(formData, "exerciseId");
  const blockKind = getRequiredString(
    formData,
    "blockKind",
  ) as TrainingExerciseBlockKind;
  const position = getRequiredInt(formData, "position");
  const reps = getOptionalNumber(formData, "reps");
  const durationSec = getOptionalNumber(formData, "durationSec");
  const restSec = getOptionalNumber(formData, "restSec");
  const info = getOptionalString(formData, "info");
  const block = parseBlock(
    formData.get("block")?.toString() ?? null,
    blockKind,
    formData.get("setIndex")?.toString() ?? null,
  );

  if (position < 1) {
    throw new Error("Position muss größer oder gleich 1 sein.");
  }

  await assertMetricInput(exerciseId, reps, durationSec);

  await prisma.trainingPlanExercise.update({
    where: { id },
    data: {
      exerciseId,
      block,
      position,
      reps,
      durationSec,
      restSec,
      info,
    },
  });

  revalidatePath("/admin/training-plans");
}

export async function deleteTrainingPlanExercise(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  await prisma.trainingPlanExercise.delete({ where: { id } });

  revalidatePath("/admin/training-plans");
}

export async function duplicateTrainingSet(formData: FormData) {
  await assertAdminAction();

  const trainingPlanId = getRequiredString(formData, "trainingPlanId");
  const sourceBlock = getRequiredString(formData, "sourceBlock");

  if (!sourceBlock.startsWith("SET-")) {
    throw new Error("Nur Trainings-Sets können dupliziert werden.");
  }

  const sourceEntries = await prisma.trainingPlanExercise.findMany({
    where: { trainingPlanId, block: sourceBlock },
    orderBy: { position: "asc" },
  });

  if (sourceEntries.length === 0) {
    throw new Error("Das gewählte Set enthält keine Übungen.");
  }

  const existingBlocks = await prisma.trainingPlanExercise.findMany({
    where: { trainingPlanId },
    select: { block: true },
    distinct: ["block"],
  });

  const targetBlock = getNextSetBlock(
    existingBlocks.map((entry) => entry.block),
  );

  await prisma.$transaction(
    sourceEntries.map((entry) =>
      prisma.trainingPlanExercise.create({
        data: {
          trainingPlanId,
          exerciseId: entry.exerciseId,
          block: targetBlock,
          position: entry.position,
          reps: entry.reps,
          durationSec: entry.durationSec,
          restSec: entry.restSec,
          info: entry.info,
        },
      }),
    ),
  );

  revalidatePath("/admin/training-plans");
}

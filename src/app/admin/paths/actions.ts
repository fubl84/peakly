"use server";

import { assertAdminAction } from "@/lib/admin-action";
import {
  assertWeekRange,
  getOptionalString,
  getRequiredString,
} from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { PathAssignmentKind } from "@prisma/client";
import { revalidatePath } from "next/cache";

type SessionLike = {
  user?: {
    id?: string;
    role?: string;
    email?: string | null;
  };
} | null;

function parseAssignmentKind(value: string) {
  if (value === "TRAINING" || value === "NUTRITION" || value === "INFO") {
    return value as PathAssignmentKind;
  }

  throw new Error("Ungültiger Assignment-Typ.");
}

async function assertContentRefExists(
  kind: PathAssignmentKind,
  contentRefId: string,
) {
  if (kind === "TRAINING") {
    const found = await prisma.trainingPlan.findUnique({
      where: { id: contentRefId },
      select: { id: true },
    });
    if (!found) throw new Error("Trainingsplan nicht gefunden.");
    return;
  }

  if (kind === "NUTRITION") {
    const found = await prisma.nutritionPlan.findUnique({
      where: { id: contentRefId },
      select: { id: true },
    });
    if (!found) throw new Error("Ernährungsplan nicht gefunden.");
    return;
  }

  const found = await prisma.infoBlock.findUnique({
    where: { id: contentRefId },
    select: { id: true },
  });
  if (!found) throw new Error("Info-Block nicht gefunden.");
}

async function getAssignmentDefaults(
  kind: PathAssignmentKind,
  contentRefId: string,
) {
  if (kind === "TRAINING") {
    const trainingPlan = await prisma.trainingPlan.findUnique({
      where: { id: contentRefId },
      select: { weekStart: true, weekEnd: true, variantOptionId: true },
    });

    if (!trainingPlan) {
      throw new Error("Trainingsplan nicht gefunden.");
    }

    return {
      weekStart: trainingPlan.weekStart,
      weekEnd: trainingPlan.weekEnd,
      variantOptionId: trainingPlan.variantOptionId,
    };
  }

  if (kind === "NUTRITION") {
    const nutritionPlan = await prisma.nutritionPlan.findUnique({
      where: { id: contentRefId },
      select: { weekStart: true, weekEnd: true, variantOptionId: true },
    });

    if (!nutritionPlan) {
      throw new Error("Ernährungsplan nicht gefunden.");
    }

    return {
      weekStart: nutritionPlan.weekStart,
      weekEnd: nutritionPlan.weekEnd,
      variantOptionId: nutritionPlan.variantOptionId,
    };
  }

  const infoBlock = await prisma.infoBlock.findUnique({
    where: { id: contentRefId },
    select: { weekStart: true, weekEnd: true, isFullPath: true },
  });

  if (!infoBlock) {
    throw new Error("Info-Block nicht gefunden.");
  }

  if (
    !infoBlock.isFullPath &&
    (infoBlock.weekStart === null || infoBlock.weekEnd === null)
  ) {
    throw new Error("Info-Block hat keinen gültigen Wochenbereich.");
  }

  return {
    weekStart: infoBlock.weekStart ?? 1,
    weekEnd: infoBlock.weekEnd ?? 1,
    variantOptionId: null,
    isFullPath: infoBlock.isFullPath,
  };
}

async function assertNoOverlapConflict(args: {
  pathId: string;
  kind: PathAssignmentKind;
  weekStart: number;
  weekEnd: number;
  variantOptionId: string | null;
  contentRefId: string;
  ignoreId?: string;
}) {
  const duplicate = await prisma.pathAssignment.findFirst({
    where: {
      pathId: args.pathId,
      kind: args.kind,
      weekStart: args.weekStart,
      weekEnd: args.weekEnd,
      contentRefId: args.contentRefId,
      variantOptionId: args.variantOptionId,
      ...(args.ignoreId ? { NOT: { id: args.ignoreId } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error("Konflikt: Diese Content-Zuweisung existiert bereits.");
  }
}

async function getPathMaxWeekEnd(pathId: string) {
  const maxWeek = await prisma.pathAssignment.aggregate({
    where: { pathId },
    _max: { weekEnd: true },
  });

  return maxWeek._max.weekEnd ?? 1;
}

export async function createPath(
  formData: FormData,
  args?: { session?: SessionLike; skipRevalidate?: boolean },
) {
  await assertAdminAction(args);

  const name = getRequiredString(formData, "name");
  const description = getOptionalString(formData, "description");
  const imageUrl = getOptionalString(formData, "imageUrl");

  const trainingPlanIds = formData
    .getAll("trainingPlanIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const nutritionPlanIds = formData
    .getAll("nutritionPlanIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const infoBlockIds = formData
    .getAll("infoBlockIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  await prisma.$transaction(async (tx) => {
    const path = await tx.path.create({
      data: { name, description, imageUrl },
    });

    const queuedAssignments: Array<{
      kind: PathAssignmentKind;
      contentRefId: string;
      weekStart: number;
      weekEnd: number;
      variantOptionId: string | null;
      isFullPath?: boolean;
    }> = [];

    for (const trainingPlanId of trainingPlanIds) {
      const defaults = await getAssignmentDefaults("TRAINING", trainingPlanId);
      queuedAssignments.push({
        kind: "TRAINING",
        contentRefId: trainingPlanId,
        weekStart: defaults.weekStart,
        weekEnd: defaults.weekEnd,
        variantOptionId: defaults.variantOptionId,
      });
    }

    for (const nutritionPlanId of nutritionPlanIds) {
      const defaults = await getAssignmentDefaults(
        "NUTRITION",
        nutritionPlanId,
      );
      queuedAssignments.push({
        kind: "NUTRITION",
        contentRefId: nutritionPlanId,
        weekStart: defaults.weekStart,
        weekEnd: defaults.weekEnd,
        variantOptionId: defaults.variantOptionId,
      });
    }

    for (const infoBlockId of infoBlockIds) {
      const defaults = await getAssignmentDefaults("INFO", infoBlockId);
      queuedAssignments.push({
        kind: "INFO",
        contentRefId: infoBlockId,
        weekStart: defaults.weekStart,
        weekEnd: defaults.weekEnd,
        variantOptionId: null,
        isFullPath: defaults.isFullPath,
      });
    }

    const maxWeekEnd = queuedAssignments.reduce(
      (max, assignment) => Math.max(max, assignment.weekEnd),
      1,
    );

    for (const assignment of queuedAssignments) {
      const weekStart = assignment.isFullPath ? 1 : assignment.weekStart;
      const weekEnd = assignment.isFullPath ? maxWeekEnd : assignment.weekEnd;

      await assertNoOverlapConflict({
        pathId: path.id,
        kind: assignment.kind,
        weekStart,
        weekEnd,
        contentRefId: assignment.contentRefId,
        variantOptionId: assignment.variantOptionId,
      });

      await tx.pathAssignment.create({
        data: {
          pathId: path.id,
          kind: assignment.kind,
          contentRefId: assignment.contentRefId,
          weekStart,
          weekEnd,
          variantOptionId: assignment.variantOptionId,
        },
      });
    }
  });

  if (!args?.skipRevalidate) {
    revalidatePath("/admin/paths");
  }
}

export async function updatePath(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const name = getRequiredString(formData, "name");
  const description = getOptionalString(formData, "description");
  const imageUrl = getOptionalString(formData, "imageUrl");

  await prisma.path.update({
    where: { id },
    data: { name, description, imageUrl },
  });

  revalidatePath("/admin/paths");
}

export async function deletePath(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  await prisma.path.delete({ where: { id } });

  revalidatePath("/admin/paths");
}

export async function createPathAssignment(formData: FormData) {
  await assertAdminAction();

  const pathId = getRequiredString(formData, "pathId");
  const kind = parseAssignmentKind(getRequiredString(formData, "kind"));

  const trainingRefId = getOptionalString(formData, "contentRefTrainingId");
  const nutritionRefId = getOptionalString(formData, "contentRefNutritionId");
  const infoRefId = getOptionalString(formData, "contentRefInfoId");

  const contentRefId =
    kind === "TRAINING"
      ? trainingRefId
      : kind === "NUTRITION"
        ? nutritionRefId
        : infoRefId;

  if (!contentRefId) {
    throw new Error(
      "Bitte den passenden Inhalt für den gewählten Typ auswählen.",
    );
  }

  const defaults = await getAssignmentDefaults(kind, contentRefId);
  const pathMaxWeekEnd = await getPathMaxWeekEnd(pathId);
  const weekStart = defaults.isFullPath ? 1 : defaults.weekStart;
  const weekEnd = defaults.isFullPath ? pathMaxWeekEnd : defaults.weekEnd;
  const variantOptionId = defaults.variantOptionId;

  assertWeekRange(weekStart, weekEnd);
  await assertContentRefExists(kind, contentRefId);
  await assertNoOverlapConflict({
    pathId,
    kind,
    weekStart,
    weekEnd,
    contentRefId,
    variantOptionId,
  });

  await prisma.pathAssignment.create({
    data: { pathId, kind, weekStart, weekEnd, contentRefId, variantOptionId },
  });

  revalidatePath("/admin/paths");
}

export async function deletePathAssignment(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  await prisma.pathAssignment.delete({ where: { id } });

  revalidatePath("/admin/paths");
}

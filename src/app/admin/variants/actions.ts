"use server";

import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin-action";
import { getOptionalString, getRequiredString } from "@/lib/forms";
import { OptionKind, VariantKind } from "@prisma/client";
import { revalidatePath } from "next/cache";

function parseVariantKind(value: string) {
  if (value === "TRAINING" || value === "NUTRITION") {
    return value as VariantKind;
  }

  throw new Error("Ungültiger Variantentyp.");
}

function parseOptionKind(value: string) {
  if (value === "TRAINING" || value === "NUTRITION" || value === "INFO") {
    return value as OptionKind;
  }

  throw new Error("Ungültiger Optionstyp.");
}

export async function createVariantType(formData: FormData) {
  await assertAdminAction();

  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const description = getOptionalString(formData, "description");
  const kind = parseVariantKind(getRequiredString(formData, "kind"));

  await prisma.variant.create({
    data: { name, internalName, description, kind },
  });

  revalidatePath("/admin/variants");
}

export async function updateVariantType(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const description = getOptionalString(formData, "description");
  const kind = parseVariantKind(getRequiredString(formData, "kind"));

  await prisma.variant.update({
    where: { id },
    data: { name, internalName, description, kind },
  });

  revalidatePath("/admin/variants");
}

export async function deleteVariantType(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  await prisma.variant.delete({ where: { id } });

  revalidatePath("/admin/variants");
}

export async function createVariantOption(formData: FormData) {
  await assertAdminAction();

  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const description = getOptionalString(formData, "description");
  const kind = parseOptionKind(getRequiredString(formData, "kind"));

  await prisma.option.create({
    data: { name, internalName, description, kind },
  });

  revalidatePath("/admin/variants");
}

export async function updateVariantOption(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const description = getOptionalString(formData, "description");
  const kind = parseOptionKind(getRequiredString(formData, "kind"));

  await prisma.option.update({
    where: { id },
    data: { name, internalName, description, kind },
  });

  revalidatePath("/admin/variants");
}

export async function deleteVariantOption(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  await prisma.option.delete({ where: { id } });

  revalidatePath("/admin/variants");
}

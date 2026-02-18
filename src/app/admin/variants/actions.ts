"use server";

import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin-action";
import { getOptionalString, getRequiredString } from "@/lib/forms";
import { VariantKind } from "@prisma/client";
import { revalidatePath } from "next/cache";

function parseVariantKind(value: string) {
  if (value === "TRAINING" || value === "NUTRITION") {
    return value as VariantKind;
  }

  throw new Error("Ungültiger Variantentyp.");
}

export async function createVariantType(formData: FormData) {
  await assertAdminAction();

  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(formData, "internalName").toLowerCase();
  const description = getOptionalString(formData, "description");
  const kind = parseVariantKind(getRequiredString(formData, "kind"));

  await prisma.variantType.create({
    data: { name, internalName, description, kind },
  });

  revalidatePath("/admin/variants");
}

export async function updateVariantType(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(formData, "internalName").toLowerCase();
  const description = getOptionalString(formData, "description");
  const kind = parseVariantKind(getRequiredString(formData, "kind"));

  await prisma.variantType.update({
    where: { id },
    data: { name, internalName, description, kind },
  });

  revalidatePath("/admin/variants");
}

export async function deleteVariantType(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  await prisma.variantType.delete({ where: { id } });

  revalidatePath("/admin/variants");
}

export async function createVariantOption(formData: FormData) {
  await assertAdminAction();

  const variantTypeId = getRequiredString(formData, "variantTypeId");
  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(formData, "internalName").toLowerCase();
  const description = getOptionalString(formData, "description");

  await prisma.variantOption.create({
    data: { variantTypeId, name, internalName, description },
  });

  revalidatePath("/admin/variants");
}

export async function updateVariantOption(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const variantTypeId = getRequiredString(formData, "variantTypeId");
  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(formData, "internalName").toLowerCase();
  const description = getOptionalString(formData, "description");

  await prisma.variantOption.update({
    where: { id },
    data: { variantTypeId, name, internalName, description },
  });

  revalidatePath("/admin/variants");
}

export async function deleteVariantOption(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  await prisma.variantOption.delete({ where: { id } });

  revalidatePath("/admin/variants");
}

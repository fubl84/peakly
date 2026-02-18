"use server";

import { requireAuth } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function markInfoBlockAsReadAction(infoBlockId: string) {
  const session = await requireAuth();
  const normalizedInfoBlockId = String(infoBlockId).trim();

  if (!normalizedInfoBlockId) {
    throw new Error("Ungültiger Info-Block.");
  }

  await prisma.userInfoBlockRead.upsert({
    where: {
      userId_infoBlockId: {
        userId: session.user.id,
        infoBlockId: normalizedInfoBlockId,
      },
    },
    create: {
      userId: session.user.id,
      infoBlockId: normalizedInfoBlockId,
    },
    update: {
      readAt: new Date(),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/planner/training");
  revalidatePath("/dashboard/planner/nutrition");
}

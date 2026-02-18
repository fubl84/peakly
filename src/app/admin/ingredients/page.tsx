import { prisma } from "@/lib/prisma";
import { IngredientsClient } from "./ingredients-client";

export default async function AdminIngredientsPage() {
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
  });

  return <IngredientsClient ingredients={ingredients} />;
}

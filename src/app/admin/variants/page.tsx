import { VariantsClient } from "./variants-client";
import { prisma } from "@/lib/prisma";

export default async function AdminVariantsPage() {
  const [types, options] = await Promise.all([
    prisma.variantType.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      include: { variantOptions: { orderBy: { name: "asc" } } },
    }),
    prisma.variantOption.findMany({
      orderBy: [{ variantTypeId: "asc" }, { name: "asc" }],
      include: { variantType: true },
    }),
  ]);

  return <VariantsClient types={types} options={options} />;
}

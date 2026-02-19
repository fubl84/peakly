import { VariantsClient } from "./variants-client";
import { prisma } from "@/lib/prisma";

export default async function AdminVariantsPage() {
  const [variants, options] = await Promise.all([
    prisma.variant.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    prisma.option.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
  ]);

  return <VariantsClient variants={variants} options={options} />;
}

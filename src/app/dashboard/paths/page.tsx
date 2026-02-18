import { requireAuth } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PathsCatalogClient } from "./paths-catalog-client";

type AssignmentKind = "TRAINING" | "NUTRITION" | "INFO";

type CatalogAssignment = {
  id: string;
  kind: AssignmentKind;
  weekStart: number;
  weekEnd: number;
  contentRefId: string;
  variantOptionId: string | null;
  variantOption: { id: string; name: string } | null;
};

type CatalogPathRecord = {
  id: string;
  name: string;
  assignments: CatalogAssignment[];
};
export default async function DashboardPathsPage() {
  await requireAuth();

  const paths = (await prisma.path.findMany({
    orderBy: { name: "asc" },
    include: {
      assignments: {
        orderBy: [{ kind: "asc" }, { weekStart: "asc" }],
        include: { variantOption: true },
      },
    },
  })) as CatalogPathRecord[];

  if (paths.length === 0) {
    return (
      <main className="dashboard-page">
        <h1 className="page-title">Pfadkatalog</h1>
        <p>Es sind noch keine Pfade verfügbar.</p>
        <Link className="back-link" href="/dashboard">
          Zurück zum Dashboard
        </Link>
      </main>
    );
  }

  const trainingPlanIds = paths
    .flatMap((path) => path.assignments)
    .filter((assignment: CatalogAssignment) => assignment.kind === "TRAINING")
    .map((assignment: CatalogAssignment) => assignment.contentRefId);
  const nutritionPlanIds = paths
    .flatMap((path) => path.assignments)
    .filter((assignment: CatalogAssignment) => assignment.kind === "NUTRITION")
    .map((assignment: CatalogAssignment) => assignment.contentRefId);
  const infoBlockIds = paths
    .flatMap((path) => path.assignments)
    .filter((assignment: CatalogAssignment) => assignment.kind === "INFO")
    .map((assignment: CatalogAssignment) => assignment.contentRefId);

  const [trainingPlans, nutritionPlans, infoBlocks] = await Promise.all([
    prisma.trainingPlan.findMany({
      where: { id: { in: trainingPlanIds } },
      select: { id: true, name: true },
    }),
    prisma.nutritionPlan.findMany({
      where: { id: { in: nutritionPlanIds } },
      select: { id: true, name: true },
    }),
    prisma.infoBlock.findMany({
      where: { id: { in: infoBlockIds } },
      select: { id: true, name: true },
    }),
  ]);

  const trainingPlanNameById = new Map<string, string>(
    trainingPlans.map((plan: { id: string; name: string }) => [
      plan.id,
      plan.name,
    ]),
  );
  const nutritionPlanNameById = new Map<string, string>(
    nutritionPlans.map((plan: { id: string; name: string }) => [
      plan.id,
      plan.name,
    ]),
  );
  const infoBlockNameById = new Map<string, string>(
    infoBlocks.map((block: { id: string; name: string }) => [
      block.id,
      block.name,
    ]),
  );

  function getContentName(kind: AssignmentKind, contentRefId: string): string {
    if (kind === "TRAINING") {
      return trainingPlanNameById.get(contentRefId) ?? contentRefId;
    }

    if (kind === "NUTRITION") {
      return nutritionPlanNameById.get(contentRefId) ?? contentRefId;
    }

    return infoBlockNameById.get(contentRefId) ?? contentRefId;
  }

  const catalogPaths = paths.map((path) => {
    const maxWeek = Math.max(
      path.assignments.reduce(
        (maxValue, assignment) => Math.max(maxValue, assignment.weekEnd),
        1,
      ),
      1,
    );
    const trainingCount = path.assignments.filter(
      (assignment) => assignment.kind === "TRAINING",
    ).length;
    const nutritionCount = path.assignments.filter(
      (assignment) => assignment.kind === "NUTRITION",
    ).length;
    const infoCount = path.assignments.filter(
      (assignment) => assignment.kind === "INFO",
    ).length;

    return {
      id: path.id,
      name: path.name,
      maxWeek,
      trainingCount,
      nutritionCount,
      infoCount,
      assignments: path.assignments.map((assignment) => ({
        id: assignment.id,
        kind: assignment.kind,
        weekStart: assignment.weekStart,
        weekEnd: assignment.weekEnd,
        contentName: getContentName(assignment.kind, assignment.contentRefId),
        variantName: assignment.variantOption?.name ?? null,
      })),
    };
  });

  return (
    <main className="dashboard-page">
      <h1 className="page-title">Pfadkatalog</h1>
      <Link className="back-link" href="/dashboard">
        Zurück zum Dashboard
      </Link>

      <PathsCatalogClient paths={catalogPaths} />
    </main>
  );
}

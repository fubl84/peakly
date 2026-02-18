import { requireAuth } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ExerciseLibraryClient } from "./exercise-library-client";

export default async function ExerciseLibraryPage() {
  await requireAuth();

  const exercises = await prisma.exercise.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      metricType: true,
      mediaUrl: true,
    },
  });

  return (
    <main className="dashboard-page">
      <h1 className="page-title">Übungsbibliothek</h1>
      <Link className="back-link" href="/dashboard">
        Zurück zum Dashboard
      </Link>

      <ExerciseLibraryClient exercises={exercises} />
    </main>
  );
}

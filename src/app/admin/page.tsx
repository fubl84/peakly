import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminPage() {
  const [variantCount, optionCount, exerciseCount, ingredientCount] =
    await Promise.all([
      prisma.variant.count(),
      prisma.option.count(),
      prisma.exercise.count(),
      prisma.ingredient.count(),
    ]);

  return (
    <main style={{ display: "grid", gap: "1rem" }}>
      <h1>Admin Übersicht</h1>
      <p>Wave 1 Basis-CRUD für Varianten, Übungen und Zutaten ist aktiv.</p>

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <article
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "0.75rem",
          }}
        >
          <h2>Varianten</h2>
          <p>Einträge: {variantCount}</p>
          <p>Optionen: {optionCount}</p>
          <Link href="/admin/variants">Verwalten</Link>
        </article>

        <article
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "0.75rem",
          }}
        >
          <h2>Übungen</h2>
          <p>Einträge: {exerciseCount}</p>
          <Link href="/admin/exercises">Verwalten</Link>
        </article>

        <article
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "0.75rem",
          }}
        >
          <h2>Zutaten</h2>
          <p>Einträge: {ingredientCount}</p>
          <Link href="/admin/ingredients">Verwalten</Link>
        </article>
      </div>
    </main>
  );
}

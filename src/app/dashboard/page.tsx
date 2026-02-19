import { requireAuth } from "@/lib/access";
import { getDashboardInsightsForUser } from "@/lib/dashboard-insights";
import { resolveUserInfoBlocksForWeek } from "@/lib/info-blocks";
import { prisma } from "@/lib/prisma";
import { resolveUserWeekBundle } from "@/lib/user-runtime";
import { DashboardInsightsPanel } from "./_components/dashboard-insights-panel";
import { InfoBlockFeed } from "./_components/info-block-feed";
import { createEnrollmentAction, upsertWeeklyCheckInAction } from "./actions";

const DAY_LABELS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

type ShoppingListProgressItem = {
  isChecked: boolean;
};

type WorkoutSessionSummary = {
  id: string;
  dayOfWeek: number;
  status: "ACTIVE" | "COMPLETED";
};

type TrainingWeekEntry = {
  dayOfWeek: number;
  isRestDay: boolean;
  trainingPlanId: string | null;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function greetingForHour(hour: number) {
  if (hour < 11) return "Guten Morgen";
  if (hour < 17) return "Schönen Tag";
  return "Guten Abend";
}

function dayIndexFromDate(date: Date) {
  return ((date.getDay() + 6) % 7) + 1;
}

export default async function DashboardPage() {
  const session = await requireAuth();
  const bundle = await resolveUserWeekBundle(session.user.id);

  const [paths, variants, userProfile] = await Promise.all([
    prisma.path.findMany({ orderBy: { name: "asc" } }),
    prisma.variant.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { displayName: true },
    }),
  ]);

  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const todayIndex = dayIndexFromDate(now);
  const todayLabel = DAY_LABELS[todayIndex - 1] ?? "Heute";

  const dashboardData = bundle
    ? await (async () => {
        const [shoppingListWeek, workoutSessionsWeek, trainingWeekEntries] =
          await Promise.all([
            prisma.userShoppingList.findUnique({
              where: {
                enrollmentId_week: {
                  enrollmentId: bundle.enrollment.id,
                  week: bundle.week,
                },
              },
              include: {
                items: {
                  select: { isChecked: true },
                },
              },
            }),
            prisma.userWorkoutSession.findMany({
              where: {
                enrollmentId: bundle.enrollment.id,
                week: bundle.week,
              },
              select: {
                id: true,
                dayOfWeek: true,
                status: true,
              },
            }),
            prisma.userTrainingCalendarEntry.findMany({
              where: {
                enrollmentId: bundle.enrollment.id,
                week: bundle.week,
              },
              select: {
                dayOfWeek: true,
                isRestDay: true,
                trainingPlanId: true,
              },
            }),
          ]);

        const checkedItems =
          shoppingListWeek?.items.filter(
            (item: ShoppingListProgressItem) => item.isChecked,
          ).length ?? 0;
        const totalItems = shoppingListWeek?.items.length ?? 0;
        const shoppingProgress = totalItems > 0 ? checkedItems / totalItems : 0;
        const completedSessions = workoutSessionsWeek.filter(
          (sessionEntry: WorkoutSessionSummary) =>
            sessionEntry.status === "COMPLETED",
        ).length;
        const plannedTrainingDays = trainingWeekEntries.filter(
          (entry: TrainingWeekEntry) =>
            Boolean(entry.trainingPlanId) && !entry.isRestDay,
        ).length;
        const pathProgress =
          bundle.maxWeek > 0 ? Math.min(bundle.week / bundle.maxWeek, 1) : 0;

        return {
          checkedItems,
          totalItems,
          shoppingProgress,
          completedSessions,
          plannedTrainingDays,
          pathProgress,
        };
      })()
    : null;

  const [infoBlocks, dashboardInsightsResult] = bundle
    ? await Promise.all([
        resolveUserInfoBlocksForWeek({
          prismaClient: prisma,
          userId: session.user.id,
          pathId: bundle.enrollment.pathId,
          week: bundle.week,
          selectedVariantIds: bundle.enrollment.selectedVariants.map(
            (entry) => entry.variantId,
          ),
          categories: ["GENERAL", "MOTIVATION"],
        }),
        (async () => {
          try {
            const insights = await getDashboardInsightsForUser({
              userId: session.user.id,
            });

            return {
              cards: insights.cards,
              checkInPrompt: insights.checkInPrompt,
              error: null,
            };
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Insights konnten nicht geladen werden.";

            return {
              cards: [],
              checkInPrompt: {
                shouldAskMondayPlan: false,
                shouldAskSundayRecap: false,
              },
              error: message,
            };
          }
        })(),
      ])
    : [
        [],
        {
          cards: [],
          checkInPrompt: {
            shouldAskMondayPlan: false,
            shouldAskSundayRecap: false,
          },
          error: null,
        },
      ];

  const motivationInfoBlocks = infoBlocks.filter(
    (block) => block.category === "MOTIVATION",
  );
  const generalInfoBlocks = infoBlocks.filter(
    (block) => block.category === "GENERAL",
  );
  const trainingVariants = variants.filter(
    (variant) => variant.kind === "TRAINING",
  );
  const nutritionVariants = variants.filter(
    (variant) => variant.kind === "NUTRITION",
  );

  return (
    <main className="dashboard-page">
      {motivationInfoBlocks.length > 0 ? (
        <InfoBlockFeed
          blocks={motivationInfoBlocks}
          variant="banner"
          title="Motivation"
        />
      ) : null}

      <section className="dashboard-hero card">
        <div className="dashboard-hero-copy">
          <p className="dashboard-kicker">{greeting}</p>
          <h1 className="page-title">
            {userProfile?.displayName?.trim() ||
              session.user.email?.split("@")[0] ||
              "Athlet"}
            , du machst Fortschritte.
          </h1>
          <p className="page-subtitle">
            Heute ist {todayLabel}. Wir machen immer weiter!
          </p>
          <p className="muted">
            Konto: <strong>{session.user.email}</strong> · Rolle:{" "}
            {session.user.role}
          </p>
        </div>
        <div className="motivation-panel">
          <p className="dashboard-kicker">Coach-System</p>
          <p>
            Vier AI Assistenten begleiten dich täglich: Fokus, Ziel-Feedback,
            Plan-Integration und Momentum.
          </p>
          <p className="muted">
            Automatisch gecacht. Bei Bedarf kannst du alle Insights manuell neu
            analysieren.
          </p>
        </div>
      </section>

      {bundle ? (
        <>
          <DashboardInsightsPanel
            initialCards={dashboardInsightsResult.cards}
            initialError={dashboardInsightsResult.error}
          />

          {(dashboardInsightsResult.checkInPrompt.shouldAskMondayPlan ||
            dashboardInsightsResult.checkInPrompt.shouldAskSundayRecap) && (
            <section className="card stack dashboard-checkin-panel">
              <h2 className="section-title">Wöchentlicher Check-In</h2>
              <p className="muted">
                Kurzer Input für den Coach-Kontext. Das macht deine Insights
                messbar persönlicher.
              </p>

              {dashboardInsightsResult.checkInPrompt.shouldAskMondayPlan ? (
                <form
                  action={upsertWeeklyCheckInAction}
                  className="dashboard-checkin-form"
                >
                  <input type="hidden" name="checkInType" value="MONDAY_PLAN" />
                  <h3>Montags-Plan</h3>
                  <div className="dashboard-checkin-grid">
                    <label className="field">
                      Energie (1-10)
                      <input
                        name="energyLevel"
                        type="number"
                        min={1}
                        max={10}
                      />
                    </label>
                    <label className="field">
                      Stress (1-10)
                      <input
                        name="stressLevel"
                        type="number"
                        min={1}
                        max={10}
                      />
                    </label>
                    <label className="field">
                      Schlafqualität (1-10)
                      <input
                        name="sleepQualityLevel"
                        type="number"
                        min={1}
                        max={10}
                      />
                    </label>
                    <label className="field">
                      Umsetzung (1-10)
                      <input
                        name="adherenceLevel"
                        type="number"
                        min={1}
                        max={10}
                      />
                    </label>
                  </div>
                  <label className="field">
                    Notiz zur Woche
                    <textarea
                      name="note"
                      rows={2}
                      placeholder="Was wird diese Woche schwierig? Was ist dein Fokus?"
                    />
                  </label>
                  <button type="submit">Montags-Check-In speichern</button>
                </form>
              ) : null}

              {dashboardInsightsResult.checkInPrompt.shouldAskSundayRecap ? (
                <form
                  action={upsertWeeklyCheckInAction}
                  className="dashboard-checkin-form"
                >
                  <input
                    type="hidden"
                    name="checkInType"
                    value="SUNDAY_RECAP"
                  />
                  <h3>Sonntags-Recap</h3>
                  <div className="dashboard-checkin-grid">
                    <label className="field">
                      Energie (1-10)
                      <input
                        name="energyLevel"
                        type="number"
                        min={1}
                        max={10}
                      />
                    </label>
                    <label className="field">
                      Stress (1-10)
                      <input
                        name="stressLevel"
                        type="number"
                        min={1}
                        max={10}
                      />
                    </label>
                    <label className="field">
                      Schlafqualität (1-10)
                      <input
                        name="sleepQualityLevel"
                        type="number"
                        min={1}
                        max={10}
                      />
                    </label>
                    <label className="field">
                      Umsetzung (1-10)
                      <input
                        name="adherenceLevel"
                        type="number"
                        min={1}
                        max={10}
                      />
                    </label>
                  </div>
                  <label className="field">
                    Wochen-Recap
                    <textarea
                      name="note"
                      rows={2}
                      placeholder="Was lief gut? Was möchtest du nächste Woche anders machen?"
                    />
                  </label>
                  <button type="submit">Sonntags-Recap speichern</button>
                </form>
              ) : null}
            </section>
          )}

          <section className="dashboard-stat-grid">
            <article className="dashboard-stat-card">
              <span className="dashboard-stat-label">Aktueller Pfad</span>
              <strong>{bundle.enrollment.path.name}</strong>
              <span className="muted">
                Woche {bundle.week} von {bundle.maxWeek}
              </span>
            </article>
            <article className="dashboard-stat-card">
              <span className="dashboard-stat-label">Pfad-Fortschritt</span>
              <strong>{formatPercent(dashboardData?.pathProgress ?? 0)}</strong>
              <div className="progress-track">
                <span
                  className="progress-fill"
                  style={{
                    width: formatPercent(dashboardData?.pathProgress ?? 0),
                  }}
                />
              </div>
            </article>
            <article className="dashboard-stat-card">
              <span className="dashboard-stat-label">Workout-Fortschritt</span>
              <strong>
                {dashboardData?.completedSessions ?? 0} /{" "}
                {dashboardData?.plannedTrainingDays ?? 0}
              </strong>
              <span className="muted">Abgeschlossene Sessions diese Woche</span>
            </article>
            <article className="dashboard-stat-card">
              <span className="dashboard-stat-label">Einkauf erledigt</span>
              <strong>
                {dashboardData?.checkedItems ?? 0} /{" "}
                {dashboardData?.totalItems ?? 0}
              </strong>
              <span className="muted">
                {formatPercent(dashboardData?.shoppingProgress ?? 0)} erledigt
              </span>
            </article>
          </section>

          <section className="dashboard-main-grid">
            {generalInfoBlocks.length > 0 ? (
              <InfoBlockFeed
                blocks={generalInfoBlocks}
                variant="card"
                title="Allgemeine Infos"
              />
            ) : null}
          </section>

          <section className="card stack">
            <h2 className="section-title">Wochenkontext</h2>
            {bundle.assignments.length === 0 ? (
              <p className="muted">
                Für diese Woche liegen noch keine Zuweisungen vor.
              </p>
            ) : (
              <div className="assignment-pill-list">
                {bundle.assignments.map((assignment) => (
                  <span key={assignment.id} className="assignment-pill">
                    {assignment.kind}
                  </span>
                ))}
              </div>
            )}
            <p className="muted">
              Startdatum:{" "}
              {bundle.enrollment.startDate.toLocaleDateString("de-DE")}
            </p>
          </section>
        </>
      ) : (
        <section className="card stack">
          <h2 className="section-title">Starte deinen persönlichen Plan</h2>
          <p className="muted">
            Du hast noch keine aktive Teilnahme. Wähle Pfad, Varianten und
            Startdatum – danach siehst du hier deinen täglichen Kompass.
          </p>

          <form action={createEnrollmentAction} className="form-grid">
            <label className="field">
              Pfad
              <select name="pathId" required defaultValue="">
                <option value="">Bitte auswählen</option>
                {paths.map((path) => (
                  <option key={path.id} value={path.id}>
                    {path.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Startdatum
              <input name="startDate" type="date" required />
            </label>

            {trainingVariants.length > 0 ? (
              <label className="field">
                Trainingsvariante
                <select name="variantKind:TRAINING" defaultValue="">
                  <option value="">Keine Auswahl</option>
                  {trainingVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {nutritionVariants.length > 0 ? (
              <label className="field">
                Ernährungsvariante
                <select name="variantKind:NUTRITION" defaultValue="">
                  <option value="">Keine Auswahl</option>
                  {nutritionVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <button type="submit">Teilnahme starten</button>
          </form>
        </section>
      )}
    </main>
  );
}

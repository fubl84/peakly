import { requireAuth } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  acceptPairInviteAction,
  createPairInviteAction,
} from "../shopping-list/actions";
import {
  changePasswordAction,
  clearGeminiApiKeyAction,
  updateUserSettingsAction,
} from "./actions";

type ActivePairLink = {
  initiatorId: string;
  inviteeId: string;
  initiator: { displayName: string | null; email: string };
  invitee: { displayName: string | null; email: string };
};

type PendingPairInvite = {
  id: string;
  pairKey: string;
  initiator: { displayName: string | null; email: string };
};

type CoachProfileSettings = {
  tone: "SUPPORTIVE" | "DIRECT" | "PERFORMANCE" | "ANALYTICAL";
  constraints: string | null;
  trainingPreferences: string | null;
  nutritionPreferences: string | null;
};

const prismaWithCoachProfile = prisma as unknown as {
  userCoachProfile: {
    findUnique: (args: unknown) => Promise<CoachProfileSettings | null>;
  };
};

function displayUserName(user: { displayName: string | null; email: string }) {
  return user.displayName ?? user.email;
}

export default async function SettingsPage() {
  const session = await requireAuth();

  const [userProfile, settings, coachProfile, activePairLink, pendingInvites] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { displayName: true },
      }),
      prisma.userSetting.findUnique({
        where: { userId: session.user.id },
      }),
      prismaWithCoachProfile.userCoachProfile.findUnique({
        where: { userId: session.user.id },
        select: {
          tone: true,
          constraints: true,
          trainingPreferences: true,
          nutritionPreferences: true,
        },
      }),
      prisma.userPairLink.findFirst({
        where: {
          status: "ACTIVE",
          OR: [
            { initiatorId: session.user.id },
            { inviteeId: session.user.id },
          ],
        },
        include: {
          initiator: {
            select: { displayName: true, email: true },
          },
          invitee: {
            select: { displayName: true, email: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      }) as Promise<ActivePairLink | null>,
      prisma.userPairLink.findMany({
        where: {
          status: "PENDING",
          inviteeId: session.user.id,
        },
        include: {
          initiator: {
            select: { displayName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }) as Promise<PendingPairInvite[]>,
    ]);

  const partnerLabel = activePairLink
    ? activePairLink.initiatorId === session.user.id
      ? displayUserName(activePairLink.invitee)
      : displayUserName(activePairLink.initiator)
    : null;

  return (
    <main className="dashboard-page">
      <h1 className="page-title">Profil & Einstellungen</h1>
      <Link className="back-link" href="/dashboard">
        Zurück zum Dashboard
      </Link>

      <section className="card stack">
        <h2 className="section-title">Profil</h2>
        <p className="muted">
          Diese Angaben helfen bei Planung, Progress-Schätzung und Motivation.
        </p>
        <form action={updateUserSettingsAction} className="form-grid">
          <label className="field">
            Name
            <input
              name="displayName"
              type="text"
              maxLength={80}
              defaultValue={userProfile?.displayName ?? ""}
              placeholder="Wie sollen wir dich nennen?"
            />
          </label>

          <label className="field">
            Aktuelles Gewicht (kg)
            <input
              name="currentWeightKg"
              type="number"
              min={1}
              max={500}
              step="0.1"
              defaultValue={settings?.currentWeightKg ?? ""}
            />
          </label>

          <label className="field">
            Größe (cm)
            <input
              name="heightCm"
              type="number"
              min={90}
              max={260}
              step="1"
              defaultValue={settings?.heightCm ?? ""}
            />
          </label>

          <label className="field">
            Alter
            <input
              name="age"
              type="number"
              min={12}
              max={120}
              step="1"
              defaultValue={settings?.age ?? ""}
            />
          </label>

          <label className="field">
            Geschlecht
            <select name="gender" defaultValue={settings?.gender ?? ""}>
              <option value="">Keine Angabe</option>
              <option value="female">Weiblich</option>
              <option value="male">Männlich</option>
              <option value="diverse">Divers</option>
            </select>
          </label>

          <label className="field">
            Aktivitätslevel
            <select
              name="activityLevel"
              defaultValue={settings?.activityLevel ?? ""}
            >
              <option value="">Keine Angabe</option>
              <option value="low">Niedrig</option>
              <option value="moderate">Mittel</option>
              <option value="high">Hoch</option>
              <option value="athlete">Sehr hoch</option>
            </select>
          </label>

          <label className="field">
            Coaching-Ton
            <select
              name="coachTone"
              defaultValue={coachProfile?.tone ?? "SUPPORTIVE"}
            >
              <option value="SUPPORTIVE">Supportiv</option>
              <option value="DIRECT">Direkt</option>
              <option value="PERFORMANCE">Leistungsorientiert</option>
              <option value="ANALYTICAL">Ruhig-analytisch</option>
            </select>
          </label>

          <label className="field">
            Coaching-Constraints
            <textarea
              name="coachConstraints"
              rows={2}
              defaultValue={coachProfile?.constraints ?? ""}
              placeholder="z. B. nur 30 Minuten Zeit am Abend, wenig Schlaf, Knie sensibel"
            />
          </label>

          <label className="field">
            Training-Präferenzen
            <textarea
              name="trainingPreferences"
              rows={2}
              defaultValue={coachProfile?.trainingPreferences ?? ""}
              placeholder="z. B. Ganzkörper statt Split, kurze Sessions, Fokus Technik"
            />
          </label>

          <label className="field">
            Ernährungs-Präferenzen
            <textarea
              name="nutritionPreferences"
              rows={2}
              defaultValue={coachProfile?.nutritionPreferences ?? ""}
              placeholder="z. B. meal prep, schnell, vegetarisch, wenig Snacks"
            />
          </label>

          <label className="field">
            Ziel über den Pfad
            <textarea
              name="pathGoal"
              rows={3}
              defaultValue={settings?.pathGoal ?? ""}
              placeholder="z. B. Fett reduzieren, stärker werden, Routine aufbauen"
            />
          </label>

          <label className="field">
            Gemini API Key
            <input
              name="geminiApiKey"
              type="password"
              defaultValue={settings?.geminiApiKey ?? ""}
              placeholder="AIza..."
            />
          </label>

          <div className="week-nav">
            <button type="submit">Profil speichern</button>
          </div>
        </form>

        <form action={clearGeminiApiKeyAction}>
          <button type="submit" className="training-secondary-button">
            Gespeicherten Gemini Key entfernen
          </button>
        </form>
      </section>

      <section className="card stack">
        <h2 className="section-title">Pairing</h2>
        {activePairLink ? (
          <p>
            Aktiv gepaart mit <strong>{partnerLabel}</strong>
          </p>
        ) : (
          <p className="muted">Aktuell keine aktive Pair-Verbindung.</p>
        )}

        <form action={createPairInviteAction} className="pair-invite-form">
          <input
            type="email"
            name="inviteeEmail"
            placeholder="E-Mail für Einladung"
            required
          />
          <button type="submit">Einladung senden</button>
        </form>

        {pendingInvites.length > 0 ? (
          <div className="stack">
            <h3>Offene Einladungen</h3>
            {pendingInvites.map((invite: PendingPairInvite) => (
              <form
                key={invite.id}
                action={acceptPairInviteAction}
                className="pair-accept-form"
              >
                <input type="hidden" name="pairKey" value={invite.pairKey} />
                <span>
                  Einladung von{" "}
                  <strong>{displayUserName(invite.initiator)}</strong>
                </span>
                <button type="submit">Annehmen</button>
              </form>
            ))}
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <h2 className="section-title">Passwort ändern</h2>
        <form action={changePasswordAction} className="form-grid">
          <label className="field">
            Aktuelles Passwort
            <input name="currentPassword" type="password" required />
          </label>
          <label className="field">
            Neues Passwort
            <input name="newPassword" type="password" minLength={8} required />
          </label>
          <label className="field">
            Neues Passwort bestätigen
            <input
              name="confirmPassword"
              type="password"
              minLength={8}
              required
            />
          </label>
          <button type="submit">Passwort aktualisieren</button>
        </form>
      </section>
    </main>
  );
}

"use client";

import { ExerciseVideoPreviewButton } from "@/app/dashboard/_components/exercise-video-preview-button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  advanceWorkoutStepAction,
  completeWorkoutSessionAction,
  retreatWorkoutStepAction,
} from "./actions";

type SessionExercise = {
  id: string;
  block: string;
  position: number;
  reps: number | null;
  durationSec: number | null;
  restSec: number | null;
  info: string | null;
  exercise: {
    name: string;
    metricType: string;
    mediaUrl: string | null;
  };
};

type WorkoutSessionClientProps = {
  sessionId: string;
  planName: string;
  planVideoUrl: string | null;
  dayLabel: string;
  currentStepIndex: number;
  steps: SessionExercise[];
  startMode?: "default" | "video";
};

function toYoutubeEmbed(url: string) {
  const trimmed = url.trim();
  const watchMatch = trimmed.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/i,
  );
  if (!watchMatch?.[1]) {
    return null;
  }

  return `https://www.youtube.com/embed/${watchMatch[1]}`;
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function describeExercise(step: SessionExercise) {
  if (step.exercise.metricType === "REPETITIONS" && step.reps) {
    return `${step.reps} Wdh.`;
  }

  if (step.exercise.metricType === "DURATION" && step.durationSec) {
    return `${step.durationSec}s`;
  }

  return "ohne Vorgabe";
}

export function WorkoutSessionClient({
  sessionId,
  planName,
  planVideoUrl,
  dayLabel,
  currentStepIndex,
  steps,
  startMode = "default",
}: WorkoutSessionClientProps) {
  const router = useRouter();
  const safeStepIndex = Math.min(
    Math.max(currentStepIndex, 0),
    Math.max(steps.length - 1, 0),
  );
  const currentStep = steps[safeStepIndex] ?? null;
  const nextStep = steps[safeStepIndex + 1] ?? null;

  const [mode, setMode] = useState<"exercise" | "break">("exercise");
  const [running, setRunning] = useState((currentStep?.durationSec ?? 0) > 0);
  const [remainingSec, setRemainingSec] = useState<number>(
    currentStep?.durationSec ?? 0,
  );
  const audioContextRef = useRef<AudioContext | null>(null);
  const autoAdvancingRef = useRef(false);
  const previousRemainingRef = useRef<number>(currentStep?.durationSec ?? 0);

  const baseDuration = currentStep?.durationSec ?? 0;
  const baseRest = currentStep?.restSec ?? 0;
  const planVideoEmbedUrl = useMemo(
    () => (planVideoUrl ? toYoutubeEmbed(planVideoUrl) : null),
    [planVideoUrl],
  );

  const activeBase = useMemo(
    () => (mode === "exercise" ? baseDuration : baseRest),
    [mode, baseDuration, baseRest],
  );

  const advanceToNextStep = useCallback(async () => {
    if (autoAdvancingRef.current) {
      return;
    }

    autoAdvancingRef.current = true;
    try {
      const formData = new FormData();
      formData.set("sessionId", sessionId);

      if (nextStep) {
        await advanceWorkoutStepAction(formData);
        router.refresh();
      } else {
        await completeWorkoutSessionAction(formData);
      }
    } finally {
      autoAdvancingRef.current = false;
    }
  }, [nextStep, router, sessionId]);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!audioContextRef.current) {
      const AudioContextCtor =
        window.AudioContext ||
        ((window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext ??
          null);

      if (!AudioContextCtor) {
        return null;
      }

      audioContextRef.current = new AudioContextCtor();
    }

    return audioContextRef.current;
  }, []);

  const playBeep = useCallback(
    (args: { durationMs: number; frequency: number }) => {
      const context = getAudioContext();
      if (!context) {
        return;
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = args.frequency;
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(context.destination);

      const now = context.currentTime;
      const durationSec = args.durationMs / 1000;
      gain.gain.linearRampToValueAtTime(0.18, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      oscillator.start(now);
      oscillator.stop(now + durationSec);
    },
    [getAudioContext],
  );

  useEffect(() => {
    if (!running || remainingSec <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSec((previous) => {
        return Math.max(previous - 1, 0);
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [remainingSec, running]);

  useEffect(() => {
    const previous = previousRemainingRef.current;

    if (!running) {
      previousRemainingRef.current = remainingSec;
      return;
    }

    if (remainingSec >= previous) {
      previousRemainingRef.current = remainingSec;
      return;
    }

    if (remainingSec > 0 && remainingSec <= 3) {
      playBeep({ durationMs: 120, frequency: 950 });
      previousRemainingRef.current = remainingSec;
      return;
    }

    if (remainingSec === 0) {
      playBeep({ durationMs: 520, frequency: 620 });

      if (mode === "exercise" && baseRest > 0) {
        previousRemainingRef.current = baseRest;
        setMode("break");
        setRemainingSec(baseRest);
        setRunning(true);
        previousRemainingRef.current = baseRest;
        return;
      }

      setRunning(false);
      void advanceToNextStep();
    }

    previousRemainingRef.current = remainingSec;
  }, [advanceToNextStep, baseRest, mode, playBeep, remainingSec, running]);

  async function handleAdvanceStep(formData: FormData) {
    setRunning(false);
    await advanceWorkoutStepAction(formData);
    router.refresh();
  }

  async function handleRetreatStep(formData: FormData) {
    setRunning(false);
    await retreatWorkoutStepAction(formData);
    router.refresh();
  }

  async function handleCompleteSession(formData: FormData) {
    setRunning(false);
    await completeWorkoutSessionAction(formData);
  }

  if (!currentStep) {
    return <p>Diese Session enthält keine Übungen.</p>;
  }

  return (
    <section className="workout-session-shell">
      <header className="workout-session-head">
        <p className="muted">{planName}</p>
        <h2>{dayLabel}</h2>
        <p className="workout-session-progress">
          Übung {safeStepIndex + 1} von {steps.length}
        </p>
      </header>

      {startMode === "video" && planVideoUrl ? (
        <article className="workout-session-current-card">
          <h3>Plan-Video</h3>
          <p className="muted">
            Video zuerst ansehen. Danach kannst du mit den Schrittanweisungen
            weitermachen.
          </p>
          {planVideoEmbedUrl ? (
            <iframe
              className="workout-video-embed"
              src={planVideoEmbedUrl}
              title={`Plan-Video: ${planName}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : planVideoUrl ? (
            <video
              className="workout-video-embed"
              src={planVideoUrl}
              controls
            />
          ) : null}
          <a href={planVideoUrl} target="_blank" rel="noreferrer">
            Plan-Video in neuem Tab öffnen
          </a>
        </article>
      ) : null}

      <article className="workout-session-current-card">
        <h3>{currentStep.exercise.name}</h3>
        <p className="muted">
          Vorgabe: {describeExercise(currentStep)}
          {currentStep.restSec ? ` · Pause ${currentStep.restSec}s` : ""}
        </p>
        {currentStep.info ? <p>{currentStep.info}</p> : null}
        <ExerciseVideoPreviewButton
          exerciseName={currentStep.exercise.name}
          mediaUrl={currentStep.exercise.mediaUrl}
          compact
        />
      </article>

      {(baseDuration > 0 || baseRest > 0) && (
        <article className="workout-session-timer-card">
          <div className="timer-row">
            {baseDuration > 0 ? (
              <button
                type="button"
                className={mode === "exercise" ? "week-nav-button" : undefined}
                onClick={() => {
                  setMode("exercise");
                  setRunning(false);
                  setRemainingSec(baseDuration);
                }}
              >
                Übung
              </button>
            ) : null}
            {baseRest > 0 ? (
              <button
                type="button"
                className={mode === "break" ? "week-nav-button" : undefined}
                onClick={() => {
                  setMode("break");
                  setRunning(false);
                  setRemainingSec(baseRest);
                }}
              >
                Pause
              </button>
            ) : null}
          </div>

          <strong className="workout-session-clock">
            {formatClock(remainingSec)}
          </strong>

          <div className="workout-session-controls">
            <button
              type="button"
              onClick={async () => {
                if (!running) {
                  const context = getAudioContext();
                  if (context?.state === "suspended") {
                    try {
                      await context.resume();
                    } catch {
                      // ignore resume errors and keep timer functional
                    }
                  }
                }

                setRunning((value) => !value);
              }}
              disabled={activeBase <= 0}
            >
              {running ? "Timer pausieren" : "Timer starten"}
            </button>
            <button
              type="button"
              className="training-secondary-button"
              onClick={() => {
                setRunning(false);
                setRemainingSec(activeBase);
              }}
              disabled={activeBase <= 0}
            >
              Timer reset
            </button>
          </div>

          {mode === "break" && nextStep ? (
            <div className="workout-next-step-card">
              <p className="muted">Nächste Übung nach der Pause</p>
              <strong>{nextStep.exercise.name}</strong>
              <p className="muted">{describeExercise(nextStep)}</p>
              <ExerciseVideoPreviewButton
                exerciseName={nextStep.exercise.name}
                mediaUrl={nextStep.exercise.mediaUrl}
                compact
              />
            </div>
          ) : null}
        </article>
      )}

      <div className="workout-session-controls">
        <form action={handleRetreatStep}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <button type="submit" className="training-secondary-button">
            Vorheriger Schritt
          </button>
        </form>
        <form action={handleAdvanceStep}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <button type="submit">Nächster Schritt</button>
        </form>
        <form action={handleCompleteSession}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <button type="submit">Workout beenden</button>
        </form>
      </div>

      <ol className="workout-list">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={index === safeStepIndex ? "workout-step-current" : ""}
          >
            <p>
              {step.exercise.name} ({describeExercise(step)})
            </p>
            <ExerciseVideoPreviewButton
              exerciseName={step.exercise.name}
              mediaUrl={step.exercise.mediaUrl}
              compact
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

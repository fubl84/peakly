"use client";

import { useEffect, useState } from "react";

type WorkoutTimerClientProps = {
  durationSec: number | null;
  restSec: number | null;
};

function formatClock(totalSeconds: number) {
  const safe = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function WorkoutTimerClient(props: WorkoutTimerClientProps) {
  const durationValue = props.durationSec ?? 0;
  const restValue = props.restSec ?? 0;

  const [mode, setMode] = useState<"duration" | "rest">("duration");
  const [remainingSec, setRemainingSec] = useState<number>(durationValue);
  const [running, setRunning] = useState(false);

  const baseValue = mode === "duration" ? durationValue : restValue;

  useEffect(() => {
    if (!running || remainingSec <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSec((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [remainingSec, running]);

  if (durationValue <= 0 && restValue <= 0) {
    return <p className="muted">Für diese Übung ist kein Timer hinterlegt.</p>;
  }

  return (
    <div className="timer-shell">
      <div className="timer-row">
        {durationValue > 0 ? (
          <button
            type="button"
            onClick={() => {
              setMode("duration");
              setRunning(false);
              setRemainingSec(durationValue);
            }}
          >
            Dauer
          </button>
        ) : null}
        {restValue > 0 ? (
          <button
            type="button"
            onClick={() => {
              setMode("rest");
              setRunning(false);
              setRemainingSec(restValue);
            }}
          >
            Pause
          </button>
        ) : null}
      </div>
      <strong className="timer-clock">{formatClock(remainingSec)}</strong>
      <div className="timer-row">
        <button
          type="button"
          onClick={() => setRunning((value) => !value)}
          disabled={remainingSec <= 0}
        >
          {running ? "Pause" : "Start"}
        </button>
        <button
          type="button"
          onClick={() => {
            setRunning(false);
            setRemainingSec(baseValue);
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

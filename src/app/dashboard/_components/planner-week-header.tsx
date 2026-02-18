import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

type PlannerWeekHeaderProps = {
  pathName: string;
  week: number;
  maxWeek: number;
  currentWeek: number;
  dateRangeLabel: string;
  pathNameLabel: string;
};

function clampWeek(week: number, maxWeek: number) {
  if (week < 1) return 1;
  if (week > maxWeek) return maxWeek;
  return week;
}

function weekHref(pathName: string, week: number) {
  return `${pathName}?week=${week}`;
}

export function PlannerWeekHeader({
  pathName,
  week,
  maxWeek,
  currentWeek,
  dateRangeLabel,
  pathNameLabel,
}: PlannerWeekHeaderProps) {
  const previousWeek = clampWeek(week - 1, maxWeek);
  const nextWeek = clampWeek(week + 1, maxWeek);

  return (
    <section className="week-head">
      <div className="week-head-meta">
        <span>
          Pfad: <strong>{pathNameLabel}</strong>
        </span>
        <span className="training-week-meta">
          Woche <strong className="training-week-number">{week}</strong> von{" "}
          {maxWeek}
        </span>
        <span>
          Zeitraum: <strong>{dateRangeLabel}</strong>
        </span>
      </div>
      <div className="week-nav">
        <Link
          className="week-nav-button"
          href={weekHref(pathName, previousWeek)}
        >
          <ArrowLeft size={14} aria-hidden="true" /> Vorherige Woche
        </Link>
        <Link
          className="week-nav-button"
          href={weekHref(pathName, currentWeek)}
        >
          Zur aktuellen Woche
        </Link>
        <Link className="week-nav-button" href={weekHref(pathName, nextWeek)}>
          Nächste Woche <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

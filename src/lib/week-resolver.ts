export function resolveEnrollmentWeek(args: {
  startDate: Date;
  referenceDate?: Date;
  maxWeeks?: number;
}) {
  const referenceDate = args.referenceDate ?? new Date();
  const millisDiff = referenceDate.getTime() - args.startDate.getTime();

  if (millisDiff < 0) {
    return 0;
  }

  const dayDiff = Math.floor(millisDiff / (1000 * 60 * 60 * 24));
  const week = Math.floor(dayDiff / 7) + 1;

  if (args.maxWeeks && week > args.maxWeeks) {
    return args.maxWeeks;
  }

  return week;
}

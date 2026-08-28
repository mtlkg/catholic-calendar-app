export type RecurrenceFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export type RecurrenceOccurrence = {
  start: string;
  end: string;
};

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

function parseLocal(input: string): LocalParts | null {
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  return { year, month: month - 1, day, hour, minute };
}

function formatLocal(parts: LocalParts): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month + 1)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function addLocalDays(input: string, days: number): string {
  const parts = parseLocal(input);
  if (!parts) return input;
  const date = new Date(Date.UTC(parts.year, parts.month, parts.day + days));
  return formatLocal({
    ...parts,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  });
}

function localDayDifference(start: string, end: string): number {
  const a = parseLocal(start);
  const b = parseLocal(end);
  if (!a || !b) return 0;
  const startDay = Date.UTC(a.year, a.month, a.day);
  const endDay = Date.UTC(b.year, b.month, b.day);
  return Math.round((endDay - startDay) / 86_400_000);
}

/** Preserve weekday + ordinal week, falling back to the final matching weekday. */
function ordinalWeekdayInMonth(
  targetYear: number,
  targetMonth: number,
  sourceYear: number,
  sourceMonth: number,
  sourceDay: number,
): number {
  const weekday = new Date(Date.UTC(sourceYear, sourceMonth, sourceDay)).getUTCDay();
  const ordinal = Math.floor((sourceDay - 1) / 7);
  const firstWeekday = new Date(Date.UTC(targetYear, targetMonth, 1)).getUTCDay();
  const firstMatch = 1 + ((weekday - firstWeekday + 7) % 7);
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const requested = firstMatch + ordinal * 7;
  if (requested <= daysInMonth) return requested;
  return requested - 7;
}

export function shiftRecurringLocal(
  input: string,
  frequency: RecurrenceFrequency,
  occurrenceIndex: number,
): string {
  const parts = parseLocal(input);
  if (!parts || occurrenceIndex === 0) return input;
  if (frequency === "daily") return addLocalDays(input, occurrenceIndex);
  if (frequency === "weekly") return addLocalDays(input, occurrenceIndex * 7);
  if (frequency === "biweekly") return addLocalDays(input, occurrenceIndex * 14);

  let targetYear = parts.year;
  let targetMonth = parts.month;
  if (frequency === "monthly") {
    const totalMonths = parts.month + occurrenceIndex;
    targetYear = parts.year + Math.floor(totalMonths / 12);
    targetMonth = ((totalMonths % 12) + 12) % 12;
  } else {
    targetYear = parts.year + occurrenceIndex;
  }

  return formatLocal({
    ...parts,
    year: targetYear,
    month: targetMonth,
    day: ordinalWeekdayInMonth(
      targetYear,
      targetMonth,
      parts.year,
      parts.month,
      parts.day,
    ),
  });
}

export function generateRecurrenceOccurrences(
  start: string,
  end: string,
  frequency: RecurrenceFrequency,
  count: number,
): RecurrenceOccurrence[] {
  if (!start) return [];
  const safeCount = Math.min(52, Math.max(1, Math.round(count || 1)));
  const spanDays = end ? localDayDifference(start, end) : 0;
  const endParts = end ? parseLocal(end) : null;

  return Array.from({ length: safeCount }, (_, index) => {
    const occurrenceStart = shiftRecurringLocal(start, frequency, index);
    let occurrenceEnd = "";
    if (endParts) {
      const shiftedEndDay = addLocalDays(occurrenceStart, spanDays);
      const shiftedParts = parseLocal(shiftedEndDay);
      if (shiftedParts) {
        occurrenceEnd = formatLocal({ ...shiftedParts, hour: endParts.hour, minute: endParts.minute });
      }
    }
    return { start: occurrenceStart, end: occurrenceEnd };
  });
}
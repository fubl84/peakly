export function getRequiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`Feld '${key}' ist erforderlich.`);
  }

  return value;
}

export function getRequiredInt(formData: FormData, key: string) {
  const value = getOptionalNumber(formData, key);

  if (value === null || !Number.isInteger(value)) {
    throw new Error(`Feld '${key}' muss eine ganze Zahl sein.`);
  }

  return value;
}

export function assertWeekRange(weekStart: number, weekEnd: number) {
  if (weekStart < 1 || weekEnd < 1) {
    throw new Error("Wochen müssen größer oder gleich 1 sein.");
  }

  if (weekStart > weekEnd) {
    throw new Error("Woche von darf nicht größer als Woche bis sein.");
  }
}

export function getOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export function getOptionalNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();

  if (!raw) {
    return null;
  }

  const value = Number(raw.replace(",", "."));

  if (Number.isNaN(value)) {
    throw new Error(`Feld '${key}' muss eine Zahl sein.`);
  }

  return value;
}

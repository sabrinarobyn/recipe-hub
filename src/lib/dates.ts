export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** Monday of the week containing the date. */
export function weekStart(s: string): string {
  const d = parseIso(s);
  const offset = (d.getDay() + 6) % 7;
  return addDays(s, -offset);
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function today(): string {
  return iso(new Date());
}

export function dayName(s: string, style: "short" | "long" = "short"): string {
  return parseIso(s).toLocaleDateString("en-ZA", { weekday: style });
}

export function dayMonth(s: string): string {
  return parseIso(s).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export function weekLabel(monday: string): string {
  return `${dayMonth(monday)} – ${dayMonth(addDays(monday, 6))}`;
}

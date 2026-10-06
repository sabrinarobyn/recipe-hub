/** R 1 234.50 */
export function rand(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "–";
  const fixed = Math.abs(n).toFixed(2);
  const [whole, cents] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "−" : ""}R ${grouped}.${cents}`;
}

function trim(n: number, dp = 2): string {
  return String(Number(n.toFixed(dp)));
}

/** 1 250 g → 1.25 kg, 0.5 punnet, 3 ea → 3 */
export function qty(n: number, unit: string): string {
  if (unit === "g" && n >= 1000) return `${trim(n / 1000)} kg`;
  if (unit === "ml" && n >= 1000) return `${trim(n / 1000)} L`;
  if (unit === "g" || unit === "ml") return `${trim(n, 0) === "0" ? trim(n, 1) : trim(n, 0)} ${unit}`;
  if (unit === "ea") return trim(n);
  return `${trim(n)} ${unit}${n > 1 && !unit.endsWith("s") && unit !== "ea" ? (unit.endsWith("ch") ? "es" : "s") : ""}`;
}

export function packLabel(size: number | null, unit: string): string {
  if (!size) return "";
  if (unit === "ea") return size === 1 ? "single" : `${trim(size)}-pack`;
  return qty(size, unit);
}

export function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

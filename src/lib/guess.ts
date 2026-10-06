const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

function leadingNumber(text: string): number | null {
  const m = text.trim().match(/^(\d+(?:[.,]\d+)?)?\s*([½¼¾⅓⅔])?/);
  if (!m || (!m[1] && !m[2])) return null;
  return (m[1] ? Number(m[1].replace(",", ".")) : 0) + (m[2] ? FRACTIONS[m[2]] : 0);
}

/**
 * Best guess at the amount an ingredient line asks for, in the product's unit.
 * "500 g spinach" → 500 (g); "1 kg potatoes" → 1000 (g); "2 eggs" → 2 (ea);
 * "1 cup milk" → 250 (ml). Returns null when there's nothing sensible.
 */
export function guessQty(text: string, unit: string): number | null {
  const t = text.toLowerCase();
  const metric = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/);
  if (metric) {
    const n = Number(metric[1].replace(",", "."));
    const u = metric[2];
    if (unit === "g" && (u === "g" || u === "kg")) return u === "kg" ? n * 1000 : n;
    if (unit === "ml" && (u === "ml" || u === "l")) return u === "l" ? n * 1000 : n;
  }
  const n = leadingNumber(t);
  if (n == null) return null;
  const spoon = t.match(/\b(cups?|tbsp|tablespoons?|tsp|teaspoons?)\b/);
  if (spoon && unit === "ml") {
    const s = spoon[1];
    return n * (s.startsWith("cup") ? 250 : s.startsWith("tbsp") || s.startsWith("table") ? 15 : 5);
  }
  if (!metric && !spoon && unit !== "g" && unit !== "ml") return n;
  return null;
}

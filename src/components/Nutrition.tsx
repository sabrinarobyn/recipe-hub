import { energySplit, type Macros, type RecipeNutrition } from "../lib/nutrition";

export function kcal(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kcal`;
}
const g = (n: number) => `${n < 10 ? Math.round(n * 10) / 10 : Math.round(n)} g`;

/** "420 kcal · P 32 g · C 40 g · F 12 g" */
export function MacroLine({ m, className = "" }: { m: Macros; className?: string }) {
  return (
    <span className={`macro-line ${className}`}>
      <span className="macro-kcal">{kcal(m.kcal)}</span>
      <span title="Protein">
        <span className="macro-letter macro-p">P</span> {g(m.protein)}
      </span>
      <span title="Carbohydrates">
        <span className="macro-letter macro-c">C</span> {g(m.carbs)}
      </span>
      <span title="Fat">
        <span className="macro-letter macro-f">F</span> {g(m.fat)}
      </span>
    </span>
  );
}

/** Bar showing the share of energy from protein, carbs and fat. */
export function EnergyBar({ m }: { m: Macros }) {
  const s = energySplit(m);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <div className="energy-bar" role="img" aria-label={`Energy: ${pct(s.protein)} protein, ${pct(s.carbs)} carbs, ${pct(s.fat)} fat`}>
      <span className="eb-p" style={{ width: pct(s.protein) }} />
      <span className="eb-c" style={{ width: pct(s.carbs) }} />
      <span className="eb-f" style={{ width: pct(s.fat) }} />
    </div>
  );
}

export function NutritionPanel({ n }: { n: RecipeNutrition }) {
  const per = n.perServing ?? n.total;
  const s = energySplit(per);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const rows: [string, number, string, string][] = [
    ["Protein", per.protein, "macro-p", pct(s.protein)],
    ["Carbs", per.carbs, "macro-c", pct(s.carbs)],
    ["Fat", per.fat, "macro-f", pct(s.fat)],
    ["Fibre", per.fibre, "", ""],
  ];
  return (
    <section className="nutrition" aria-label="Nutrition">
      <div className="nutrition-head">
        <span>
          <span className="cost-label">{n.servings ? `Per serving · makes ${n.servings}` : "Whole recipe"}</span>
          <span className="nutrition-kcal num">{kcal(per.kcal)}</span>
        </span>
        {n.servings && n.servings > 1 && (
          <span className="hint">
            Whole recipe <span className="num">{kcal(n.total.kcal)}</span>
          </span>
        )}
      </div>
      <EnergyBar m={per} />
      <dl className="macro-grid">
        {rows.map(([label, v, cls, share]) => (
          <div key={label}>
            <dt>
              {cls && <span className={`macro-dot ${cls}`} aria-hidden="true" />}
              {label}
            </dt>
            <dd className="num">
              {g(v)}
              {share && <span className="muted"> · {share}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="hint">
        Estimated from typical values for each ingredient, not Woolworths labels. Check a product's label and update it on the Prices
        page for exact figures.
        {n.notCounted.length > 0 && (
          <>
            {" "}
            Not counted: {[...new Set(n.notCounted.map((x) => x.text.replace(/ \(part \d+\)$/, "")))].join(", ")}.
          </>
        )}
      </p>
    </section>
  );
}

import { useMemo, useState } from "react";
import type { Open } from "../App";
import { suggestRecipes } from "../lib/kitchen";
import { qty } from "../lib/format";
import { useApp, usePantry } from "../lib/store";
import { AddToPlan } from "./AddToPlan";
import { Thumb } from "./Photo";
import { Icon } from "./ui";

/** How many suggestions the Plan shows. */
const SHOWN = 6;

/** Recipes that use what's in the Member's Pantry, best match first, each addable to the Plan. */
export function PantrySuggestions({ open, week }: { open: Open; week: string }) {
  const { catalog } = useApp();
  const pantry = usePantry();
  const suggestions = useMemo(() => suggestRecipes(pantry, catalog).slice(0, SHOWN), [pantry, catalog]);
  const [adding, setAdding] = useState<string | null>(null);
  // An empty Pantry (or one no Recipe uses) shows nothing.
  if (suggestions.length === 0) return null;

  return (
    <section className="pantry-suggestions" aria-labelledby="pantry-suggestions-title">
      <h2 id="pantry-suggestions-title">Cook from your Pantry</h2>
      <p className="hint">Recipes that use what's in your Pantry, best match first.</p>
      <ul className="pick-list suggestion-list">
        {suggestions.map((s) => {
          const r = catalog.recipes.get(s.recipeId)!;
          const items = s.uses
            .map((u) => {
              const p = catalog.products.get(u.productKey);
              return p ? `${p.name} (${qty(u.amount, p.unit)})` : null;
            })
            .filter(Boolean)
            .join(", ");
          return (
            <li key={s.recipeId} className="suggestion">
              <button onClick={() => open.recipe(r.id)}>
                <Thumb recipe={r} />
                <span className="pick-text">
                  <span className="pick-name">{r.name}</span>
                  <span className="pick-cat">Uses {items}</span>
                </span>
                <span className="num suggestion-match">{Math.round(s.coverage * 100)}% in Pantry</span>
              </button>
              <button className="btn btn-small suggestion-add" onClick={() => setAdding(r.id)} aria-label={`Add ${r.name} to plan`}>
                <Icon name="plus" size={16} /> Add
              </button>
            </li>
          );
        })}
      </ul>
      {adding && (
        <AddToPlan
          recipeId={adding}
          week={week}
          onClose={() => setAdding(null)}
          onAdded={(msg) => {
            open.notify(msg);
            setAdding(null);
          }}
        />
      )}
    </section>
  );
}

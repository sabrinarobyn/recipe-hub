import { useMemo, useState } from "react";
import type { Open } from "../App";
import { rand } from "../lib/format";
import { STORE_NAMES } from "../lib/costing";
import { editState, seed, seedRecipeIds, useApp, useNutrition, useSummaries } from "../lib/store";
import { MacroLine } from "./Nutrition";
import { ConfirmButton, Icon } from "./ui";
import { Thumb } from "./Photo";
import { Sticker, StickerCluster } from "./Brand";

type Sort = "name" | "cheap" | "dear" | "shop" | "kcal" | "protein";

export function RecipesView({ open }: { open: Open }) {
  const { catalog, data, actions, canEditBook } = useApp();
  const summaries = useSummaries();
  const nutrition = useNutrition();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [sort, setSort] = useState<Sort>("name");

  const recipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = catalog.recipeList.filter((r) => {
      if (category !== "All" && r.category !== category) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.lines.some((l) => l.text.toLowerCase().includes(q)) ||
        r.lines.some((l) => l.productKey && catalog.products.get(l.productKey)?.name.toLowerCase().includes(q))
      );
    });
    const cost = (id: string) => summaries.get(id)!;
    return list.sort((a, b) => {
      if (sort === "cheap") return cost(a.id).perMake - cost(b.id).perMake;
      if (sort === "dear") return cost(b.id).perMake - cost(a.id).perMake;
      if (sort === "shop") return cost(a.id).shop - cost(b.id).shop;
      const per = (id: string) => {
        const n = nutrition.get(id)!;
        return n.perServing ?? n.total;
      };
      if (sort === "kcal") return per(a.id).kcal - per(b.id).kcal;
      if (sort === "protein") return per(b.id).protein - per(a.id).protein;
      return a.name.localeCompare(b.name);
    });
  }, [catalog, summaries, nutrition, query, category, sort]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of catalog.recipeList) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return m;
  }, [catalog]);

  /** The filtered recipes under their category headings, in the book's category order. */
  const groups = useMemo(() => {
    const byCat = new Map<string, typeof recipes>();
    for (const r of recipes) byCat.set(r.category, [...(byCat.get(r.category) ?? []), r]);
    const order = [...catalog.categories, ...[...byCat.keys()].filter((c) => !catalog.categories.includes(c))];
    return order.filter((c) => byCat.has(c)).map((c) => ({ category: c, recipes: byCat.get(c)! }));
  }, [recipes, catalog]);

  /** Built-in recipes that were removed, so they can be brought back. */
  const removed = useMemo(() => seed.recipes.filter((r) => data.recipeEdits[r.id] === null), [data.recipeEdits]);

  const remove = (id: string, name: string) => {
    actions.deleteRecipe(id);
    open.notify(`Removed ${name}`);
  };

  const avg = useMemo(() => {
    const all = [...summaries.values()];
    return all.reduce((s, x) => s + x.perMake, 0) / (all.length || 1);
  }, [summaries]);

  return (
    <section className="view">
      <div className="hero">
        <div className="hero-text">
          <span className="hand-note">Save, plan, cook &amp; enjoy</span>
          <h1>Choose your meals</h1>
          <p className="lede">
            {catalog.recipeList.length} recipes, each costed against {STORE_NAMES[catalog.store ?? "woolworths"]} prices. Average cost per make{" "}
            <strong className="num">{rand(avg)}</strong>.
          </p>
          {canEditBook && (
            <div className="btn-row">
              <button className="btn btn-sun" onClick={() => open.editRecipe("new")}>
                <Icon name="plus" /> New recipe
              </button>
            </div>
          )}
        </div>
        <StickerCluster className="hero-art" />
      </div>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" />
          <input
            id="recipe-search"
            type="search"
            placeholder="Search recipes or ingredients (e.g. feta, mince)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="select-wrap">
          <span className="sr-only">Sort</span>
          <select id="recipe-sort" className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="name">A–Z</option>
            <option value="cheap">Cost per make: low to high</option>
            <option value="dear">Cost per make: high to low</option>
            <option value="shop">Shop-from-scratch: low to high</option>
            <option value="kcal">Calories per serving: low to high</option>
            <option value="protein">Protein per serving: high to low</option>
          </select>
        </label>
      </div>

      <div className="chips" role="group" aria-label="Category">
        {["All", ...catalog.categories].map((c) => (
          <button key={c} className={`chip${category === c ? " active" : ""}`} onClick={() => setCategory(c)}>
            {c}
            <span className="chip-count">{c === "All" ? catalog.recipeList.length : (counts.get(c) ?? 0)}</span>
          </button>
        ))}
      </div>

      {recipes.length === 0 ? (
        <div className="empty">
          <Sticker name="lemon" size={64} />
          <p>No recipes match “{query}”.</p>
          <button className="btn" onClick={() => (setQuery(""), setCategory("All"))}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="recipe-groups">
          {groups.map((g) => (
            <section key={g.category} className="recipe-group" aria-labelledby={`cat-${g.category}`}>
              <h2 className="recipe-group-title" id={`cat-${g.category}`}>
                {g.category}
                <span className="chip-count">{g.recipes.length}</span>
              </h2>
              <ul className="recipe-list">
                {g.recipes.map((r) => {
                  const s = summaries.get(r.id)!;
                  const n = nutrition.get(r.id)!;
                  const state = editState(data.recipeEdits, seedRecipeIds, r.id);
                  return (
                    <li key={r.id} className="recipe-row">
                      <button className="recipe-row-main" onClick={() => open.recipe(r.id)}>
                        <Thumb recipe={r} />
                        <span className="recipe-row-text">
                          <span className="recipe-row-name">
                            {r.name}
                            {state && <span className={`badge badge-${state}`}>{state === "new" ? "Yours" : "Edited"}</span>}
                          </span>
                          <span className="recipe-row-meta">
                            <MacroLine m={n.perServing ?? n.total} />
                            <span className="cost-label">{n.perServing ? "per serving" : "whole recipe"}</span>
                            {s.substitutes > 0 && <span className="flag flag-warn">{s.substitutes} substitute{s.substitutes > 1 ? "s" : ""}</span>}
                            {s.missing > 0 && <span className="flag flag-bad">{s.missing} not at Woolies</span>}
                            {s.problems > 0 && <span className="flag flag-bad">{s.problems} not costed</span>}
                          </span>
                        </span>
                        <span className="recipe-row-cost">
                          <span className="num">{rand(s.perMake)}</span>
                          <span className="cost-label">per make</span>
                        </span>
                        <span className="recipe-row-cost recipe-row-scratch">
                          <span className="num">{rand(s.shop)}</span>
                          <span className="cost-label">from scratch</span>
                        </span>
                      </button>
                      <button className="btn btn-quiet btn-small row-add" onClick={() => open.addToPlan(r.id)} aria-label={`Add ${r.name} to plan`}>
                        <Icon name="plus" /> <span className="row-add-text">Plan</span>
                      </button>
                      {canEditBook && (
                        <ConfirmButton
                          className="btn btn-danger-quiet btn-small row-remove"
                          confirmLabel="Remove?"
                          ariaLabel={`Remove ${r.name}`}
                          onConfirm={() => remove(r.id, r.name)}
                        >
                          <Icon name="trash" />
                        </ConfirmButton>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {canEditBook && removed.length > 0 && (
        <details className="removed-recipes">
          <summary>
            Removed recipes <span className="chip-count">{removed.length}</span>
          </summary>
          <ul>
            {removed.map((r) => (
              <li key={r.id}>
                <span>{r.name}</span>
                <button
                  className="btn btn-small"
                  onClick={() => (actions.resetRecipe(r.id), open.notify(`Restored ${r.name}`))}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

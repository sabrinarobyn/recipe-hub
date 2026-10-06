import { useMemo, useState } from "react";
import type { Open } from "../App";
import { rand } from "../lib/format";
import { editState, seedRecipeIds, useApp, useSummaries } from "../lib/store";
import { Icon } from "./ui";

type Sort = "name" | "cheap" | "dear" | "shop";

export function RecipesView({ open }: { open: Open }) {
  const { catalog, data } = useApp();
  const summaries = useSummaries();
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
      return a.name.localeCompare(b.name);
    });
  }, [catalog, summaries, query, category, sort]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of catalog.recipeList) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return m;
  }, [catalog]);

  const avg = useMemo(() => {
    const all = [...summaries.values()];
    return all.reduce((s, x) => s + x.perMake, 0) / (all.length || 1);
  }, [summaries]);

  return (
    <section className="view">
      <div className="view-head">
        <div>
          <h1>Choose your meals</h1>
          <p className="lede">
            {catalog.recipeList.length} recipes, each costed against Woolworths prices. Average cost per make{" "}
            <strong className="num">{rand(avg)}</strong>.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => open.editRecipe("new")}>
          <Icon name="plus" /> New recipe
        </button>
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
          <p>No recipes match “{query}”.</p>
          <button className="btn" onClick={() => (setQuery(""), setCategory("All"))}>
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="recipe-grid">
          {recipes.map((r) => {
            const s = summaries.get(r.id)!;
            const state = editState(data.recipeEdits, seedRecipeIds, r.id);
            return (
              <li key={r.id} className="recipe-card">
                <button className="recipe-card-main" onClick={() => open.recipe(r.id)}>
                  <span className="eyebrow">
                    {r.category}
                    {state && <span className={`badge badge-${state}`}>{state === "new" ? "Yours" : "Edited"}</span>}
                  </span>
                  <span className="recipe-name">{r.name}</span>
                  {r.yield && <span className="recipe-yield">{r.yield}</span>}
                  <span className="recipe-costs">
                    <span>
                      <span className="cost-big num">{rand(s.perMake)}</span>
                      <span className="cost-label">per make</span>
                    </span>
                    <span>
                      <span className="cost-small num">{rand(s.shop)}</span>
                      <span className="cost-label">from scratch</span>
                    </span>
                  </span>
                  <span className="flags">
                    {s.substitutes > 0 && <span className="flag flag-warn">{s.substitutes} substitute{s.substitutes > 1 ? "s" : ""}</span>}
                    {s.missing > 0 && <span className="flag flag-bad">{s.missing} not at Woolies</span>}
                    {s.problems > 0 && <span className="flag flag-bad">{s.problems} not costed</span>}
                  </span>
                </button>
                <button className="btn btn-quiet add-plan" onClick={() => open.addToPlan(r.id)}>
                  <Icon name="plus" /> Add to plan
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

import { useMemo, useRef, useState } from "react";
import { buildShoppingList, lineCost } from "../lib/costing";
import { packLabel, rand, slugify, uid } from "../lib/format";
import { guessQty } from "../lib/guess";
import { buildCatalog, useApp } from "../lib/store";
import type { IngredientLine, LineKind, Product, Recipe } from "../types";
import { ProductEditor } from "./PricesView";
import { Icon, Modal, NumberField } from "./ui";

const KINDS: { id: LineKind; label: string }[] = [
  { id: "product", label: "Woolworths product" },
  { id: "basic", label: "Pantry basic (not costed)" },
  { id: "missing", label: "Not at Woolworths" },
  { id: "recipe", label: "Another recipe" },
];

const NEW_CATEGORY = "__new__";

export function RecipeEditor({ recipe, onClose, onSaved }: { recipe: Recipe | null; onClose: () => void; onSaved: (r: Recipe) => void }) {
  const { catalog, data, actions } = useApp();
  const isNew = !recipe;
  const [draft, setDraft] = useState<Recipe>(
    () =>
      recipe ?? {
        id: "",
        name: "",
        category: "Mains",
        notes: "",
        yield: "",
        link: "",
        lines: [{ id: uid(), text: "", kind: "product" }],
      },
  );
  const [newCategory, setNewCategory] = useState("");
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [error, setError] = useState("");

  const set = (patch: Partial<Recipe>) => setDraft((d) => ({ ...d, ...patch }));
  const setLine = (id: string, patch: Partial<IngredientLine>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const removeLine = (id: string) => setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== id) }));
  const moveLine = (id: string, dir: -1 | 1) =>
    setDraft((d) => {
      const i = d.lines.findIndex((l) => l.id === id);
      const j = i + dir;
      if (j < 0 || j >= d.lines.length) return d;
      const lines = [...d.lines];
      [lines[i], lines[j]] = [lines[j], lines[i]];
      return { ...d, lines };
    });
  const addLine = () => setDraft((d) => ({ ...d, lines: [...d.lines, { id: uid(), text: "", kind: "product" }] }));

  // Cost the draft as if it were saved.
  const draftId = draft.id || "__draft__";
  const preview = useMemo(() => {
    const cat = buildCatalog({ ...data, recipeEdits: { ...data.recipeEdits, [draftId]: { ...draft, id: draftId } } });
    return { cat, list: buildShoppingList([{ recipeId: draftId, batches: 1 }], cat) };
  }, [data, draft, draftId]);

  // How often each product is used, so common matches (eggs, not Easter eggs) come first.
  const popularity = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of catalog.recipeList) for (const l of r.lines) if (l.productKey) m.set(l.productKey, (m.get(l.productKey) ?? 0) + 1);
    return m;
  }, [catalog]);

  const otherRecipes = catalog.recipeList.filter((r) => r.id !== draft.id).sort((a, b) => a.name.localeCompare(b.name));

  const save = () => {
    const name = draft.name.trim();
    if (!name) return setError("Give the recipe a name.");
    let category = draft.category;
    if (category === NEW_CATEGORY) {
      category = newCategory.trim();
      if (!category) return setError("Type a name for the new category.");
      actions.addCategory(category);
    }
    let id = draft.id;
    if (isNew) {
      const base = slugify(name) || "recipe";
      id = base;
      let n = 2;
      while (catalog.recipes.has(id)) id = `${base}-${n++}`;
    }
    const lines = draft.lines
      .filter((l) => l.text.trim() || l.productKey || l.recipeId)
      .map((l) => {
        const clean: IngredientLine = { id: l.id, text: l.text.trim() || productName(l), kind: l.kind };
        if (l.kind === "product") {
          if (l.productKey) clean.productKey = l.productKey;
          clean.qty = l.qty ?? null;
          if (l.substitute) clean.substitute = true;
        }
        if (l.kind === "recipe") {
          if (l.recipeId) clean.recipeId = l.recipeId;
          clean.qty = l.qty ?? 1;
        }
        if (l.note?.trim()) clean.note = l.note.trim();
        return clean;
      });
    const saved: Recipe = { ...draft, id, name, category, lines, notes: draft.notes.trim(), yield: draft.yield.trim(), link: draft.link.trim() };
    actions.saveRecipe(saved);
    onSaved(saved);
  };

  function productName(l: IngredientLine) {
    if (l.kind === "product" && l.productKey) return catalog.products.get(l.productKey)?.name ?? "";
    if (l.kind === "recipe" && l.recipeId) return catalog.recipes.get(l.recipeId)?.name ?? "";
    return "";
  }

  return (
    <Modal
      wide
      title={isNew ? "New recipe" : `Edit ${recipe!.name}`}
      onClose={onClose}
      footer={
        <>
          <div className="foot-left editor-total">
            <span className="cost-label">Cost per make</span>
            <span className="num">{rand(preview.list.usedTotal)}</span>
            <span className="cost-label">From scratch</span>
            <span className="num">{rand(preview.list.total)}</span>
          </div>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            {isNew ? "Add recipe" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field span-2">
          <span className="field-label">Recipe name</span>
          <input id="recipe-name" className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Sheet-pan Chicken & Veg" autoFocus={isNew} />
        </label>
        <label className="field">
          <span className="field-label">Category</span>
          <select id="recipe-category" className="input" value={draft.category} onChange={(e) => set({ category: e.target.value })}>
            {catalog.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
            <option value={NEW_CATEGORY}>New category…</option>
          </select>
        </label>
        {draft.category === NEW_CATEGORY ? (
          <label className="field">
            <span className="field-label">New category name</span>
            <input id="recipe-new-category" className="input" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Kids' lunchboxes" />
          </label>
        ) : (
          <label className="field">
            <span className="field-label">Serves / makes (optional)</span>
            <input id="recipe-yield" className="input" value={draft.yield} onChange={(e) => set({ yield: e.target.value })} placeholder="e.g. Serves 4" />
          </label>
        )}
        <label className="field span-2">
          <span className="field-label">Method notes (optional)</span>
          <textarea id="recipe-notes" className="input" rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. Bake 180°C for 40 min." />
        </label>
        <label className="field span-2">
          <span className="field-label">Link to the recipe (optional)</span>
          <input id="recipe-link" className="input" value={draft.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://…" />
        </label>
      </div>

      <h3 className="sub-head">Ingredients</h3>
      <p className="hint">
        Write each ingredient as the recipe says it, then match it to a Woolworths product and the amount used. Amounts are in the
        product's unit (g, ml, or a count), so the app can work out the share of the pack.
      </p>
      <ol className="line-editor">
        {draft.lines.map((line, i) => {
          const product = line.productKey ? catalog.products.get(line.productKey) : undefined;
          const cost = lineCost({ ...line }, preview.cat);
          return (
            <li key={line.id} className="line-edit">
              <div className="line-edit-top">
                <input
                  id={`line-text-${line.id}`}
                  className="input line-text"
                  value={line.text}
                  onChange={(e) => setLine(line.id, { text: e.target.value })}
                  placeholder={`Ingredient ${i + 1}, e.g. 500 g baby spinach`}
                  aria-label={`Ingredient ${i + 1}`}
                />
                <select
                  id={`line-kind-${line.id}`}
                  className="input line-kind"
                  value={line.kind}
                  onChange={(e) => setLine(line.id, { kind: e.target.value as LineKind })}
                  aria-label="Type"
                >
                  {KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <span className="line-tools">
                  <button className="icon-btn" onClick={() => moveLine(line.id, -1)} disabled={i === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button className="icon-btn" onClick={() => moveLine(line.id, 1)} disabled={i === draft.lines.length - 1} aria-label="Move down">
                    ↓
                  </button>
                  <button className="icon-btn" onClick={() => removeLine(line.id)} aria-label="Remove ingredient">
                    <Icon name="trash" size={16} />
                  </button>
                </span>
              </div>

              {line.kind === "product" && (
                <div className="line-edit-detail">
                  <ProductPicker
                    id={`line-product-${line.id}`}
                    products={catalog.productList}
                    popularity={popularity}
                    value={line.productKey}
                    initialQuery={line.text}
                    onPick={(p) => setLine(line.id, { productKey: p.key, qty: line.qty ?? guessQty(line.text, p.unit) })}
                    onCreate={() => setCreatingFor(line.id)}
                  />
                  <label className="qty-field">
                    <NumberField id={`line-qty-${line.id}`} value={line.qty} onCommit={(n) => setLine(line.id, { qty: n })} placeholder="Amount" ariaLabel="Amount used" />
                    <span className="unit">{product ? product.unit : ""}</span>
                  </label>
                  <span className="line-cost num">{rand(cost)}</span>
                  {product && (
                    <span className="hint line-hint">
                      Pack: {packLabel(product.packSize, product.unit)} at {rand(product.today)}
                    </span>
                  )}
                  <label className="check-label">
                    <input id={`line-sub-${line.id}`} type="checkbox" checked={!!line.substitute} onChange={(e) => setLine(line.id, { substitute: e.target.checked })} />
                    Substitute
                  </label>
                </div>
              )}
              {line.kind === "recipe" && (
                <div className="line-edit-detail">
                  <select
                    id={`line-recipe-${line.id}`}
                    className="input"
                    value={line.recipeId ?? ""}
                    onChange={(e) => setLine(line.id, { recipeId: e.target.value || undefined })}
                    aria-label="Recipe"
                  >
                    <option value="">Choose a recipe…</option>
                    {otherRecipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <label className="qty-field">
                    <NumberField id={`line-batches-${line.id}`} value={line.qty ?? 1} onCommit={(n) => setLine(line.id, { qty: n ?? 1 })} ariaLabel="Batches" />
                    <span className="unit">batch</span>
                  </label>
                  <span className="line-cost num">{rand(cost)}</span>
                </div>
              )}
              <input
                id={`line-note-${line.id}`}
                className="input line-note-input"
                value={line.note ?? ""}
                onChange={(e) => setLine(line.id, { note: e.target.value })}
                placeholder="Note (optional), e.g. 1 onion taken as 150 g"
                aria-label="Note"
              />
            </li>
          );
        })}
      </ol>
      <button className="btn" onClick={addLine}>
        <Icon name="plus" /> Add ingredient
      </button>
      {error && <p className="form-error">{error}</p>}

      {creatingFor && (
        <ProductEditor
          product={null}
          usedIn={0}
          onClose={() => setCreatingFor(null)}
          notify={() => {}}
          onCreated={(p) => {
            const line = draft.lines.find((l) => l.id === creatingFor);
            setLine(creatingFor, { productKey: p.key, qty: line?.qty ?? guessQty(line?.text ?? "", p.unit) });
          }}
        />
      )}
    </Modal>
  );
}

function ProductPicker({
  id,
  products,
  popularity,
  value,
  initialQuery,
  onPick,
  onCreate,
}: {
  id: string;
  products: Product[];
  popularity: Map<string, number>;
  value?: string;
  initialQuery: string;
  onPick: (p: Product) => void;
  onCreate: () => void;
}) {
  const selected = value ? products.find((p) => p.key === value) : undefined;
  const [query, setQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = query != null;

  const matches = useMemo(() => {
    if (query == null) return [];
    const words = (query || initialQuery)
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !["cup", "cups", "tbsp", "tsp", "the", "and", "for", "fresh", "chopped", "diced", "sliced", "optional"].includes(w));
    if (!words.length) return products.slice(0, 40);
    const scored = products
      .map((p) => {
        const name = p.name.toLowerCase();
        const score = words.reduce((s, w) => s + (name.includes(w) ? 2 : name.includes(w.replace(/e?s$/, "")) ? 1 : 0), 0);
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (popularity.get(b.p.key) ?? 0) - (popularity.get(a.p.key) ?? 0) || a.p.name.localeCompare(b.p.name));
    return scored.slice(0, 40).map((x) => x.p);
  }, [query, initialQuery, products, popularity]);

  return (
    <div className="combo">
      <input
        id={id}
        ref={inputRef}
        className="input"
        value={isOpen ? query : (selected?.name ?? "")}
        placeholder="Search Woolworths products…"
        aria-label="Woolworths product"
        aria-expanded={isOpen}
        role="combobox"
        onFocus={() => setQuery("")}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) {
            onPick(matches[0]);
            inputRef.current?.blur();
          }
          if (e.key === "Escape") inputRef.current?.blur();
        }}
      />
      {isOpen && (
        <ul className="combo-list" role="listbox">
          {query === "" && initialQuery && matches.length > 0 && <li className="combo-hint">Suggestions for “{initialQuery}”</li>}
          {matches.map((p) => (
            <li key={p.key} role="option" aria-selected={p.key === value}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(p);
                  inputRef.current?.blur();
                }}
              >
                <span>{p.name}</span>
                <span className="num muted">{rand(p.today)}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="combo-hint">No match. Try another word, or add it below.</li>}
          <li>
            <button
              type="button"
              className="combo-create"
              onMouseDown={(e) => {
                e.preventDefault();
                inputRef.current?.blur();
                onCreate();
              }}
            >
              <Icon name="plus" size={16} /> Add a new product
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

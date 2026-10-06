import { useMemo, useRef, useState } from "react";
import type { Open } from "../App";
import { onPromotion, priceOf } from "../lib/costing";
import { parseCsv, toCsv } from "../lib/csv";
import { today } from "../lib/dates";
import { packLabel, rand, shortDate, slugify } from "../lib/format";
import { saveFile } from "../lib/storage";
import { editState, seed, seedProductKeys, useApp } from "../lib/store";
import type { Product } from "../types";
import { ConfirmButton, Icon, Modal, NumberField } from "./ui";

type Filter = "all" | "promo" | "mine" | "unused" | "planned";

export function unitPrice(p: Product, price: number | null): string {
  if (price == null || !p.packSize) return "–";
  const per = price / p.packSize;
  if (p.unit === "g") return `${rand(per * 1000)}/kg`;
  if (p.unit === "ml") return `${rand(per * 1000)}/L`;
  return `${rand(per)}/${p.unit}`;
}

export function PricesView({ open }: { open: Open }) {
  const { catalog, data, actions, canEditBook } = useApp();
  const [q, setQ] = useState("");
  const [section, setSection] = useState("All");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const usage = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of catalog.recipeList)
      for (const l of r.lines)
        if (l.productKey) {
          const s = m.get(l.productKey) ?? new Set();
          s.add(r.id);
          m.set(l.productKey, s);
        }
    return m;
  }, [catalog]);

  const planned = useMemo(() => {
    const t = today();
    const ids = new Set(data.plan.filter((e) => e.date >= t).map((e) => e.recipeId));
    const keys = new Set<string>();
    for (const [key, recipes] of usage) for (const id of recipes) if (ids.has(id)) keys.add(key);
    return keys;
  }, [data.plan, usage]);

  const sections = useMemo(() => [...new Set(catalog.productList.map((p) => p.section))].sort(), [catalog]);
  const edited = Object.keys(data.productEdits).length;
  const promos = catalog.productList.filter(onPromotion).length;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalog.productList
      .filter((p) => {
        if (section !== "All" && p.section !== section) return false;
        if (filter === "promo" && !onPromotion(p)) return false;
        if (filter === "mine" && !(p.key in data.productEdits)) return false;
        if (filter === "unused" && usage.has(p.key)) return false;
        if (filter === "planned" && !planned.has(p.key)) return false;
        return !needle || p.name.toLowerCase().includes(needle) || p.key.includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, q, section, filter, data.productEdits, usage, planned]);

  const exportCsv = async () => {
    const rows = catalog.productList.map((p) => ({
      Key: p.key,
      Product: p.name,
      Section: p.section,
      "Pack size": p.packSize ?? "",
      Unit: p.unit,
      "Shelf price (R)": p.today ?? "",
      "Regular price (R)": p.regular ?? "",
      "Price checked": p.updated,
      Link: p.link,
      Note: p.note,
    }));
    const ok = await saveFile(`woolworths-prices-${today()}.csv`, toCsv(rows), "text/csv");
    if (!ok) open.notify("Downloads aren't available here.");
  };

  const importCsv = async (file: File) => {
    const rows = parseCsv(await file.text());
    const num = (s: string | undefined) => {
      if (s == null || s.trim() === "") return undefined;
      const n = Number(s.replace(/[R\s]/g, "").replace(",", "."));
      return Number.isFinite(n) ? n : undefined;
    };
    let updated = 0;
    let added = 0;
    let skipped = 0;
    const date = today();
    for (const row of rows) {
      const key = row["Key"] || (row["Product"] ? slugify(row["Product"]).replace(/-/g, "_") : "");
      if (!key) {
        skipped++;
        continue;
      }
      const existing = catalog.products.get(key);
      const todayPrice = num(row["Shelf price (R)"] ?? row["Today's price (R)"]);
      const regular = num(row["Regular price (R)"]);
      if (existing) {
        const next: Product = {
          ...existing,
          name: row["Product"] || existing.name,
          section: row["Section"] || existing.section,
          packSize: num(row["Pack size"]) ?? existing.packSize,
          unit: row["Unit"] || existing.unit,
          today: todayPrice ?? existing.today,
          regular: regular ?? existing.regular,
          link: row["Link"] ?? existing.link,
          note: row["Note"] ?? existing.note,
        };
        const priceChanged = next.today !== existing.today || next.regular !== existing.regular;
        if (JSON.stringify(next) !== JSON.stringify(existing)) {
          actions.saveProduct({ ...next, updated: priceChanged ? row["Price checked"] || date : existing.updated });
          updated++;
        }
      } else if (row["Product"]) {
        actions.saveProduct({
          key,
          name: row["Product"],
          section: row["Section"] || "Pantry",
          packSize: num(row["Pack size"]) ?? 1,
          unit: row["Unit"] || "ea",
          today: todayPrice ?? null,
          regular: regular ?? todayPrice ?? null,
          link: row["Link"] ?? "",
          note: row["Note"] ?? "",
          updated: row["Price checked"] || date,
        });
        added++;
      } else skipped++;
    }
    open.notify(`Updated ${updated} product${updated === 1 ? "" : "s"}, added ${added}${skipped ? `, skipped ${skipped} rows` : ""}.`);
  };

  const setPrice = (p: Product, field: "today" | "regular", value: number | null) => {
    actions.updatePrice(p.key, field, value, today());
  };

  return (
    <section className="view">
      <div className="view-head">
        <div>
          <h1>Woolworths prices</h1>
          <p className="lede">
            {catalog.productList.length} products. Prices captured {shortDate(seed.pricesCaptured)}
            {edited > 0 && <>; {edited} updated since</>}.{" "}
            {canEditBook ? "Type a new price and every recipe, plan and list updates." : "Prices are kept up to date by the owner."}
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={exportCsv}>
            <Icon name="download" /> Export CSV
          </button>
          {canEditBook && (
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" /> Import CSV
            </button>
          )}
          <input
            ref={fileRef}
            id="price-import"
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
              e.target.value = "";
            }}
          />
          {canEditBook && (
            <button className="btn btn-primary" onClick={() => setEditing("new")}>
              <Icon name="plus" /> Add product
            </button>
          )}
        </div>
      </div>

      <div className="basis-bar">
        <span className="field-label">Cost recipes using</span>
        <div className="seg" role="group" aria-label="Price basis">
          <button className={catalog.basis === "today" ? "active" : ""} onClick={() => actions.setPriceBasis("today")}>
            Shelf price (with promos)
          </button>
          <button className={catalog.basis === "regular" ? "active" : ""} onClick={() => actions.setPriceBasis("regular")}>
            Regular price
          </button>
        </div>
        <span className="hint">{promos} products are on promotion.</span>
      </div>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" />
          <input id="price-search" type="search" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select id="price-section" className="input" value={section} onChange={(e) => setSection(e.target.value)} aria-label="Section">
          <option>All</option>
          {sections.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select id="price-filter" className="input" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Show">
          <option value="all">All products</option>
          <option value="planned">In upcoming meals</option>
          <option value="promo">On promotion</option>
          <option value="mine">Changed by me</option>
          <option value="unused">Not in any recipe</option>
        </select>
      </div>

      <div className="price-list" role="table" aria-label="Products">
        <div className="price-row price-head" role="row">
          <span role="columnheader">Product</span>
          <span role="columnheader">Pack</span>
          <span role="columnheader">Shelf price</span>
          <span role="columnheader">Regular</span>
          <span role="columnheader">Unit price</span>
          <span role="columnheader">Checked</span>
          <span role="columnheader" className="sr-only">
            Edit
          </span>
        </div>
        {shown.map((p) => {
          const state = editState(data.productEdits, seedProductKeys, p.key);
          const used = usage.get(p.key)?.size ?? 0;
          return (
            <div key={p.key} className={`price-row${onPromotion(p) ? " is-promo" : ""}`} role="row">
              <span className="p-name" role="cell">
                <span className="p-title">
                  {p.link ? (
                    <a href={p.link} target="_blank" rel="noreferrer" title="Open on woolworths.co.za">
                      {p.name}
                    </a>
                  ) : (
                    p.name
                  )}
                  {onPromotion(p) && <span className="flag flag-promo">Promo</span>}
                  {state && <span className={`badge badge-${state}`}>{state === "new" ? "Yours" : "Edited"}</span>}
                </span>
                <span className="p-sub">
                  {p.section} · {used ? `${used} recipe${used > 1 ? "s" : ""}` : "not in any recipe"}
                  {p.note && ` · ${p.note}`}
                </span>
              </span>
              <span className="p-pack num" role="cell">
                {packLabel(p.packSize, p.unit)}
              </span>
              <span className="p-price" role="cell">
                <span className="cell-label">Shelf</span>
                {canEditBook ? (
                  <span className="money-input">
                    <span>R</span>
                    <NumberField id={`today-${p.key}`} value={p.today} onCommit={(n) => setPrice(p, "today", n)} ariaLabel={`Shelf price for ${p.name}`} />
                  </span>
                ) : (
                  <span className="num">{rand(p.today)}</span>
                )}
              </span>
              <span className="p-price" role="cell">
                <span className="cell-label">Regular</span>
                {canEditBook ? (
                  <span className="money-input">
                    <span>R</span>
                    <NumberField id={`regular-${p.key}`} value={p.regular} onCommit={(n) => setPrice(p, "regular", n)} ariaLabel={`Regular price for ${p.name}`} />
                  </span>
                ) : (
                  <span className="num">{rand(p.regular)}</span>
                )}
              </span>
              <span className="p-unit num" role="cell">
                {unitPrice(p, priceOf(p, catalog.basis))}
              </span>
              <span className={`p-date${p.updated !== seed.pricesCaptured ? " is-new" : ""}`} role="cell">
                {shortDate(p.updated)}
              </span>
              <span role="cell" className="p-edit">
                {canEditBook && (
                  <button className="icon-btn" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                    <Icon name="edit" />
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {shown.length === 0 && <p className="muted pad">No products match.</p>}
      </div>

      {editing && (
        <ProductEditor
          product={editing === "new" ? null : editing}
          usedIn={editing === "new" ? 0 : (usage.get(editing.key)?.size ?? 0)}
          onClose={() => setEditing(null)}
          notify={open.notify}
        />
      )}
    </section>
  );
}

const UNITS = ["g", "ml", "ea", "punnet", "bunch", "clove", "slice", "stick", "nest"];

export function ProductEditor({
  product,
  usedIn,
  onClose,
  notify,
  onCreated,
}: {
  product: Product | null;
  usedIn: number;
  onClose: () => void;
  notify: (m: string) => void;
  onCreated?: (p: Product) => void;
}) {
  const { catalog, data, actions } = useApp();
  const isNew = !product;
  const [draft, setDraft] = useState<Product>(
    product ?? { key: "", name: "", today: null, regular: null, packSize: null, unit: "g", note: "", link: "", section: "Pantry", updated: today() },
  );
  const [error, setError] = useState("");
  const sections = [...new Set(catalog.productList.map((p) => p.section))].sort();
  const set = (patch: Partial<Product>) => setDraft((d) => ({ ...d, ...patch }));
  const state = product ? editState(data.productEdits, seedProductKeys, product.key) : null;

  const save = () => {
    const name = draft.name.trim();
    if (!name) return setError("Give the product a name.");
    if (!draft.packSize || draft.packSize <= 0) return setError("Enter the pack size, e.g. 500 for a 500 g pack.");
    let key = draft.key;
    if (isNew) {
      const base = slugify(name).replace(/-/g, "_") || "product";
      key = base;
      let n = 2;
      while (catalog.products.has(key)) key = `${base}_${n++}`;
    }
    const priceChanged = !product || product.today !== draft.today || product.regular !== draft.regular;
    const next: Product = {
      ...draft,
      key,
      name,
      regular: draft.regular ?? draft.today,
      updated: priceChanged ? today() : draft.updated,
    };
    actions.saveProduct(next);
    notify(isNew ? `Added ${name}` : `Saved ${name}`);
    onCreated?.(next);
    onClose();
  };

  return (
    <Modal
      title={isNew ? "Add a product" : "Edit product"}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <div className="foot-left">
              {state === "edited" && (
                <ConfirmButton
                  onConfirm={() => {
                    actions.resetProduct(product!.key);
                    notify("Restored the spreadsheet values");
                    onClose();
                  }}
                >
                  Undo my changes
                </ConfirmButton>
              )}
              {usedIn === 0 && (
                <ConfirmButton
                  onConfirm={() => {
                    actions.deleteProduct(product!.key);
                    notify(`Deleted ${product!.name}`);
                    onClose();
                  }}
                >
                  <Icon name="trash" /> Delete
                </ConfirmButton>
              )}
            </div>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            {isNew ? "Add product" : "Save"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field span-2">
          <span className="field-label">Product name, as on woolworths.co.za</span>
          <input id="product-name" className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Plain South African Feta Cheese 100 g" autoFocus={isNew} />
        </label>
        <label className="field">
          <span className="field-label">Pack size</span>
          <NumberField id="product-pack" value={draft.packSize} onCommit={(n) => set({ packSize: n })} placeholder="500" />
        </label>
        <label className="field">
          <span className="field-label">Measured in</span>
          <input id="product-unit" className="input" list="unit-options" value={draft.unit} onChange={(e) => set({ unit: e.target.value.trim() })} />
          <datalist id="unit-options">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </label>
        <p className="hint span-2">
          Recipes enter amounts in this unit. A 500 g pack is <strong>500</strong> + <strong>g</strong>; a 6-pack of eggs is <strong>6</strong> + <strong>ea</strong>.
        </p>
        <label className="field">
          <span className="field-label">Shelf price (R)</span>
          <NumberField id="product-today" value={draft.today} onCommit={(n) => set({ today: n })} placeholder="0.00" />
        </label>
        <label className="field">
          <span className="field-label">Regular price (R)</span>
          <NumberField id="product-regular" value={draft.regular} onCommit={(n) => set({ regular: n })} placeholder="Same as shelf" />
        </label>
        <label className="field">
          <span className="field-label">Shop section</span>
          <input id="product-section" className="input" list="section-options" value={draft.section} onChange={(e) => set({ section: e.target.value })} />
          <datalist id="section-options">
            {sections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span className="field-label">Link (optional)</span>
          <input id="product-link" className="input" value={draft.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://www.woolworths.co.za/…" />
        </label>
        <label className="field span-2">
          <span className="field-label">Note (optional)</span>
          <input id="product-note" className="input" value={draft.note} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. 1 onion taken as 150 g" />
        </label>
        {!isNew && usedIn > 0 && <p className="hint span-2">Used in {usedIn} recipe{usedIn > 1 ? "s" : ""}, so it can't be deleted.</p>}
        {error && <p className="form-error span-2">{error}</p>}
      </div>
    </Modal>
  );
}

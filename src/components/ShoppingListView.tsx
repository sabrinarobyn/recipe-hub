import { useMemo, useState } from "react";
import type { Open } from "../App";
import { buildShoppingList, onPromotion, priceOf, type LooseItem, type ShoppingItem } from "../lib/costing";
import { addDays, weekLabel } from "../lib/dates";
import { packLabel, qty, rand, shortDate, uid } from "../lib/format";
import { toCsv } from "../lib/csv";
import { saveFile } from "../lib/storage";
import { emptyList, seed, useApp } from "../lib/store";
import { WeekSwitch } from "./PlanView";
import { Icon, NumberField } from "./ui";

export function ShoppingListView({ open, week, setWeek }: { open: Open; week: string; setWeek: (w: string) => void }) {
  const { data, catalog, actions } = useApp();
  const end = addDays(week, 6);
  const entries = useMemo(
    () => data.plan.filter((e) => e.date >= week && e.date <= end && catalog.recipes.has(e.recipeId)),
    [data.plan, week, end, catalog],
  );
  const list = useMemo(() => buildShoppingList(entries, catalog), [entries, catalog]);
  const wl = data.lists[week] ?? emptyList();
  const have = new Set(wl.have);
  const got = new Set(wl.got);
  const [extraText, setExtraText] = useState("");
  const [extraPrice, setExtraPrice] = useState<number | null>(null);

  const haveSaving = list.items.filter((i) => have.has(i.product.key)).reduce((s, i) => s + (i.cost ?? 0), 0);
  const extrasTotal = wl.extras.reduce((s, x) => s + (x.price ?? 0), 0);
  const estimate = list.total - haveSaving + extrasTotal;
  const toBuy = list.items.filter((i) => !have.has(i.product.key));
  const remaining = toBuy.filter((i) => !got.has(i.product.key)).length + wl.extras.filter((x) => !got.has(x.id)).length;

  const sections = useMemo(() => {
    const m = new Map<string, ShoppingItem[]>();
    for (const item of list.items) {
      const arr = m.get(item.product.section) ?? [];
      arr.push(item);
      m.set(item.product.section, arr);
    }
    return [...m.entries()];
  }, [list]);

  const toggle = (field: "have" | "got", key: string) =>
    actions.updateList(week, (l) => ({
      ...l,
      [field]: l[field].includes(key) ? l[field].filter((k) => k !== key) : [...l[field], key],
    }));

  const addExtra = () => {
    const text = extraText.trim();
    if (!text) return;
    actions.updateList(week, (l) => ({ ...l, extras: [...l.extras, { id: uid(), text, price: extraPrice }] }));
    setExtraText("");
    setExtraPrice(null);
  };

  const asText = () => {
    const lines = [`Shopping list, ${weekLabel(week)} (estimate ${rand(estimate)})`, ""];
    for (const [section, items] of sections) {
      const buy = items.filter((i) => !have.has(i.product.key));
      if (!buy.length) continue;
      lines.push(section.toUpperCase());
      for (const i of buy) lines.push(`☐ ${i.product.name}${i.packs > 1 ? ` ×${i.packs}` : ""}  ${rand(i.cost)}`);
      lines.push("");
    }
    if (wl.extras.length) {
      lines.push("EXTRAS");
      for (const x of wl.extras) lines.push(`☐ ${x.text}${x.price != null ? `  ${rand(x.price)}` : ""}`);
      lines.push("");
    }
    const basics = uniqueTexts(list.basics);
    if (basics.length) lines.push(`Check the pantry for: ${basics.join(", ")}`);
    return lines.join("\n").trim();
  };

  const copy = async () => {
    const text = asText();
    try {
      await navigator.clipboard.writeText(text);
      open.notify("Copied the list. Paste it into WhatsApp or Notes.");
    } catch {
      setShowText(text);
    }
  };
  const [showText, setShowText] = useState<string | null>(null);

  const downloadCsv = async () => {
    const rows = toBuy.map((i) => ({
      Section: i.product.section,
      Product: i.product.name,
      Needed: qty(i.qty, i.product.unit),
      Packs: i.packs,
      "Pack price (R)": priceOf(i.product, catalog.basis)?.toFixed(2) ?? "",
      "Cost (R)": i.cost?.toFixed(2) ?? "",
      For: [...new Set(i.uses.map((u) => catalog.recipes.get(u.recipeId)?.name))].join("; "),
    }));
    for (const x of wl.extras) rows.push({ Section: "Extras", Product: x.text, Needed: "", Packs: 1, "Pack price (R)": "", "Cost (R)": x.price?.toFixed(2) ?? "", For: "" });
    const ok = await saveFile(`shopping-list-${week}.csv`, toCsv(rows), "text/csv");
    if (!ok) open.notify("Downloads aren't available here. Use Copy list instead.");
  };

  if (entries.length === 0) {
    return (
      <section className="view">
        <div className="view-head">
          <div>
            <h1>Shopping list</h1>
            <WeekSwitch week={week} setWeek={setWeek} />
          </div>
        </div>
        <div className="empty">
          <p>Plan some meals for {weekLabel(week)} and your costed shopping list appears here.</p>
          <button className="btn btn-primary" onClick={() => open.goTo("plan")}>
            Go to meal plan
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="view">
      <div className="view-head">
        <div>
          <h1>Shopping list</h1>
          <WeekSwitch week={week} setWeek={setWeek} />
        </div>
        <div className="head-actions">
          <button className="btn" onClick={copy}>
            <Icon name="copy" /> Copy list
          </button>
          <button className="btn" onClick={downloadCsv}>
            <Icon name="download" /> CSV
          </button>
        </div>
      </div>

      <div className="list-layout">
        <aside className="receipt" aria-label="Estimate">
          <p className="receipt-title">Estimate · {weekLabel(week)}</p>
          <dl>
            <div>
              <dt>{list.items.length} products, full packs</dt>
              <dd>{rand(list.total)}</dd>
            </div>
            {haveSaving > 0 && (
              <div>
                <dt>Already at home ({have.size})</dt>
                <dd>−{rand(haveSaving)}</dd>
              </div>
            )}
            {extrasTotal > 0 && (
              <div>
                <dt>Extras</dt>
                <dd>{rand(extrasTotal)}</dd>
              </div>
            )}
          </dl>
          <div className="receipt-total">
            <span>To spend</span>
            <span>{rand(estimate)}</span>
          </div>
          <p className="receipt-note">
            The recipes use about {rand(list.usedTotal)} of this. The rest stays in your cupboard for next time.
          </p>
          <p className="receipt-note">
            {catalog.basis === "today" ? "Shelf prices incl. promotions" : "Regular prices (no promotions)"}. Prices from{" "}
            woolworths.co.za, {shortDate(seed.pricesCaptured)}, unless you've updated them.
          </p>
          <p className="receipt-progress">
            {remaining === 0 ? "All ticked off" : `${remaining} left to pick up`}
            {got.size > 0 && (
              <button className="text-link" onClick={() => actions.updateList(week, (l) => ({ ...l, got: [] }))}>
                Untick all
              </button>
            )}
          </p>
          {list.unpriced > 0 && <p className="flag flag-bad">{list.unpriced} item(s) have no price yet</p>}
        </aside>

        <div className="list-body">
          {sections.map(([section, items]) => (
            <div key={section} className="list-section">
              <h2 className="section-title">{section}</h2>
              <ul className="items">
                {items.map((item) => {
                  const k = item.product.key;
                  const isHave = have.has(k);
                  const isGot = got.has(k);
                  const recipes = [...new Set(item.uses.map((u) => u.recipeId))].map((id) => catalog.recipes.get(id)!);
                  return (
                    <li key={k} className={`item${isHave ? " is-have" : ""}${isGot ? " is-got" : ""}`}>
                      <label className="check">
                        <input id={`got-${k}`} type="checkbox" checked={isGot} disabled={isHave} onChange={() => toggle("got", k)} />
                        <span className="sr-only">In trolley</span>
                      </label>
                      <div className="item-main">
                        <span className="item-name">
                          {item.product.name}
                          {onPromotion(item.product) && <span className="flag flag-promo">Promo</span>}
                        </span>
                        <span className="item-sub">
                          Need {qty(item.qty, item.product.unit)}
                          {item.product.packSize && item.product.packSize !== 1
                            ? ` · ${item.packs} × ${packLabel(item.product.packSize, item.product.unit)}`
                            : ""}{" "}
                          · {rand(priceOf(item.product, catalog.basis))} each
                        </span>
                        <span className="item-for">
                          For{" "}
                          {recipes.map((r, i) => (
                            <span key={r.id}>
                              {i > 0 && ", "}
                              <button className="text-link" onClick={() => open.recipe(r.id)}>
                                {r.name}
                              </button>
                            </span>
                          ))}
                        </span>
                      </div>
                      <div className="item-end">
                        <span className="item-cost num">{isHave ? "–" : rand(item.cost)}</span>
                        <button className={`have-btn${isHave ? " active" : ""}`} onClick={() => toggle("have", k)} aria-pressed={isHave}>
                          {isHave ? "At home" : "Have it?"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="list-section">
            <h2 className="section-title">Extras</h2>
            <ul className="items">
              {wl.extras.map((x) => (
                <li key={x.id} className={`item${got.has(x.id) ? " is-got" : ""}`}>
                  <label className="check">
                    <input id={`got-${x.id}`} type="checkbox" checked={got.has(x.id)} onChange={() => toggle("got", x.id)} />
                    <span className="sr-only">In trolley</span>
                  </label>
                  <div className="item-main">
                    <span className="item-name">{x.text}</span>
                  </div>
                  <div className="item-end">
                    <span className="item-cost num">{x.price != null ? rand(x.price) : ""}</span>
                    <button
                      className="icon-btn"
                      aria-label={`Remove ${x.text}`}
                      onClick={() => actions.updateList(week, (l) => ({ ...l, extras: l.extras.filter((e) => e.id !== x.id) }))}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <form
              className="extra-form"
              onSubmit={(e) => {
                e.preventDefault();
                addExtra();
              }}
            >
              <input id="extra-text" className="input" placeholder="Add something else (e.g. dishwasher tabs)" value={extraText} onChange={(e) => setExtraText(e.target.value)} />
              <NumberField id="extra-price" className="input input-price" value={extraPrice} onCommit={setExtraPrice} placeholder="R (optional)" ariaLabel="Price" />
              <button className="btn" type="submit">
                <Icon name="plus" /> Add
              </button>
            </form>
          </div>

          <LooseSection title="Check the pantry" hint="Basics the recipes don't cost, like salt and pepper." items={list.basics} open={open} />
          <LooseSection title="Not at Woolworths" hint="Buy these somewhere else." items={list.missing} open={open} warn />
          <LooseSection title="Not costed yet" hint="These lines have no product or amount. Edit the recipe to fix them." items={list.problems} open={open} warn />
        </div>
      </div>

      {showText && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowText(null)}>
          <div className="modal" role="dialog" aria-modal="true">
            <header className="modal-head">
              <h2>Copy your list</h2>
              <button className="icon-btn" onClick={() => setShowText(null)} aria-label="Close">
                <Icon name="close" />
              </button>
            </header>
            <div className="modal-body">
              <p className="hint">Copying isn't allowed here, so select the text below and copy it.</p>
              <textarea id="list-text" className="input copy-area" readOnly value={showText} onFocus={(e) => e.target.select()} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function uniqueTexts(items: LooseItem[]): string[] {
  return [...new Set(items.map((i) => (i.note && i.note.length < 30 ? i.note : i.text)))];
}

function LooseSection({ title, hint, items, open, warn }: { title: string; hint: string; items: LooseItem[]; open: Open; warn?: boolean }) {
  const { catalog } = useApp();
  if (!items.length) return null;
  const grouped = new Map<string, Set<string>>();
  for (const i of items) {
    const label = i.note && i.note.length < 30 ? i.note : i.text;
    const set = grouped.get(label) ?? new Set();
    set.add(i.recipeId);
    grouped.set(label, set);
  }
  return (
    <div className={`list-section loose${warn ? " loose-warn" : ""}`}>
      <h2 className="section-title">{title}</h2>
      <p className="hint">{hint}</p>
      <ul className="loose-list">
        {[...grouped.entries()].map(([label, ids]) => (
          <li key={label}>
            <span>{label}</span>
            <span className="muted">
              {[...ids].map((id, i) => (
                <span key={id}>
                  {i > 0 && ", "}
                  <button className="text-link" onClick={() => open.recipe(id)}>
                    {catalog.recipes.get(id)?.name}
                  </button>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

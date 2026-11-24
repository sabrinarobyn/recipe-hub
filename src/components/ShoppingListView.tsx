import { useMemo, useState } from "react";
import type { Open } from "../App";
import { compareStores, STORE_NAMES, type LooseItem, type ShoppingItem } from "../lib/costing";
import { addDays, today, weekLabel } from "../lib/dates";
import { tickGot, untickGot, untickWeek, weekNetting } from "../lib/kitchen";
import { packLabel, qty, rand, shortDate, uid } from "../lib/format";
import { toCsv } from "../lib/csv";
import { saveFile } from "../lib/storage";
import { emptyList, seed, useApp } from "../lib/store";
import { WeekSwitch } from "./PlanView";
import { Icon, NumberField } from "./ui";
import { Sticker } from "./Brand";

export function ShoppingListView({ open, week, setWeek }: { open: Open; week: string; setWeek: (w: string) => void }) {
  const { data, catalog, actions } = useApp();
  const end = addDays(week, 6);
  const entries = useMemo(
    () => data.plan.filter((e) => e.date >= week && e.date <= end && catalog.recipes.has(e.recipeId)),
    [data.plan, week, end, catalog],
  );
  const wl = data.lists[week] ?? emptyList();
  // The Pantry before this week's own Got, so ticking Got doesn't take an item off its own list.
  const netting = useMemo(() => weekNetting(data.pantry, week, wl), [data.pantry, week, wl]);
  const comparison = useMemo(() => compareStores(entries, catalog, netting), [entries, catalog, netting]);
  const store = catalog.store ?? "woolworths";
  const other = store === "checkers" ? "woolworths" : "checkers";
  const list = comparison[store];
  const got = new Set(wl.got);
  const [extraText, setExtraText] = useState("");
  const [extraPrice, setExtraPrice] = useState<number | null>(null);

  const extrasTotal = wl.extras.reduce((s, x) => s + (x.price ?? 0), 0);
  const estimate = list.total + extrasTotal;
  const toBuy = list.items.filter((i) => !i.coveredByPantry);
  const covered = useMemo(() => new Set(list.items.filter((i) => i.coveredByPantry).map((i) => i.product.key)), [list]);
  const fromPantry = list.items.filter((i) => i.fromPantry > 0).length;
  // Both stores and the cheapest-of-each total, for what's still to buy.
  const cmp = useMemo(() => {
    let w = 0;
    let c = 0;
    let split = 0;
    let fromCheckers = 0;
    let notAtCheckers = 0;
    for (const [key, row] of comparison.byProduct) {
      if (covered.has(key)) continue;
      const ww = row.woolworths ?? 0;
      w += ww;
      if (row.checkers == null) notAtCheckers++;
      c += row.checkers ?? ww;
      if (row.checkers != null && row.checkers < ww) {
        split += row.checkers;
        fromCheckers++;
      } else split += ww;
    }
    return { w: w + extrasTotal, c: c + extrasTotal, split: split + extrasTotal, fromCheckers, notAtCheckers };
  }, [comparison, covered, extrasTotal]);
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

  /** "Buy anyway" ignores the Pantry for one item; pressing it again goes back to using the Pantry. */
  const toggleBuyAnyway = (key: string) =>
    actions.updateList(week, (l) => {
      const keys = l.buyAnyway ?? [];
      return { ...l, buyAnyway: keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key] };
    });

  /** Ticking Got puts a Product into the Pantry; un-ticking takes exactly that back out. Extras stay out. */
  const toggleGot = (key: string) =>
    actions.updateListAndPantry(week, (l, history) =>
      l.got.includes(key)
        ? [{ ...l, got: l.got.filter((k) => k !== key) }, untickGot(history, week, key)]
        : [{ ...l, got: [...l.got, key] }, tickGot(history, week, list, key, today())],
    );

  const addExtra = () => {
    const text = extraText.trim();
    if (!text) return;
    actions.updateList(week, (l) => ({ ...l, extras: [...l.extras, { id: uid(), text, price: extraPrice }] }));
    setExtraText("");
    setExtraPrice(null);
  };

  const asText = () => {
    const lines = [`Shopping list, ${weekLabel(week)}, ${STORE_NAMES[store]} (estimate ${rand(estimate)})`, ""];
    for (const [section, items] of sections) {
      const buy = items.filter((i) => !i.coveredByPantry);
      if (!buy.length) continue;
      lines.push(section.toUpperCase());
      for (const i of buy) lines.push(`☐ ${i.offer.name}${i.packs > 1 ? ` ×${i.packs}` : ""}  ${rand(i.cost)}`);
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
      Store: STORE_NAMES[i.offer.store],
      Product: i.offer.name,
      Needed: qty(i.toBuy, i.product.unit),
      Packs: i.packs,
      "Pack price (R)": i.offer.price?.toFixed(2) ?? "",
      "Cost (R)": i.cost?.toFixed(2) ?? "",
      For: [...new Set(i.uses.map((u) => catalog.recipes.get(u.recipeId)?.name))].join("; "),
    }));
    for (const x of wl.extras) rows.push({ Section: "Extras", Store: "", Product: x.text, Needed: "", Packs: 1, "Pack price (R)": "", "Cost (R)": x.price?.toFixed(2) ?? "", For: "" });
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
          <Sticker name="tomato" size={64} />
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
          <p className="receipt-title">
            {STORE_NAMES[store]} · {weekLabel(week)}
          </p>
          <dl>
            <div>
              <dt>{toBuy.length} products, full packs</dt>
              <dd>{rand(list.total)}</dd>
            </div>
            {fromPantry > 0 && (
              <div>
                <dt>From your Pantry</dt>
                <dd>
                  {fromPantry} item{fromPantry === 1 ? "" : "s"}
                </dd>
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
            The recipes use about {rand(list.usedTotal)} of this. Whatever you tick Got goes into your Pantry.
          </p>
          <div className="compare">
            <p className="compare-title">Same list at each store</p>
            <dl>
              <div className={store === "woolworths" ? "is-current" : ""}>
                <dt>Woolworths</dt>
                <dd>{rand(cmp.w)}</dd>
              </div>
              <div className={store === "checkers" ? "is-current" : ""}>
                <dt>
                  Checkers
                  {cmp.notAtCheckers > 0 && <span className="compare-note"> ({cmp.notAtCheckers} at Woolworths price)</span>}
                </dt>
                <dd>{rand(cmp.c)}</dd>
              </div>
              <div className="compare-split">
                <dt>
                  Cheapest of each
                  <span className="compare-note"> ({cmp.fromCheckers} from Checkers)</span>
                </dt>
                <dd>{rand(cmp.split)}</dd>
              </div>
            </dl>
            {Math.abs(cmp.w - cmp.c) >= 1 && (
              <p className="compare-verdict">
                {cmp.c < cmp.w ? "Checkers" : "Woolworths"} is {rand(Math.abs(cmp.w - cmp.c))} cheaper for this list.
              </p>
            )}
          </div>
          <p className="receipt-note">
            {catalog.basis === "today" ? "Shelf prices incl. promotions" : "Regular prices (no promotions)"}. Woolworths prices from{" "}
            woolworths.co.za, {shortDate(seed.pricesCaptured)}; Checkers prices from checkers.co.za listings,{" "}
            {shortDate(seed.checkersCaptured ?? seed.pricesCaptured)}, unless you've updated them.
          </p>
          <p className="receipt-progress">
            {remaining === 0 ? "All ticked off" : `${remaining} left to pick up`}
            {got.size > 0 && (
              <button className="text-link" onClick={() => actions.updateListAndPantry(week, (l, history) => [{ ...l, got: [] }, untickWeek(history, week)])}>
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
                  const isCovered = item.coveredByPantry;
                  const isGot = got.has(k) && !isCovered;
                  const inPantry = netting.pantry.get(k)?.amount ?? 0;
                  const recipes = [...new Set(item.uses.map((u) => u.recipeId))].map((id) => catalog.recipes.get(id)!);
                  const row = comparison.byProduct.get(k);
                  const otherCost = other === "checkers" ? row?.checkers : row?.woolworths;
                  const cheaperElsewhere = otherCost != null && item.cost != null && otherCost < item.cost - 0.005;
                  return (
                    <li key={k} className={`item${isCovered ? " is-covered" : ""}${isGot ? " is-got" : ""}`}>
                      <label className="check">
                        <input id={`got-${k}`} type="checkbox" checked={isGot} disabled={isCovered} onChange={() => toggleGot(k)} />
                        <span className="sr-only">In trolley</span>
                      </label>
                      <div className="item-main">
                        <span className="item-name">
                          {item.offer.name}
                          {item.offer.promo && <span className="flag flag-promo">Promo</span>}
                          {item.offer.fallback && <span className="flag flag-warn">Woolworths item</span>}
                        </span>
                        <span className="item-sub">
                          {isCovered ? (
                            <>
                              Need {qty(item.qty, item.product.unit)} · covered by your Pantry ({qty(inPantry, item.product.unit)} there)
                            </>
                          ) : (
                            <>
                              {item.fromPantry > 0
                                ? `Need ${qty(item.qty, item.product.unit)}, ${qty(item.fromPantry, item.product.unit)} from your Pantry · buy ${qty(item.toBuy, item.product.unit)}`
                                : `Need ${qty(item.qty, item.product.unit)}`}
                              {item.offer.packSize && item.offer.packSize !== 1
                                ? ` · ${item.packs} × ${packLabel(item.offer.packSize, item.product.unit)}`
                                : ""}{" "}
                              · {rand(item.offer.price)} each
                            </>
                          )}
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
                        <span className="item-cost num">{isCovered ? "In Pantry" : rand(item.cost)}</span>
                        {!isCovered && (
                          <span className={`item-other num${cheaperElsewhere ? " is-cheaper" : ""}`}>
                            {STORE_NAMES[other]} {otherCost != null ? rand(otherCost) : "–"}
                          </span>
                        )}
                        {(item.fromPantry > 0 || item.buyAnyway) && (
                          <button className={`anyway-btn${item.buyAnyway ? " active" : ""}`} onClick={() => toggleBuyAnyway(k)} aria-pressed={item.buyAnyway}>
                            Buy anyway
                          </button>
                        )}
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
                    <input id={`got-${x.id}`} type="checkbox" checked={got.has(x.id)} onChange={() => toggleGot(x.id)} />
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

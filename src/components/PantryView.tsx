import { useMemo, useState } from "react";
import type { Open } from "../App";
import { today } from "../lib/dates";
import { addToPantry, clearPantryItem, correctPantry, type PantryItem } from "../lib/kitchen";
import { qty, shortDate } from "../lib/format";
import { useApp, usePantry } from "../lib/store";
import type { Product } from "../types";
import { ConfirmButton, Icon, NumberField } from "./ui";
import { Sticker } from "./Brand";

/** The Member's private Pantry: what's left of each Product, worked out from their pantry history. */
export function PantryView({ open }: { open: Open }) {
  const { catalog, actions } = useApp();
  const pantry = usePantry();
  const [productKey, setProductKey] = useState("");
  const [amount, setAmount] = useState<number | null>(null);

  const sections = useMemo(() => {
    const m = new Map<string, { item: PantryItem; product: Product }[]>();
    for (const item of pantry.values()) {
      const product = catalog.products.get(item.productKey);
      // A Product deleted from the catalogue has nothing to show.
      if (!product) continue;
      const arr = m.get(product.section) ?? [];
      arr.push({ item, product });
      m.set(product.section, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.product.name.localeCompare(b.product.name));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [pantry, catalog]);

  const products = useMemo(() => [...catalog.productList].sort((a, b) => a.name.localeCompare(b.name)), [catalog]);
  const picked = catalog.products.get(productKey);

  const add = () => {
    if (!picked || !amount || amount <= 0) return;
    actions.updatePantry((h) => addToPantry(h, picked.key, amount, today()));
    open.notify(`Added ${qty(amount, picked.unit)} ${picked.name} to your Pantry`);
    setProductKey("");
    setAmount(null);
  };

  return (
    <section className="view">
      <div className="view-head">
        <div>
          <h1>Pantry</h1>
          <p className="hint">What you have at home. Ticking Got on the Shopping List puts things in. Only you see your Pantry.</p>
        </div>
      </div>

      <form
        className="extra-form pantry-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <select id="pantry-product" className="input" value={productKey} onChange={(e) => setProductKey(e.target.value)} aria-label="Product">
          <option value="">Add a Product by hand…</option>
          {products.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>
        <NumberField
          id="pantry-amount"
          className="input input-price"
          value={amount}
          onCommit={setAmount}
          placeholder={picked ? `Amount (${picked.unit})` : "Amount"}
          ariaLabel="Amount"
        />
        <button className="btn" type="submit" disabled={!picked || !amount || amount <= 0}>
          <Icon name="plus" /> Add
        </button>
      </form>

      {sections.length === 0 ? (
        <div className="empty">
          <Sticker name="tomato" size={64} />
          <p>Your Pantry is empty. Tick items Got on your Shopping List, or add a Product by hand.</p>
          <button className="btn btn-primary" onClick={() => open.goTo("list")}>
            Go to shopping list
          </button>
        </div>
      ) : (
        <div className="list-body">
          {sections.map(([section, rows]) => (
            <div key={section} className="list-section">
              <h2 className="section-title">{section}</h2>
              <ul className="items">
                {rows.map(({ item, product }) => (
                  <PantryRow key={item.productKey} item={item} product={product} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PantryRow({ item, product }: { item: PantryItem; product: Product }) {
  const { actions } = useApp();
  const correct = (n: number | null) => {
    if (n == null || n === item.amount) return;
    actions.updatePantry((h) => correctPantry(h, item.productKey, n, today()));
  };
  return (
    <li className="item pantry-item">
      <div className="item-main">
        <span className="item-name">{product.name}</span>
        <span className="item-sub">
          {qty(item.amount, product.unit)} left · {item.lastGot ? `Got ${shortDate(item.lastGot)}` : "Added by hand"}
        </span>
      </div>
      <div className="item-end pantry-end">
        <NumberField
          id={`pantry-correct-${item.productKey}`}
          className="input input-price"
          value={item.amount}
          onCommit={correct}
          ariaLabel={`Correct the amount of ${product.name} (${product.unit})`}
        />
        <ConfirmButton
          className="icon-btn"
          confirmLabel="Clear?"
          ariaLabel={`Clear ${product.name}`}
          onConfirm={() => actions.updatePantry((h) => clearPantryItem(h, item.productKey, today()))}
        >
          <Icon name="trash" size={16} />
        </ConfirmButton>
      </div>
    </li>
  );
}

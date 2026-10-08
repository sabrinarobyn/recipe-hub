import { STORE_NAMES } from "../lib/costing";
import { useApp } from "../lib/store";
import type { StoreId } from "../types";

const STORES: StoreId[] = ["woolworths", "checkers"];

/** Which store's prices the whole app costs with. Each person picks their own. */
export function StorePicker({ compact }: { compact?: boolean }) {
  const { catalog, actions } = useApp();
  const current = catalog.store ?? "woolworths";
  return (
    <div className={`store-picker${compact ? " compact" : ""}`} role="group" aria-label="Prices from">
      {!compact && <span className="field-label">Prices from</span>}
      <div className="seg">
        {STORES.map((s) => (
          <button key={s} className={current === s ? "active" : ""} aria-pressed={current === s} onClick={() => actions.setStore(s)}>
            {STORE_NAMES[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

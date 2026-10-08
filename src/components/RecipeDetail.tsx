import type { Open } from "../App";
import { lineCost, offerFor, STORE_NAMES, summarizeRecipe } from "../lib/costing";
import { qty, rand, slugify, uid } from "../lib/format";
import { editState, seedRecipeIds, useApp, useNutrition, useSummaries } from "../lib/store";
import { productMacros } from "../lib/nutrition";
import { NutritionPanel } from "./Nutrition";
import type { IngredientLine } from "../types";
import { ConfirmButton, Icon, Modal } from "./ui";
import { PhotoField, photoError } from "./Photo";

export function RecipeDetail({ id, open, onClose }: { id: string; open: Open; onClose: () => void }) {
  const { catalog, data, actions, photos, canEditBook } = useApp();
  const summaries = useSummaries();
  const nutrition = useNutrition();
  const recipe = catalog.recipes.get(id);
  if (!recipe) return null;
  const s = summaries.get(id)!;
  const n = nutrition.get(id)!;
  const store = catalog.store ?? "woolworths";
  const atStore = (st: "woolworths" | "checkers") => summarizeRecipe(recipe, { ...catalog, store: st });
  const ww = atStore("woolworths");
  const ck = atStore("checkers");
  const state = editState(data.recipeEdits, seedRecipeIds, id);
  const usedBy = catalog.recipeList.filter((r) => r.lines.some((l) => l.kind === "recipe" && l.recipeId === id));

  const duplicate = () => {
    let name = `${recipe.name} (copy)`;
    let n = 2;
    while (catalog.recipeList.some((r) => r.name === name)) name = `${recipe.name} (copy ${n++})`;
    const newId = `${slugify(name)}-${uid().slice(0, 4)}`;
    actions.saveRecipe({ ...recipe, id: newId, name, lines: recipe.lines.map((l) => ({ ...l, id: uid() })) });
    if (photos[id]) actions.setPhoto(newId, photos[id]).catch(() => {});
    open.notify(`Made a copy: ${name}`);
    open.recipe(newId);
  };

  return (
    <Modal
      wide
      title={recipe.name}
      onClose={onClose}
      footer={
        <>
          {canEditBook && (
          <div className="foot-left">
            {state === "edited" && (
              <ConfirmButton onConfirm={() => (actions.resetRecipe(id), open.notify("Restored the original recipe"))}>
                Undo my changes
              </ConfirmButton>
            )}
            <ConfirmButton
              onConfirm={() => {
                actions.deleteRecipe(id);
                onClose();
                open.notify(`Deleted ${recipe.name}`);
              }}
            >
              <Icon name="trash" /> Delete
            </ConfirmButton>
          </div>
          )}
          {canEditBook && (
            <>
              <button className="btn" onClick={duplicate}>
                <Icon name="duplicate" /> Duplicate
              </button>
              <button className="btn" onClick={() => open.editRecipe(recipe)}>
                <Icon name="edit" /> Edit
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={() => open.addToPlan(id)}>
            <Icon name="plus" /> Add to plan
          </button>
        </>
      }
    >
      <PhotoField
        recipe={recipe}
        readOnly={!canEditBook}
        url={photos[id]}
        notify={open.notify}
        onChange={async (url) => {
          try {
            await actions.setPhoto(id, url);
            open.notify(url ? "Photo saved" : "Photo removed");
          } catch (e) {
            open.notify(photoError(e));
          }
        }}
      />
      <div className="detail-meta">
        <span className="eyebrow">{recipe.category}</span>
        {recipe.yield && <span className="pill">{recipe.yield}</span>}
        {state && <span className={`badge badge-${state}`}>{state === "new" ? "Your recipe" : "Edited by you"}</span>}
        {recipe.link && (
          <a className="ext-link" href={recipe.link} target="_blank" rel="noreferrer">
            <Icon name="link" size={15} /> Original post
          </a>
        )}
      </div>
      {recipe.notes && <p className="detail-notes">{recipe.notes}</p>}

      <div className="detail-costs">
        <div>
          <span className="cost-label">Cost per make · {STORE_NAMES[store]}</span>
          <span className="cost-big num">{rand(s.perMake)}</span>
          <span className="hint">Only the share of each pack this recipe uses</span>
        </div>
        <div>
          <span className="cost-label">Shop from scratch</span>
          <span className="cost-big num">{rand(s.shop)}</span>
          <span className="hint">Full packs, if you had none of it at home</span>
        </div>
        {n.servings && n.servings > 1 && (
          <div>
            <span className="cost-label">Per serving</span>
            <span className="cost-big num">{rand(s.perMake / n.servings)}</span>
            <span className="hint">Cost per make ÷ {n.servings} servings</span>
          </div>
        )}
      </div>

      <div className="store-compare" aria-label="Cost at each store">
        {(["woolworths", "checkers"] as const).map((st) => {
          const v = st === "woolworths" ? ww : ck;
          const cheaper = (st === "woolworths" ? ww.perMake < ck.perMake : ck.perMake < ww.perMake) && Math.abs(ww.perMake - ck.perMake) >= 0.5;
          return (
            <div key={st} className={`${st === store ? "is-current" : ""}${cheaper ? " is-cheaper" : ""}`}>
              <span className="cost-label">{STORE_NAMES[st]}</span>
              <span className="num">{rand(v.perMake)}</span>
              <span className="hint">per make · {rand(v.shop)} from scratch</span>
              {cheaper && <span className="flag flag-good">Cheaper</span>}
            </div>
          );
        })}
      </div>

      <NutritionPanel n={n} />

      <div className="table-scroll">
        <table className="ing-table">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>{STORE_NAMES[store]} product</th>
              <th className="right">Amount</th>
              <th className="right">kcal</th>
              <th className="right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {recipe.lines.map(renderLine)}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Whole recipe</td>
              <td className="right num">{Math.round(n.total.kcal)}</td>
              <td className="right num">{rand(s.perMake)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {usedBy.length > 0 && (
        <p className="hint">
          Used as an ingredient in{" "}
          {usedBy.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}
              <button className="text-link" onClick={() => open.recipe(r.id)}>
                {r.name}
              </button>
            </span>
          ))}
          .
        </p>
      )}
    </Modal>
  );

  function renderLine(line: IngredientLine) {
    const cost = lineCost(line, catalog);
    const text = line.text.replace(/ \(part \d+\)$/, "");
    const isPart = text !== line.text;
    if (line.kind === "basic" || line.kind === "missing") {
      return (
        <tr key={line.id} className={`line-${line.kind}`}>
          <td>
            {text}
            <span className="line-product">{line.kind === "basic" ? "Pantry basic, not costed" : "Not at Woolworths"}</span>
          </td>
          <td colSpan={2} className="muted">
            {line.kind === "basic" ? "Pantry basic, not costed" : line.note || "Not sold at Woolworths"}
          </td>
          <td className="right muted">–</td>
          <td className="right muted">–</td>
        </tr>
      );
    }
    if (line.kind === "recipe") {
      const sub = line.recipeId ? catalog.recipes.get(line.recipeId) : undefined;
      return (
        <tr key={line.id}>
          <td>
            {text}
            {sub && <span className="line-product">{sub.name}</span>}
          </td>
          <td>
            {sub ? (
              <button className="text-link" onClick={() => open.recipe(sub.id)}>
                {sub.name}
              </button>
            ) : (
              <span className="flag flag-bad">Recipe missing</span>
            )}
          </td>
          <td className="right num">
            {line.qty ?? 1} batch{(line.qty ?? 1) === 1 ? "" : "es"}
          </td>
          <td className="right num">{sub ? Math.round(nutrition.get(sub.id)!.total.kcal * (line.qty ?? 1)) : "–"}</td>
          <td className="right num">{rand(cost)}</td>
        </tr>
      );
    }
    const product = line.productKey ? catalog.products.get(line.productKey) : undefined;
    return (
      <tr key={line.id} className={line.substitute ? "line-sub" : ""}>
        <td>
          {isPart ? <span className="muted">↳ also</span> : text}
          {product && <span className="line-product">{offerFor(product, store, catalog.basis).name}</span>}
          {line.note && <span className="line-note">{line.note}</span>}
        </td>
        <td>
          {product ? (
            <>
              {offerFor(product, store, catalog.basis).name}
              {line.substitute && <span className="flag flag-warn">Substitute</span>}
              {offerFor(product, store, catalog.basis).promo && <span className="flag flag-promo">On promo</span>}
              {offerFor(product, store, catalog.basis).fallback && <span className="flag flag-warn">Woolworths item</span>}
            </>
          ) : (
            <span className="flag flag-bad">No product chosen</span>
          )}
        </td>
        <td className="right num">{product && line.qty ? qty(line.qty, product.unit) : "–"}</td>
        <td className="right num">{lineKcal(product, line.qty)}</td>
        <td className="right num">{rand(cost)}</td>
      </tr>
    );
  }
}

function lineKcal(product: Parameters<typeof productMacros>[0] | undefined, amount: number | null | undefined): string {
  if (!product || !amount) return "–";
  const m = productMacros(product, amount);
  return m ? String(Math.round(m.kcal)) : "–";
}

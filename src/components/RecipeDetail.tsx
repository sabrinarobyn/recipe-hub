import type { Open } from "../App";
import { lineCost, onPromotion } from "../lib/costing";
import { qty, rand, slugify, uid } from "../lib/format";
import { editState, seedRecipeIds, useApp, useSummaries } from "../lib/store";
import type { IngredientLine } from "../types";
import { ConfirmButton, Icon, Modal } from "./ui";

export function RecipeDetail({ id, open, onClose }: { id: string; open: Open; onClose: () => void }) {
  const { catalog, data, actions } = useApp();
  const summaries = useSummaries();
  const recipe = catalog.recipes.get(id);
  if (!recipe) return null;
  const s = summaries.get(id)!;
  const state = editState(data.recipeEdits, seedRecipeIds, id);
  const usedBy = catalog.recipeList.filter((r) => r.lines.some((l) => l.kind === "recipe" && l.recipeId === id));

  const duplicate = () => {
    let name = `${recipe.name} (copy)`;
    let n = 2;
    while (catalog.recipeList.some((r) => r.name === name)) name = `${recipe.name} (copy ${n++})`;
    const newId = `${slugify(name)}-${uid().slice(0, 4)}`;
    actions.saveRecipe({ ...recipe, id: newId, name, lines: recipe.lines.map((l) => ({ ...l, id: uid() })) });
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
          <button className="btn" onClick={duplicate}>
            <Icon name="duplicate" /> Duplicate
          </button>
          <button className="btn" onClick={() => open.editRecipe(recipe)}>
            <Icon name="edit" /> Edit
          </button>
          <button className="btn btn-primary" onClick={() => open.addToPlan(id)}>
            <Icon name="plus" /> Add to plan
          </button>
        </>
      }
    >
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
          <span className="cost-label">Cost per make</span>
          <span className="cost-big num">{rand(s.perMake)}</span>
          <span className="hint">Only the share of each pack this recipe uses</span>
        </div>
        <div>
          <span className="cost-label">Shop from scratch</span>
          <span className="cost-big num">{rand(s.shop)}</span>
          <span className="hint">Full packs, if you had none of it at home</span>
        </div>
      </div>

      <div className="table-scroll">
        <table className="ing-table">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Woolworths product</th>
              <th className="right">Amount</th>
              <th className="right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {recipe.lines.map(renderLine)}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Cost per make</td>
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
          <td className="right num">{rand(cost)}</td>
        </tr>
      );
    }
    const product = line.productKey ? catalog.products.get(line.productKey) : undefined;
    return (
      <tr key={line.id} className={line.substitute ? "line-sub" : ""}>
        <td>
          {isPart ? <span className="muted">↳ also</span> : text}
          {product && <span className="line-product">{product.name}</span>}
          {line.note && <span className="line-note">{line.note}</span>}
        </td>
        <td>
          {product ? (
            <>
              {product.name}
              {line.substitute && <span className="flag flag-warn">Substitute</span>}
              {onPromotion(product) && <span className="flag flag-promo">On promo</span>}
            </>
          ) : (
            <span className="flag flag-bad">No product chosen</span>
          )}
        </td>
        <td className="right num">{product && line.qty ? qty(line.qty, product.unit) : "–"}</td>
        <td className="right num">{rand(cost)}</td>
      </tr>
    );
  }
}

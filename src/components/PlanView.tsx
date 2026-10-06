import { useMemo, useState } from "react";
import type { Open } from "../App";
import { buildShoppingList } from "../lib/costing";
import { addDays, dayMonth, dayName, today, weekDays, weekLabel, weekStart } from "../lib/dates";
import { rand, uid } from "../lib/format";
import { useApp, useSummaries } from "../lib/store";
import type { PlanEntry } from "../types";
import { defaultSlot, SLOTS } from "./AddToPlan";
import { BatchStepper, ConfirmButton, Icon, Modal } from "./ui";
import { Thumb } from "./Photo";

export function WeekSwitch({ week, setWeek }: { week: string; setWeek: (w: string) => void }) {
  const current = weekStart(today());
  return (
    <div className="week-switch">
      <button className="icon-btn" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week">
        <Icon name="chevronLeft" />
      </button>
      <span className="week-label">
        {week === current ? "This week" : week === addDays(current, 7) ? "Next week" : week === addDays(current, -7) ? "Last week" : "Week of"}
        <strong>{weekLabel(week)}</strong>
      </span>
      <button className="icon-btn" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week">
        <Icon name="chevronRight" />
      </button>
      {week !== current && (
        <button className="btn btn-quiet btn-small" onClick={() => setWeek(current)}>
          Today
        </button>
      )}
    </div>
  );
}

export function PlanView({ open, week, setWeek }: { open: Open; week: string; setWeek: (w: string) => void }) {
  const { data, catalog, actions } = useApp();
  const summaries = useSummaries();
  const [picking, setPicking] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanEntry | null>(null);
  const days = weekDays(week);
  const end = days[6];
  const t = today();

  const entries = useMemo(
    () => data.plan.filter((e) => e.date >= week && e.date <= end && catalog.recipes.has(e.recipeId)),
    [data.plan, week, end, catalog],
  );
  const list = useMemo(() => buildShoppingList(entries, catalog), [entries, catalog]);
  const lastWeek = useMemo(() => {
    const from = addDays(week, -7);
    return data.plan.filter((e) => e.date >= from && e.date < week && catalog.recipes.has(e.recipeId));
  }, [data.plan, week, catalog]);

  const copyLastWeek = () => {
    actions.setPlan([...data.plan, ...lastWeek.map((e) => ({ ...e, id: uid(), date: addDays(e.date, 7) }))]);
    open.notify(`Copied ${lastWeek.length} meals from last week`);
  };
  const clearWeek = () => {
    actions.setPlan(data.plan.filter((e) => e.date < week || e.date > end));
    open.notify("Cleared this week");
  };

  return (
    <section className="view">
      <div className="view-head">
        <div>
          <h1>Meal plan</h1>
          <WeekSwitch week={week} setWeek={setWeek} />
        </div>
        <div className="head-actions">
          {entries.length === 0 && lastWeek.length > 0 && (
            <button className="btn" onClick={copyLastWeek}>
              <Icon name="copy" /> Copy last week ({lastWeek.length})
            </button>
          )}
          {entries.length > 0 && <ConfirmButton onConfirm={clearWeek}>Clear week</ConfirmButton>}
        </div>
      </div>

      <div className="summary-strip">
        <div>
          <span className="cost-label">Meals planned</span>
          <span className="summary-value num">{entries.length}</span>
        </div>
        <div>
          <span className="cost-label">Shopping estimate</span>
          <span className="summary-value num">{rand(list.total)}</span>
        </div>
        <div>
          <span className="cost-label">Value of what you use</span>
          <span className="summary-value num">{rand(list.usedTotal)}</span>
        </div>
        <button className="btn btn-primary" onClick={() => open.goTo("list")} disabled={entries.length === 0}>
          <Icon name="cart" /> Shopping list
        </button>
      </div>

      {entries.length === 0 && (
        <div className="empty empty-inline">
          <p>
            Nothing planned for {weekLabel(week)} yet. Tap <strong>Add meal</strong> on a day, or pick from{" "}
            <button className="text-link" onClick={() => open.goTo("recipes")}>
              Recipes
            </button>
            .
          </p>
        </div>
      )}

      <ol className="week-grid">
        {days.map((d) => {
          const dayEntries = entries.filter((e) => e.date === d);
          const dayCost = dayEntries.reduce((s, e) => s + (summaries.get(e.recipeId)?.perMake ?? 0) * e.batches, 0);
          return (
            <li key={d} className={`day-card${d === t ? " is-today" : ""}`}>
              <header className="day-head">
                <span>
                  <span className="day-name">{dayName(d, "long")}</span>
                  <span className="day-date">{dayMonth(d)}</span>
                </span>
                {dayCost > 0 && <span className="day-cost num">{rand(dayCost)}</span>}
              </header>
              {SLOTS.map((slot) => {
                const items = dayEntries.filter((e) => e.slot === slot.id);
                if (!items.length) return null;
                return (
                  <div key={slot.id} className="slot">
                    <span className="slot-label">{slot.label}</span>
                    {items.map((e) => {
                      const r = catalog.recipes.get(e.recipeId)!;
                      return (
                        <button key={e.id} className="entry" onClick={() => setEditing(e)}>
                          <span className="entry-name">{r.name}</span>
                          <span className="entry-meta num">
                            {e.batches !== 1 && <span className="entry-batches">×{e.batches}</span>}
                            {rand((summaries.get(r.id)?.perMake ?? 0) * e.batches)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              <button className="add-meal" onClick={() => setPicking(d)}>
                <Icon name="plus" size={16} /> Add meal
              </button>
            </li>
          );
        })}
      </ol>

      {picking && (
        <RecipePicker
          title={`Add to ${dayName(picking, "long")} ${dayMonth(picking)}`}
          onClose={() => setPicking(null)}
          onPick={(id) => {
            const r = catalog.recipes.get(id)!;
            actions.addToPlan({ id: uid(), date: picking, slot: defaultSlot(r.category), recipeId: id, batches: 1 });
            open.notify(`Added ${r.name}`);
            setPicking(null);
          }}
        />
      )}
      {editing && (
        <EntryEditor
          entry={editing}
          onClose={() => setEditing(null)}
          onView={() => {
            setEditing(null);
            open.recipe(editing.recipeId);
          }}
        />
      )}
    </section>
  );
}

export function RecipePicker({ title, onClose, onPick }: { title: string; onClose: () => void; onPick: (id: string) => void }) {
  const { catalog } = useApp();
  const summaries = useSummaries();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const shown = catalog.recipeList
    .filter((r) => (cat === "All" || r.category === cat) && r.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Modal title={title} onClose={onClose}>
      <label className="search">
        <Icon name="search" />
        <input id="picker-search" type="search" placeholder="Search recipes" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </label>
      <div className="chips chips-tight">
        {["All", ...catalog.categories].map((c) => (
          <button key={c} className={`chip${cat === c ? " active" : ""}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <ul className="pick-list">
        {shown.map((r) => (
          <li key={r.id}>
            <button onClick={() => onPick(r.id)}>
              <Thumb recipe={r} />
              <span className="pick-text">
                <span className="pick-name">{r.name}</span>
                <span className="pick-cat">{r.category}</span>
              </span>
              <span className="num">{rand(summaries.get(r.id)?.perMake)}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="muted pad">No recipes match.</li>}
      </ul>
    </Modal>
  );
}

function EntryEditor({ entry, onClose, onView }: { entry: PlanEntry; onClose: () => void; onView: () => void }) {
  const { catalog, actions, data } = useApp();
  const live = data.plan.find((e) => e.id === entry.id) ?? entry;
  const recipe = catalog.recipes.get(live.recipeId);
  const monday = weekStart(live.date);
  if (!recipe) return null;
  const patch = (p: Partial<PlanEntry>) => actions.updatePlanEntry(live.id, p);
  return (
    <Modal
      title={recipe.name}
      onClose={onClose}
      footer={
        <>
          <div className="foot-left">
            <button
              className="btn btn-danger-quiet"
              onClick={() => {
                actions.removePlanEntry(live.id);
                onClose();
              }}
            >
              <Icon name="trash" /> Remove from plan
            </button>
          </div>
          <button className="btn" onClick={onView}>
            View recipe
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className="field">
        <span className="field-label">Day</span>
        <div className="day-pick" role="group" aria-label="Day">
          {weekDays(monday).map((d) => (
            <button key={d} className={`day-btn${d === live.date ? " active" : ""}`} onClick={() => patch({ date: d })}>
              <span>{dayName(d)}</span>
              <span className="day-num">{Number(d.slice(8))}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="field-label">Meal</span>
        <div className="seg" role="group" aria-label="Meal">
          {SLOTS.map((s) => (
            <button key={s.id} className={live.slot === s.id ? "active" : ""} onClick={() => patch({ slot: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field field-row">
        <span className="field-label">Batches</span>
        <BatchStepper value={live.batches} onChange={(batches) => patch({ batches })} />
      </div>
    </Modal>
  );
}

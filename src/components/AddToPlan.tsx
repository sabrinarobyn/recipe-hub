import { useState } from "react";
import { addDays, dayMonth, dayName, today, weekDays, weekLabel, weekStart } from "../lib/dates";
import { uid } from "../lib/format";
import { useApp } from "../lib/store";
import type { Slot } from "../types";
import { BatchStepper, Icon, Modal } from "./ui";

export const SLOTS: { id: Slot; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "extras", label: "Extras" },
];

export function defaultSlot(category: string): Slot {
  if (category === "Breakfast") return "breakfast";
  if (category === "Lunch & meal prep") return "lunch";
  if (category === "Mains" || category === "Soups") return "dinner";
  return "extras";
}

export function AddToPlan({
  recipeId,
  initialDate,
  week,
  onClose,
  onAdded,
}: {
  recipeId: string;
  initialDate?: string;
  week: string;
  onClose: () => void;
  onAdded: (msg: string) => void;
}) {
  const { catalog, actions } = useApp();
  const recipe = catalog.recipes.get(recipeId);
  const t = today();
  const startDate = initialDate ?? (t >= week && t <= addDays(week, 6) ? t : week);
  const [monday, setMonday] = useState(weekStart(startDate));
  const [date, setDate] = useState(startDate);
  const [slot, setSlot] = useState<Slot>(recipe ? defaultSlot(recipe.category) : "dinner");
  const [batches, setBatches] = useState(1);
  if (!recipe) return null;

  const add = () => {
    actions.addToPlan({ id: uid(), date, slot, recipeId, batches });
    onAdded(`Added ${recipe.name} to ${dayName(date, "long")} ${dayMonth(date)}`);
  };

  return (
    <Modal
      title="Add to plan"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={add}>
            Add to {dayName(date)} {SLOTS.find((s) => s.id === slot)!.label.toLowerCase()}
          </button>
        </>
      }
    >
      <p className="plan-recipe-name">{recipe.name}</p>
      <div className="field">
        <div className="week-switch">
          <button className="icon-btn" onClick={() => setMonday(addDays(monday, -7))} aria-label="Previous week">
            <Icon name="chevronLeft" />
          </button>
          <span className="week-label">{weekLabel(monday)}</span>
          <button className="icon-btn" onClick={() => setMonday(addDays(monday, 7))} aria-label="Next week">
            <Icon name="chevronRight" />
          </button>
        </div>
        <div className="day-pick" role="group" aria-label="Day">
          {weekDays(monday).map((d) => (
            <button key={d} className={`day-btn${d === date ? " active" : ""}${d === t ? " is-today" : ""}`} onClick={() => setDate(d)}>
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
            <button key={s.id} className={slot === s.id ? "active" : ""} onClick={() => setSlot(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field field-row">
        <span className="field-label">Batches</span>
        <BatchStepper value={batches} onChange={setBatches} />
        <span className="hint">Make it twice for leftovers, or half for a smaller meal.</span>
      </div>
    </Modal>
  );
}

import { useCallback, useEffect, useState } from "react";
import { bookDot } from "./components/SettingsModal";
import { BrandMark } from "./components/Brand";
import { StorePicker } from "./components/StorePicker";
import { Icon, useToast } from "./components/ui";
import { RecipesView } from "./components/RecipesView";
import { PlanView } from "./components/PlanView";
import { ShoppingListView } from "./components/ShoppingListView";
import { PricesView } from "./components/PricesView";
import { RecipeDetail } from "./components/RecipeDetail";
import { RecipeEditor } from "./components/RecipeEditor";
import { AddToPlan } from "./components/AddToPlan";
import { SettingsModal } from "./components/SettingsModal";
import { addDays, today, weekStart } from "./lib/dates";
import { useApp } from "./lib/store";
import type { Recipe } from "./types";

const TABS = [
  { id: "recipes", label: "Recipes", icon: "book" },
  { id: "plan", label: "Plan", icon: "calendar" },
  { id: "list", label: "Shopping list", icon: "cart" },
  { id: "prices", label: "Prices", icon: "tag" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function tabFromHash(): Tab {
  const h = location.hash.replace("#", "");
  return (TABS.find((t) => t.id === h)?.id ?? "recipes") as Tab;
}

export type Open = {
  recipe: (id: string) => void;
  editRecipe: (recipe: Recipe | "new") => void;
  addToPlan: (recipeId: string, date?: string) => void;
  notify: (msg: string) => void;
  goTo: (tab: Tab) => void;
};

export default function App() {
  const { data, sync, canEditBook, setNotifier } = useApp();
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [week, setWeek] = useState(() => weekStart(today()));
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);
  const [planning, setPlanning] = useState<{ recipeId: string; date?: string } | null>(null);
  const [settings, setSettings] = useState(false);
  const [toast, notify] = useToast();

  useEffect(() => setNotifier(notify), [setNotifier, notify]);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const goTo = useCallback((t: Tab) => {
    setTab(t);
    try {
      history.replaceState(null, "", `#${t}`);
    } catch {
      /* sandboxed frames may refuse */
    }
    window.scrollTo({ top: 0 });
  }, []);

  const open: Open = {
    recipe: setDetailId,
    editRecipe: (r) => {
      setDetailId(null);
      setEditing(r);
    },
    addToPlan: (recipeId, date) => setPlanning({ recipeId, date }),
    notify,
    goTo,
  };

  const weekCount = data.plan.filter((e) => e.date >= week && e.date <= addDays(week, 6)).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#recipes" onClick={(e) => (e.preventDefault(), goTo("recipes"))}>
            <BrandMark size={44} />
            <span className="brand-text">
              <span className="brand-name">Recipe Hub</span>
              <span className="brand-sub">good food for everyday</span>
            </span>
          </a>
          <nav className="tabs" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab${tab === t.id ? " active" : ""}`}
                aria-current={tab === t.id ? "page" : undefined}
                onClick={() => goTo(t.id)}
              >
                <Icon name={t.icon} />
                <span>{t.label}</span>
                {t.id === "plan" && weekCount > 0 && <span className="tab-count">{weekCount}</span>}
              </button>
            ))}
          </nav>
          <StorePicker compact />
          <button className="icon-btn settings-btn" onClick={() => setSettings(true)} aria-label="Settings and backup">
            <Icon name="settings" />
            <span className={`sync-dot ${bookDot(sync.book)}`} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="main">
        {sync.book === "signed-out" && (
          <p className="banner banner-warn">
            Sign in to Claude to see the latest recipes, prices and photos. Until then you're seeing the original spreadsheet.
          </p>
        )}
        {sync.book === "live" && !canEditBook && (
          <p className="banner">
            This recipe book is shared with you and stays up to date with the owner's changes. Your meal plan and shopping list are
            your own.
          </p>
        )}
        {tab === "recipes" && <RecipesView open={open} />}
        {tab === "plan" && <PlanView open={open} week={week} setWeek={setWeek} />}
        {tab === "list" && <ShoppingListView open={open} week={week} setWeek={setWeek} />}
        {tab === "prices" && <PricesView open={open} />}
      </main>

      {detailId && <RecipeDetail id={detailId} open={open} onClose={() => setDetailId(null)} />}
      {editing && (
        <RecipeEditor
          recipe={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          notify={notify}
          onSaved={(r) => {
            setEditing(null);
            setDetailId(r.id);
            notify(`Saved ${r.name}`);
          }}
        />
      )}
      {planning && (
        <AddToPlan
          recipeId={planning.recipeId}
          initialDate={planning.date}
          week={week}
          onClose={() => setPlanning(null)}
          onAdded={(msg) => {
            setPlanning(null);
            notify(msg);
          }}
        />
      )}
      {settings && <SettingsModal onClose={() => setSettings(false)} notify={notify} />}
      {toast}
    </div>
  );
}


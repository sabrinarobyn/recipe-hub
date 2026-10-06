import { useRef } from "react";
import { today } from "../lib/dates";
import { emptyUserData, normalize, saveFile } from "../lib/storage";
import { seed, useApp } from "../lib/store";
import { ConfirmButton, Icon, Modal } from "./ui";
import type { SyncState } from "../lib/store";

export function bookDot(book: SyncState["book"]): string {
  if (book === "live") return "sync-account";
  if (book === "connecting") return "sync-connecting";
  if (book === "error" || book === "signed-out") return "sync-error";
  return "";
}

export function SettingsModal({ onClose, notify }: { onClose: () => void; notify: (m: string) => void }) {
  const { data, sync, actions, photos, canEditBook } = useApp();
  const photoCount = Object.keys(photos).length;
  const fileRef = useRef<HTMLInputElement>(null);
  const recipeCount = Object.keys(data.recipeEdits).length;
  const productCount = Object.keys(data.productEdits).length;

  const backup = async () => {
    const ok = await saveFile(`recipe-hub-backup-${today()}.json`, JSON.stringify({ ...data, photos }), "application/json");
    if (!ok) notify("Downloads aren't available here.");
  };

  const restore = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      const next = normalize(raw);
      if (!next) throw new Error();
      actions.replaceAll(next);
      if (raw.photos && typeof raw.photos === "object") await actions.replacePhotos(raw.photos);
      notify("Restored your backup");
      onClose();
    } catch {
      notify("That file isn't a Recipe Hub backup.");
    }
  };

  return (
    <Modal title="Settings & backup" onClose={onClose}>
      <section className="settings-block">
        <h3 className="sub-head">Where your changes are saved</h3>
        <p className="sync-line">
          <span className={`sync-dot ${bookDot(sync.book)}`} aria-hidden="true" />
          <span>
            <strong>Recipes, prices &amp; photos: </strong>
            {sync.book === "live" &&
              (canEditBook
                ? "shared. Everyone you share this page with sees your changes within seconds."
                : "shared by the owner and kept up to date for you. Only the owner can change them.")}
            {sync.book === "local" && "saved in this browser on this device."}
            {sync.book === "connecting" && "connecting…"}
            {sync.book === "signed-out" && "sign in to Claude to see the owner's latest recipes and prices. You're seeing the original spreadsheet."}
            {sync.book === "error" && "couldn't reach the shared copy just now. Changes are kept in this browser."}
          </span>
        </p>
        <p className="sync-line">
          <span className={`sync-dot ${sync.personal === "account" ? "sync-account" : ""}`} aria-hidden="true" />
          <span>
            <strong>Your meal plan &amp; shopping list: </strong>
            {sync.personal === "account"
              ? "private to you, saved to your Claude account so they follow you between devices."
              : "private to you, saved in this browser. Use a backup file to move them to another device."}
          </span>
        </p>
        <p className="hint">
          You've changed {productCount} product{productCount === 1 ? "" : "s"} and {recipeCount} recipe{recipeCount === 1 ? "" : "s"}, added {photoCount} photo{photoCount === 1 ? "" : "s"}, and planned{" "}
          {data.plan.length} meal{data.plan.length === 1 ? "" : "s"}.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={backup}>
            <Icon name="download" /> Download backup
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> Restore from backup
          </button>
          <input
            ref={fileRef}
            id="backup-file"
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restore(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="settings-block">
        <h3 className="sub-head">Start over</h3>
        <p className="hint">
          {canEditBook
            ? "Puts every recipe and price back to the original spreadsheet, removes the photos, and empties your plans and lists. If you've shared this page, everyone sees the reset."
            : "Empties your meal plans and shopping lists. The owner's recipes and prices stay as they are."}
        </p>
        <ConfirmButton
          confirmLabel="Tap again to erase everything"
          onConfirm={() => {
            actions.replaceAll(emptyUserData());
            actions.replacePhotos({}).catch(() => {});
            notify(canEditBook ? "Back to the original spreadsheet" : "Cleared your plans and lists");
            onClose();
          }}
        >
          Reset everything
        </ConfirmButton>
      </section>

      <section className="settings-block">
        <h3 className="sub-head">How the costs work</h3>
        <dl className="notes-list">
          {seed.notes.map((n) => (
            <div key={n.label}>
              <dt>{n.label}</dt>
              <dd>{n.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {seed.excluded.length > 0 && (
        <section className="settings-block">
          <h3 className="sub-head">Posts left out of the spreadsheet</h3>
          <ul className="excluded-list">
            {seed.excluded.map((x) => (
              <li key={x.name}>
                {x.link ? (
                  <a href={x.link} target="_blank" rel="noreferrer">
                    {x.name}
                  </a>
                ) : (
                  x.name
                )}
                <span className="muted"> · {x.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Modal>
  );
}

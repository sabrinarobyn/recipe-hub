import { useRef } from "react";
import { today } from "../lib/dates";
import { emptyUserData, normalize, saveFile } from "../lib/storage";
import { seed, useApp } from "../lib/store";
import { ConfirmButton, Icon, Modal } from "./ui";

export function SettingsModal({ onClose, notify }: { onClose: () => void; notify: (m: string) => void }) {
  const { data, sync, actions, photos } = useApp();
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
        <p className={`sync-line sync-${sync}`}>
          <span className={`sync-dot sync-${sync}`} aria-hidden="true" />
          {sync === "account" && "Saved to your Claude account, so they follow you to any device you open this page on."}
          {sync === "connecting" && "Connecting…"}
          {sync === "browser" && "Saved in this browser on this device. Use a backup file to move them to another device."}
          {sync === "error" && "Couldn't reach your account just now. Changes are kept in this browser and will sync when it reconnects."}
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
        <p className="hint">Puts every recipe and price back to the original spreadsheet, removes your photos, and empties your plans and lists.</p>
        <ConfirmButton
          confirmLabel="Tap again to erase everything"
          onConfirm={() => {
            actions.replaceAll(emptyUserData());
            actions.replacePhotos({}).catch(() => {});
            notify("Back to the original spreadsheet");
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

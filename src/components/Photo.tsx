import { useRef, useState, type ReactNode } from "react";
import { resizePhoto } from "../lib/photos";
import { useApp } from "../lib/store";
import type { Recipe } from "../types";
import { Icon } from "./ui";

/** Message for a failed photo save, in the person's terms. */
export function photoError(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if ((e as Error)?.message === "not-image") return "That file isn't a photo. Pick a JPEG, PNG or HEIC image.";
  if (code === "quota_exceeded") return "Photo storage is full. Remove a few photos, then try again.";
  return "Couldn't save that photo. Try again, or pick a different one.";
}

/** Hidden file input plus a function that opens it. Handles resizing and saving. */
export function usePhotoPicker(onPicked: (dataUrl: string) => Promise<void> | void, notify: (m: string) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await onPicked(await resizePhoto(file));
    } catch (e) {
      notify(photoError(e));
    } finally {
      setBusy(false);
    }
  };
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => {
        handle(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );
  return { open: () => ref.current?.click(), input, busy, handle };
}

const TINTS = 4;

/** Lettered tile shown when a recipe has no photo, tinted by category. */
export function Placeholder({ recipe, children }: { recipe: Recipe; children?: ReactNode }) {
  const { catalog } = useApp();
  const tint = Math.max(0, catalog.categories.indexOf(recipe.category)) % TINTS;
  const letter = recipe.name.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? "•";
  return (
    <div className={`photo-placeholder tint-${tint}`}>
      <span className="photo-letter" aria-hidden="true">
        {letter}
      </span>
      {children}
    </div>
  );
}

/** Photo on a recipe card: the picture, or a tile with an "Add photo" button. */
export function CardPhoto({ recipe, onOpen, notify }: { recipe: Recipe; onOpen: () => void; notify: (m: string) => void }) {
  const { photos, actions } = useApp();
  const url = photos[recipe.id];
  const picker = usePhotoPicker((u) => actions.setPhoto(recipe.id, u), notify);
  if (url) {
    return (
      <button className="card-photo" onClick={onOpen} tabIndex={-1} aria-hidden="true">
        <img src={url} alt="" loading="lazy" />
      </button>
    );
  }
  return (
    <div className="card-photo">
      <Placeholder recipe={recipe}>
        <button className="photo-add" onClick={picker.open} disabled={picker.busy} aria-label={`Add a photo of ${recipe.name}`}>
          <Icon name="camera" size={16} /> {picker.busy ? "Adding…" : "Add photo"}
        </button>
      </Placeholder>
      {picker.input}
    </div>
  );
}

/**
 * Large photo with change / remove controls, used in the recipe detail and editor.
 * Accepts a dropped or pasted image as well as the file picker.
 */
export function PhotoField({
  recipe,
  url,
  onChange,
  notify,
}: {
  recipe: Recipe;
  url: string | undefined;
  onChange: (dataUrl: string | null) => Promise<void> | void;
  notify: (m: string) => void;
}) {
  const picker = usePhotoPicker((u) => onChange(u), notify);
  const [over, setOver] = useState(false);
  const fromTransfer = (dt: DataTransfer | null) => [...(dt?.files ?? [])].find((f) => f.type.startsWith("image/"));
  return (
    <div
      className={`photo-field${over ? " is-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        picker.handle(fromTransfer(e.dataTransfer));
      }}
      onPaste={(e) => {
        const f = fromTransfer(e.clipboardData);
        if (f) picker.handle(f);
      }}
    >
      {url ? (
        <img className="photo-hero" src={url} alt={`Photo of ${recipe.name}`} />
      ) : (
        <Placeholder recipe={recipe}>
          <span className="photo-empty-text">No photo yet. Add one, or drop an image here.</span>
        </Placeholder>
      )}
      <div className="photo-actions">
        <button className="btn btn-small btn-on-photo" onClick={picker.open} disabled={picker.busy}>
          <Icon name="camera" size={16} /> {picker.busy ? "Adding…" : url ? "Change photo" : "Add photo"}
        </button>
        {url && (
          <button className="btn btn-small btn-on-photo" onClick={() => onChange(null)}>
            <Icon name="trash" size={16} /> Remove
          </button>
        )}
      </div>
      {picker.input}
    </div>
  );
}

export function Thumb({ recipe }: { recipe: Recipe }) {
  const { photos } = useApp();
  const url = photos[recipe.id];
  return (
    <span className="thumb">
      {url ? <img src={url} alt="" loading="lazy" /> : <Placeholder recipe={recipe} />}
    </span>
  );
}

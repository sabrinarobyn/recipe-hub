import { useRef, useState } from "react";
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

/**
 * Large photo with change / remove controls, used in the recipe detail and editor.
 * Accepts a dropped or pasted image as well as the file picker.
 */
export function PhotoField({
  recipe,
  url,
  onChange,
  notify,
  readOnly,
}: {
  recipe: Recipe;
  readOnly?: boolean;
  url: string | undefined;
  onChange: (dataUrl: string | null) => Promise<void> | void;
  notify: (m: string) => void;
}) {
  const picker = usePhotoPicker((u) => onChange(u), notify);
  const [over, setOver] = useState(false);
  const fromTransfer = (dt: DataTransfer | null) => [...(dt?.files ?? [])].find((f) => f.type.startsWith("image/"));
  if (readOnly) {
    if (!url) return null;
    return (
      <div className="photo-field">
        <img className="photo-hero" src={url} alt={`Photo of ${recipe.name}`} />
      </div>
    );
  }
  return (
    <div
      className={`photo-field${url ? "" : " is-empty"}${over ? " is-over" : ""}`}
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
      {url && <img className="photo-hero" src={url} alt={`Photo of ${recipe.name}`} />}
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

/** Small photo for list rows; nothing when the recipe has no photo. */
export function Thumb({ recipe }: { recipe: Recipe }) {
  const { photos } = useApp();
  const url = photos[recipe.id];
  if (!url) return null;
  return (
    <span className="thumb">
      <img src={url} alt="" loading="lazy" />
    </span>
  );
}

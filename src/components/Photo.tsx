import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { mockupFor } from "../lib/mockups";
import { resizePhoto } from "../lib/photos";
import { useApp } from "../lib/store";
import type { Recipe } from "../types";
import { Icon } from "./ui";
import { Sticker, doodleFor } from "./Brand";

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

const TINTS = 5;

/** Brand tile shown when a recipe has no photo: a hand-drawn sticker on a category tint. */
export function Placeholder({ recipe, children }: { recipe: Recipe; children?: ReactNode }) {
  const { catalog } = useApp();
  const tint = Math.max(0, catalog.categories.indexOf(recipe.category)) % TINTS;
  const doodle = doodleFor(recipe.id);
  const tilt = `${((recipe.name.length * 7) % 17) - 8}deg`;
  return (
    <div className={`photo-placeholder tint-${tint}`}>
      <Sticker name={doodle} size={64} className="photo-sticker" style={{ "--tilt": tilt } as CSSProperties} />
      {children}
    </div>
  );
}

/** AI mockup standing in for a real photo, labelled so nobody mistakes it for the dish as made. */
export function Mockup({ src, hero, onClick, children }: { src: string; hero?: boolean; onClick?: () => void; children?: ReactNode }) {
  return (
    <div className={`photo-mockup${hero ? " is-hero" : ""}`}>
      <img src={src} alt="" loading="lazy" onClick={onClick} />
      <span className="mockup-badge">AI mockup</span>
      {children}
    </div>
  );
}

/** Photo on a recipe card: the picture, or its mockup or a sticker tile, with an "Add photo" button. */
export function CardPhoto({ recipe, onOpen, notify }: { recipe: Recipe; onOpen: () => void; notify: (m: string) => void }) {
  const { photos, actions, canEditBook } = useApp();
  const url = photos[recipe.id];
  const picker = usePhotoPicker((u) => actions.setPhoto(recipe.id, u), notify);
  const mockup = mockupFor(recipe.id);
  if (url) {
    return (
      <button className="card-photo" onClick={onOpen} tabIndex={-1} aria-hidden="true">
        <img src={url} alt="" loading="lazy" />
      </button>
    );
  }
  const add = canEditBook && (
    <button className="photo-add" onClick={picker.open} disabled={picker.busy} aria-label={`Add a photo of ${recipe.name}`}>
      <Icon name="camera" size={16} /> {picker.busy ? "Adding…" : "Add photo"}
    </button>
  );
  return (
    <div className="card-photo">
      {mockup ? (
        <Mockup src={mockup} onClick={onOpen}>
          {add}
        </Mockup>
      ) : (
        <Placeholder recipe={recipe}>{add}</Placeholder>
      )}
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
  readOnly,
}: {
  recipe: Recipe;
  readOnly?: boolean;
  url: string | undefined;
  onChange: (dataUrl: string | null) => Promise<void> | void;
  notify: (m: string) => void;
}) {
  const picker = usePhotoPicker((u) => onChange(u), notify);
  const mockup = mockupFor(recipe.id);
  const [over, setOver] = useState(false);
  const fromTransfer = (dt: DataTransfer | null) => [...(dt?.files ?? [])].find((f) => f.type.startsWith("image/"));
  if (readOnly) {
    if (!url && !mockup) return null;
    return (
      <div className="photo-field">
        {url ? <img className="photo-hero" src={url} alt={`Photo of ${recipe.name}`} /> : <Mockup src={mockup!} hero />}
      </div>
    );
  }
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
      ) : mockup ? (
        <Mockup src={mockup} hero />
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
  const url = photos[recipe.id] ?? mockupFor(recipe.id);
  return (
    <span className="thumb">
      {url ? <img src={url} alt="" loading="lazy" /> : <Placeholder recipe={recipe} />}
    </span>
  );
}

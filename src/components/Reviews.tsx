import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  canDeleteReview,
  canEditReview,
  recipeReviews,
  reviewGallery,
  reviewSummaries,
  type Review,
  type ReviewActor,
  type ReviewPhoto,
  type ReviewSummary,
} from "../lib/kitchen";
import {
  addReviewPhoto,
  deleteReview,
  deleteReviewPhoto,
  getClient,
  loadReviewPhotos,
  loadReviews,
  onReviewPhotos,
  onReviews,
  saveReview,
  type Account,
  type ReviewDraft,
} from "../lib/supabase";
import { useApp } from "../lib/store";
import { usePhotoPicker } from "./Photo";
import { MemberChip } from "./Profiles";
import { ConfirmButton, Icon } from "./ui";

interface ReviewsValue {
  /** Reviews exist only with accounts (hidden in the single-file offline build). */
  enabled: boolean;
  /** Every Review of every Recipe, by id. */
  reviews: Review[];
  /** Recipe id → average stars and number of Reviews. */
  summaries: Map<string, ReviewSummary>;
  /** The signed-in Member, for the review permissions. */
  me: ReviewActor;
  /** Writes (or replaces) the signed-in Member's Review of a Recipe. */
  save: (draft: ReviewDraft) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Every photo on every Review. */
  photos: ReviewPhoto[];
  /** Attaches a photo (a small JPEG data URL) to the signed-in Member's own Review. */
  addPhoto: (reviewId: string, dataUrl: string) => Promise<void>;
  removePhoto: (id: string) => Promise<void>;
}

const NONE: ReviewsValue = {
  enabled: false,
  reviews: [],
  summaries: new Map(),
  me: null,
  save: async () => {},
  remove: async () => {},
  photos: [],
  addPhoto: async () => {},
  removePhoto: async () => {},
};
const ReviewsCtx = createContext<ReviewsValue>(NONE);

export function useReviews(): ReviewsValue {
  return useContext(ReviewsCtx);
}

/** Loads every Review and keeps them live. Without an account it provides nothing. */
export function ReviewsProvider({ account, children }: { account: Account | null; children: ReactNode }) {
  const [byId, setById] = useState<Record<string, Review>>({});
  const [photosById, setPhotosById] = useState<Record<string, ReviewPhoto>>({});

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    let unsub = () => {};
    /** Ids deleted while the first load was in flight, so it can't bring them back. */
    const gone = new Set<string>();
    let unsubPhotos = () => {};
    const gonePhotos = new Set<string>();
    getClient().then((sb) => {
      if (cancelled) return;
      unsubPhotos = onReviewPhotos(sb, (change) => {
        if (change.kind === "deleted") {
          gonePhotos.add(change.id);
          setPhotosById(({ [change.id]: _, ...rest }) => rest);
        } else setPhotosById((all) => ({ ...all, [change.photo.id]: change.photo }));
      });
      loadReviewPhotos(sb)
        .then((all) => {
          if (cancelled) return;
          const loaded = Object.fromEntries(all.filter((p) => !gonePhotos.has(p.id)).map((p) => [p.id, p]));
          setPhotosById((live) => ({ ...loaded, ...live }));
        })
        .catch(() => {});
      unsub = onReviews(sb, (change) => {
        if (change.kind === "deleted") {
          gone.add(change.id);
          setById(({ [change.id]: _, ...rest }) => rest);
        } else setById((all) => ({ ...all, [change.review.id]: change.review }));
      });
      loadReviews(sb)
        .then((all) => {
          if (cancelled) return;
          const loaded = Object.fromEntries(all.filter((r) => !gone.has(r.id)).map((r) => [r.id, r]));
          setById((live) => ({ ...loaded, ...live }));
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      unsub();
      unsubPhotos();
    };
  }, [account]);

  const save = useCallback(
    async (draft: ReviewDraft) => {
      if (!account) return;
      const review = await saveReview(await getClient(), account.userId, draft);
      setById((all) => ({ ...all, [review.id]: review }));
    },
    [account],
  );
  const remove = useCallback(async (id: string) => {
    await deleteReview(await getClient(), id);
    setById(({ [id]: _, ...rest }) => rest);
  }, []);

  const addPhoto = useCallback(async (reviewId: string, dataUrl: string) => {
    const photo = await addReviewPhoto(await getClient(), reviewId, dataUrl);
    setPhotosById((all) => ({ ...all, [photo.id]: photo }));
  }, []);
  const removePhoto = useCallback(async (id: string) => {
    await deleteReviewPhoto(await getClient(), id);
    setPhotosById(({ [id]: _, ...rest }) => rest);
  }, []);

  const value = useMemo<ReviewsValue>(() => {
    if (!account) return NONE;
    const reviews = Object.values(byId);
    // A deleted Review's photos are deleted with it; reviewGallery leaves out any not yet gone here.
    const photos = Object.values(photosById);
    return { enabled: true, reviews, summaries: reviewSummaries(reviews), me: account, save, remove, photos, addPhoto, removePhoto };
  }, [account, byId, photosById, save, remove, addPhoto, removePhoto]);
  return <ReviewsCtx.Provider value={value}>{children}</ReviewsCtx.Provider>;
}

/** Stars out of 5 for an average (rounded to the nearest half for display). */
export function Stars({ value, size = "small" }: { value: number; size?: "small" | "large" }) {
  const halves = Math.round(value * 2);
  return (
    <span className={`stars stars-${size}`} role="img" aria-label={`${formatStars(value)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`star${halves >= i * 2 ? " is-full" : halves === i * 2 - 1 ? " is-half" : ""}`} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

const formatStars = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-ZA", { maximumFractionDigits: 1 });

/** A Recipe's average stars and number of Reviews, for the Recipe Book list. Nothing when it has none. */
export function RatingBadge({ recipeId }: { recipeId: string }) {
  const { enabled, summaries } = useReviews();
  const s = summaries.get(recipeId);
  if (!enabled || !s) return null;
  return (
    <span className="rating-badge" title={`${formatStars(s.average)} stars from ${s.count} review${s.count === 1 ? "" : "s"}`}>
      <Stars value={s.average} />
      <span className="num">{formatStars(s.average)}</span>
      <span className="muted">({s.count})</span>
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="star-picker" role="radiogroup" aria-label="Stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i === 1 ? "" : "s"}`}
          className={`star${i <= value ? " is-full" : ""}`}
          onClick={() => onChange(i)}
        >
          ★
        </button>
      ))}
    </span>
  );
}

const when = (iso: string) => new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

/** The recipe page's Reviews: the average, the signed-in Member's own Review, and every Review, newest first. */
export function ReviewsSection({ recipeId, notify }: { recipeId: string; notify: (m: string) => void }) {
  const { enabled, reviews, summaries, me, save, remove } = useReviews();
  const list = useMemo(() => recipeReviews(reviews, recipeId), [reviews, recipeId]);
  const mine = me ? list.find((r) => r.userId === me.userId) : undefined;
  const [editing, setEditing] = useState(false);
  if (!enabled) return null;
  const summary = summaries.get(recipeId);
  const canReview = me?.role != null;

  const del = async (r: Review) => {
    try {
      await remove(r.id);
      notify(r.userId === me?.userId ? "Deleted your review" : "Deleted the review");
    } catch {
      notify("Couldn't delete the review. Try again.");
    }
  };

  return (
    <section className="reviews" aria-labelledby={`reviews-${recipeId}`}>
      <div className="reviews-head">
        <h3 id={`reviews-${recipeId}`}>Reviews</h3>
        {summary ? (
          <span className="reviews-summary">
            <Stars value={summary.average} size="large" />
            <strong className="num">{formatStars(summary.average)}</strong>
            <span className="muted">
              from {summary.count} review{summary.count === 1 ? "" : "s"}
            </span>
          </span>
        ) : (
          <span className="muted">No reviews yet</span>
        )}
      </div>

      {canReview && (editing || !mine) && (
        <ReviewForm
          key={mine?.id ?? "new"}
          initial={mine}
          onCancel={mine ? () => setEditing(false) : undefined}
          onSave={async (stars, comment) => {
            try {
              await save({ recipeId, stars, comment });
              setEditing(false);
              notify(mine ? "Updated your review" : "Thanks for your review");
            } catch {
              notify("Couldn't save your review. Try again.");
            }
          }}
        />
      )}

      {list.length > 0 && (
        <ul className="review-list">
          {list.map((r) => (
            <li key={r.id} className={`review${r.userId === me?.userId ? " is-mine" : ""}`}>
              <div className="review-top">
                <MemberChip userId={r.userId} />
                <Stars value={r.stars} />
                <span className="hint">{when(r.createdAt)}</span>
              </div>
              {r.comment && <p className="review-comment">{r.comment}</p>}
              {canEditReview(me, r) && <ReviewPhotoAdder review={r} notify={notify} />}
              {(canEditReview(me, r) || canDeleteReview(me, r)) && (
                <div className="btn-row review-actions">
                  {canEditReview(me, r) && !editing && (
                    <button className="btn btn-small btn-quiet" onClick={() => setEditing(true)}>
                      <Icon name="edit" size={16} /> Edit
                    </button>
                  )}
                  {canDeleteReview(me, r) && (
                    <ConfirmButton className="btn btn-small btn-danger-quiet" confirmLabel="Delete?" ariaLabel="Delete review" onConfirm={() => del(r)}>
                      <Icon name="trash" size={16} /> Delete
                    </ConfirmButton>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ReviewGallery recipeId={recipeId} notify={notify} />
    </section>
  );
}

const fromTransfer = (dt: DataTransfer | null) => [...(dt?.files ?? [])].find((f) => f.type.startsWith("image/"));

/**
 * The reviewer's "Add photo" control on their own Review: camera or photo library, or an image
 * dropped or pasted onto it. Photos are shrunk in the browser like Recipe photos.
 */
function ReviewPhotoAdder({ review, notify }: { review: Review; notify: (m: string) => void }) {
  const { addPhoto } = useReviews();
  const [over, setOver] = useState(false);
  const picker = usePhotoPicker(async (dataUrl) => {
    await addPhoto(review.id, dataUrl);
    notify("Added your photo");
  }, notify);
  return (
    <div
      className={`review-photo-drop${over ? " is-over" : ""}`}
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
      <button className="btn btn-small btn-quiet" type="button" onClick={picker.open} disabled={picker.busy}>
        <Icon name="camera" size={16} /> {picker.busy ? "Adding…" : "Add photo"}
      </button>
      <span className="hint">or drop or paste an image here</span>
      {picker.input}
    </div>
  );
}

/**
 * Every Review photo of a Recipe, newest first, each with its reviewer's chip. The reviewer,
 * Editors and Admins can delete a photo; Editors and Admins can make one the Recipe's Main Photo.
 */
function ReviewGallery({ recipeId, notify }: { recipeId: string; notify: (m: string) => void }) {
  const { reviews, photos, me, removePhoto } = useReviews();
  const { actions, canEditBook } = useApp();
  const gallery = useMemo(() => reviewGallery(reviews, photos, recipeId), [reviews, photos, recipeId]);
  if (gallery.length === 0) return null;

  const del = async (photo: ReviewPhoto) => {
    try {
      await removePhoto(photo.id);
      notify("Deleted the photo");
    } catch {
      notify("Couldn't delete the photo. Try again.");
    }
  };
  const promote = async (photo: ReviewPhoto) => {
    try {
      await actions.setPhoto(recipeId, photo.dataUrl);
      notify("Made it the Main Photo");
    } catch {
      notify("Couldn't change the Main Photo. Try again.");
    }
  };

  return (
    <div className="review-gallery">
      <h4>Photos from reviews</h4>
      <ul className="review-gallery-grid">
        {gallery.map(({ photo, review }) => (
          <li key={photo.id} className="review-gallery-item">
            <img src={photo.dataUrl} alt="From a review" loading="lazy" />
            <MemberChip userId={review.userId} />
            {(canEditBook || canDeleteReview(me, review)) && (
              <div className="btn-row review-gallery-actions">
                {canEditBook && (
                  <button className="btn btn-small btn-quiet" type="button" onClick={() => promote(photo)}>
                    Make Main Photo
                  </button>
                )}
                {canDeleteReview(me, review) && (
                  <ConfirmButton className="btn btn-small btn-danger-quiet" confirmLabel="Delete?" ariaLabel="Delete photo" onConfirm={() => del(photo)}>
                    <Icon name="trash" size={16} />
                  </ConfirmButton>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Review | undefined;
  onSave: (stars: number, comment: string | null) => Promise<void>;
  onCancel?: () => void;
}) {
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stars) return;
    setBusy(true);
    try {
      await onSave(stars, comment.trim() || null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="review-form" onSubmit={submit}>
      <span className="field-label">{initial ? "Your review" : "What did you think?"}</span>
      <StarPicker value={stars} onChange={setStars} />
      <textarea
        className="input"
        rows={2}
        maxLength={2000}
        placeholder="Add a comment (optional): tips, swaps, how it went"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        aria-label="Comment"
      />
      <div className="btn-row">
        <button className="btn btn-primary btn-small" type="submit" disabled={!stars || busy}>
          {busy ? "Saving…" : initial ? "Save review" : "Post review"}
        </button>
        {onCancel && (
          <button className="btn btn-small" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { resizePhoto } from "../lib/photos";
import { initials, shouldAskForName, type Profile } from "../lib/profiles";
import { loadProfiles, onProfiles, saveProfile, type Account } from "../lib/supabase";
import { photoError } from "./Photo";
import { Icon, Modal } from "./ui";

/** Profile photos are only ever shown small. */
const PROFILE_PHOTO_EDGE = 320;

interface ProfilesValue {
  /** Every Member's Profile by user id. Empty when the app runs without accounts. */
  profiles: Record<string, Profile>;
  /** The signed-in Member's own Profile, or undefined until they set one. */
  me: Profile | undefined;
  /** Profiles exist only with accounts (hidden in the single-file offline build). */
  enabled: boolean;
  loaded: boolean;
  /** Saves changes to the signed-in Member's own Profile. */
  saveMine: (changes: Partial<Omit<Profile, "userId">>) => Promise<void>;
}

const ProfilesCtx = createContext<ProfilesValue>({
  profiles: {},
  me: undefined,
  enabled: false,
  loaded: true,
  saveMine: async () => {},
});

export function useProfiles(): ProfilesValue {
  return useContext(ProfilesCtx);
}

/** Loads every Member's Profile and keeps them live. Without an account it provides nothing. */
export function ProfilesProvider({ account, children }: { account: Account | null; children: ReactNode }) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loaded, setLoaded] = useState(!account);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    let unsub = () => {};
    const put = (p: Profile) => setProfiles((all) => ({ ...all, [p.userId]: p }));
    onProfiles(put).then((u) => (cancelled ? u() : (unsub = u)));
    loadProfiles()
      .then((all) => !cancelled && setProfiles((live) => ({ ...all, ...live })))
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
      unsub();
    };
  }, [account]);

  const userId = account?.userId;
  const me = userId ? profiles[userId] : undefined;
  const saveMine = useCallback(
    async (changes: Partial<Omit<Profile, "userId">>) => {
      if (!userId) return;
      const next: Profile = { userId, displayName: null, photo: null, nameAskedAt: null, ...me, ...changes };
      await saveProfile(next);
      setProfiles((all) => ({ ...all, [userId]: next }));
    },
    [userId, me],
  );

  const value = useMemo(() => ({ profiles, me, enabled: Boolean(account), loaded, saveMine }), [profiles, me, account, loaded, saveMine]);
  return <ProfilesCtx.Provider value={value}>{children}</ProfilesCtx.Provider>;
}

/** A Member's Profile photo, or their initials until they set one. */
export function Avatar({ profile, size = 28 }: { profile: Profile | undefined; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (profile?.photo) return <img className="avatar" src={profile.photo} alt="" style={style} />;
  return (
    <span className="avatar avatar-initials" style={style} aria-hidden="true">
      {initials(profile?.displayName ?? null)}
    </span>
  );
}

/**
 * Small "photo + name" chip for a Member, e.g. a Recipe's Author or a reviewer.
 * Shows initials until they set a photo, and "A Member" until they set a display name.
 */
export function MemberChip({ userId, size = "small" }: { userId: string; size?: "small" | "large" }) {
  const { profiles } = useProfiles();
  const profile = profiles[userId];
  const name = profile?.displayName || "A Member";
  return (
    <span className={`member-chip member-chip-${size}`}>
      <Avatar profile={profile} size={size === "large" ? 40 : 24} />
      <span className="member-chip-name">{name}</span>
    </span>
  );
}

/** The signed-in Member's profile screen: display name and photo (camera, library, drop or paste). */
export function ProfileModal({ onClose, notify }: { onClose: () => void; notify: (m: string) => void }) {
  const { me, saveMine } = useProfiles();
  const [name, setName] = useState(me?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const setPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await saveMine({ photo: await resizePhoto(file, PROFILE_PHOTO_EDGE) });
    } catch (e) {
      notify(photoError(e));
    } finally {
      setBusy(false);
    }
  };
  const removePhoto = async () => {
    try {
      await saveMine({ photo: null });
    } catch {
      notify("Couldn't remove your photo. Try again.");
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveMine({ displayName: name.trim() || null, nameAskedAt: me?.nameAskedAt ?? new Date().toISOString() });
      notify("Saved your profile");
      onClose();
    } catch {
      notify("Couldn't save your profile. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const fromTransfer = (dt: DataTransfer | null) => [...(dt?.files ?? [])].find((f) => f.type.startsWith("image/"));

  return (
    <Modal title="Your profile" onClose={onClose}>
      <form className="profile-form" onSubmit={submit}>
        <div
          className={`profile-photo${over ? " is-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            setPhoto(fromTransfer(e.dataTransfer));
          }}
          onPaste={(e) => setPhoto(fromTransfer(e.clipboardData))}
        >
          <Avatar profile={me ? { ...me, displayName: name || me.displayName } : undefined} size={96} />
          <div className="btn-row">
            <label className={`btn btn-small${busy ? " is-disabled" : ""}`}>
              <Icon name="camera" size={16} /> {busy ? "Saving…" : me?.photo ? "Change photo" : "Add photo"}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={busy}
                onChange={(e) => {
                  setPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {me?.photo && (
              <button type="button" className="btn btn-small" onClick={removePhoto}>
                <Icon name="trash" size={16} /> Remove
              </button>
            )}
          </div>
          <p className="hint">Or drop or paste a photo here.</p>
        </div>
        <label className="field-label" htmlFor="profile-name">
          Display name
        </label>
        <input
          id="profile-name"
          className="input"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should everyone call you?"
        />
        <p className="hint">Other Members see your name and photo on your Recipes and Reviews. They never see your email.</p>
        <div className="btn-row">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Asks a Member with no display name for one, once. Skipping counts as asked. */
export function NamePrompt({ notify }: { notify: (m: string) => void }) {
  const { enabled, loaded, me, saveMine } = useProfiles();
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);
  if (!enabled || !loaded || done || !shouldAskForName(me)) return null;

  const answer = async (displayName: string | null) => {
    setDone(true);
    try {
      await saveMine({ displayName, nameAskedAt: new Date().toISOString() });
      if (displayName) notify(`Welcome, ${displayName}!`);
    } catch {
      notify("Couldn't save your name. You can set it later from your profile.");
    }
  };

  return (
    <Modal title="What should we call you?" onClose={() => answer(null)}>
      <form
        className="profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          answer(name.trim() || null);
        }}
      >
        <p>Other Members see this name on Recipes you add and Reviews you leave, instead of your email.</p>
        <label className="field-label" htmlFor="first-name">
          Display name
        </label>
        <input id="first-name" className="input" maxLength={60} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <div className="btn-row">
          <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
            Save
          </button>
          <button className="btn" type="button" onClick={() => answer(null)}>
            Skip for now
          </button>
        </div>
      </form>
    </Modal>
  );
}

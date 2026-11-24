import { useEffect, useState, type FormEvent } from "react";
import { listMembers, removeMember, saveMember, signOut, type Account, type Member, type Role } from "../lib/supabase";
import { ConfirmButton } from "./ui";
import { MemberChip } from "./Profiles";

const ROLE_HELP: Record<Role, string> = {
  admin: "Admin: changes recipes and prices, and manages who's invited",
  editor: "Editor: changes recipes, prices and photos",
  viewer: "Viewer: sees the recipe book, plans their own meals",
};

export function AccountSection({ account, onEditProfile }: { account: Account; onEditProfile?: () => void }) {
  return (
    <section className="settings-block">
      <h3 className="sub-head">Your account</h3>
      <p>
        <MemberChip userId={account.userId} size="large" />
      </p>
      <p>
        Signed in as <strong>{account.email}</strong> ({account.role}).
      </p>
      <div className="btn-row">
        {onEditProfile && (
          <button className="btn" onClick={onEditProfile}>
            Edit profile
          </button>
        )}
        <button className="btn" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </section>
  );
}

/** Admins: who can sign in, and what they can change. */
export function PeopleSection({ account, notify }: { account: Account; notify: (m: string) => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    listMembers()
      .then(setMembers)
      .catch(() => notify("Couldn't load the invite list."));
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return notify("That doesn't look like an email address.");
    setBusy(true);
    try {
      await saveMember(clean, role);
      setEmail("");
      notify(`Invited ${clean}. Send them the link to this page; they sign in with that email.`);
      await refresh();
    } catch {
      notify("Couldn't add that person.");
    } finally {
      setBusy(false);
    }
  };

  const change = async (m: Member, next: Role) => {
    try {
      await saveMember(m.email, next);
      await refresh();
    } catch {
      notify("Couldn't change that role.");
    }
  };

  const remove = async (m: Member) => {
    try {
      await removeMember(m.email);
      notify(`Removed ${m.email}`);
      await refresh();
    } catch {
      notify("Couldn't remove that person.");
    }
  };

  return (
    <section className="settings-block">
      <h3 className="sub-head">People</h3>
      <p className="hint">Only these emails can sign in. {ROLE_HELP.viewer}. {ROLE_HELP.editor}. {ROLE_HELP.admin}.</p>
      {members === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <ul className="member-list">
          {members.map((m) => {
            const me = m.email === account.email.toLowerCase();
            return (
              <li key={m.email}>
                <span className="member-email">
                  {m.email}
                  {me && <span className="muted"> (you)</span>}
                </span>
                <select
                  className="input member-role"
                  aria-label={`Role for ${m.email}`}
                  value={m.role}
                  disabled={me}
                  onChange={(e) => change(m, e.target.value as Role)}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                {!me && (
                  <ConfirmButton confirmLabel="Tap again to remove" onConfirm={() => remove(m)}>
                    Remove
                  </ConfirmButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <form className="member-add" onSubmit={add}>
        <input
          className="input"
          type="email"
          placeholder="name@example.com"
          aria-label="Email to invite"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select className="input member-role" aria-label="Role for new person" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          Invite
        </button>
      </form>
    </section>
  );
}

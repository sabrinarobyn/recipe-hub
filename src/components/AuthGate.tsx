import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BrandMark, StickerCluster } from "./Brand";
import { clearLocal } from "../lib/storage";
import { currentAccount, onAuthChange, sendSignInLink, signOut, supabaseConfigured, verifySignInCode, type Account } from "../lib/supabase";

const AccountCtx = createContext<Account | null>(null);

/** The signed-in Supabase account, or null when the app runs without accounts. */
export function useAccount(): Account | null {
  return useContext(AccountCtx);
}

const LAST_ACCOUNT = "recipe-hub:account";

/** Plans in this browser belong to whoever was signed in last: don't hand them to someone else. */
function claimBrowserFor(userId: string) {
  try {
    if (localStorage.getItem(LAST_ACCOUNT) !== userId) {
      clearLocal();
      localStorage.setItem(LAST_ACCOUNT, userId);
    }
  } catch {
    /* storage blocked */
  }
}

type State = { kind: "loading" } | { kind: "signed-out" } | { kind: "removed"; account: Account } | { kind: "error" } | { kind: "in"; account: Account };

/**
 * With Supabase configured, shows the sign-in screen until an invited person is
 * signed in, then renders the app for that account. Without it, renders the app as before.
 */
export function AuthGate({ children }: { children: (account: Account | null) => ReactNode }) {
  const [state, setState] = useState<State>(supabaseConfigured ? { kind: "loading" } : { kind: "in", account: null as never });

  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    let unsub = () => {};
    const check = async () => {
      try {
        const account = await currentAccount();
        if (cancelled) return;
        if (!account) return setState({ kind: "signed-out" });
        if (!account.role) return setState({ kind: "removed", account });
        claimBrowserFor(account.userId);
        setState((s) => (s.kind === "in" && s.account?.userId === account.userId && s.account.role === account.role ? s : { kind: "in", account }));
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    };
    check();
    onAuthChange(check).then((u) => (cancelled ? u() : (unsub = u)));
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (!supabaseConfigured) return <>{children(null)}</>;
  if (state.kind === "loading") return <Splash>Opening your recipe book…</Splash>;
  if (state.kind === "signed-out") return <SignIn />;
  if (state.kind === "error")
    return (
      <Splash>
        Couldn't reach Recipe Hub just now. Check your connection and{" "}
        <button className="btn-link" onClick={() => location.reload()}>
          try again
        </button>
        .
      </Splash>
    );
  if (state.kind === "removed")
    return (
      <Splash>
        <strong>{state.account.email}</strong> isn't on the Recipe Hub invite list any more. Ask the person who shared it with you to add you
        again.
        <div className="btn-row center">
          <button className="btn" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </Splash>
    );
  return (
    <AccountCtx.Provider value={state.account}>
      <div key={state.account.userId}>{children(state.account)}</div>
    </AccountCtx.Provider>
  );
}

function Splash({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <BrandMark size={64} />
        <h1 className="auth-title">Recipe Hub</h1>
        <div className="auth-text">{children}</div>
      </div>
    </main>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "not-invited" | "rate-limited" | "error">("idle");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setStatus("sending");
    setStatus(await sendSignInLink(email).catch(() => "error" as const));
  };

  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<"idle" | "checking" | "wrong" | "error">("idle");

  const check = async (e: FormEvent) => {
    e.preventDefault();
    if (code.replace(/\D/g, "").length < 6) return setCodeStatus("wrong");
    setCodeStatus("checking");
    const result = await verifySignInCode(email, code).catch(() => "error" as const);
    // On success the auth listener in AuthGate opens the app.
    setCodeStatus(result === "ok" ? "idle" : result);
  };

  const resend = async () => {
    setCode("");
    setCodeStatus("idle");
    setStatus("sending");
    setStatus(await sendSignInLink(email).catch(() => "error" as const));
  };

  return (
    <main className="auth-page">
      <div className="auth-card auth-card-signin">
        <StickerCluster className="auth-art" />
        <h1 className="auth-title auth-wordmark">
          <span>Recipe</span> <span>Hub</span>
        </h1>
        <p className="auth-sub">Good food for everyday. Let's get cooking!</p>
        {status === "sent" ? (
          <form className="auth-form" onSubmit={check} role="status">
            <p className="auth-text-center">
              We've emailed a 6-digit code to <strong>{email.trim()}</strong>.
            </p>
            <label className="field-label" htmlFor="auth-code">
              Your code
            </label>
            <input
              id="auth-code"
              className="input auth-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={12}
              required
              autoFocus
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeStatus("idle");
              }}
              placeholder="123456"
            />
            <button className="btn btn-primary" type="submit" disabled={codeStatus === "checking"}>
              {codeStatus === "checking" ? "Checking…" : "Sign in"}
            </button>
            {codeStatus === "wrong" && (
              <p className="auth-error" role="alert">
                That code is wrong or has expired. Check the latest email, or send a new code.
              </p>
            )}
            {codeStatus === "error" && (
              <p className="auth-error" role="alert">
                Couldn't check the code. Check your connection and try again.
              </p>
            )}
            <p className="hint">Nothing there? Check your spam folder. The email also has a link you can tap instead.</p>
            <div className="auth-links">
              <button type="button" className="btn-link" onClick={resend}>
                Send a new code
              </button>
              <button type="button" className="btn-link" onClick={() => (setStatus("idle"), setCode(""))}>
                Use a different email
              </button>
            </div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <label className="field-label" htmlFor="auth-email">
              Your email
            </label>
            <input
              id="auth-email"
              className="input"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <button className="btn btn-primary" type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Email me a sign-in code"}
            </button>
            {status === "not-invited" && (
              <p className="auth-error" role="alert">
                That email isn't on the invite list yet. Ask the person who shared Recipe Hub with you to add it.
              </p>
            )}
            {status === "rate-limited" && (
              <p className="auth-error" role="alert">
                Too many sign-in emails just now. Please wait a few minutes and try again.
              </p>
            )}
            {status === "error" && (
              <p className="auth-error" role="alert">
                Couldn't send the code. Check your connection and try again.
              </p>
            )}
            <p className="hint">Recipe Hub is invite only. No password needed: we email you a code each time you sign in on a new device.</p>
          </form>
        )}
      </div>
    </main>
  );
}

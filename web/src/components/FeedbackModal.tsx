"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { sendFeedback, ApiError, type FeedbackKind } from "@/lib/api";
import { events } from "@/lib/analytics";

/**
 * The contact / suggestion form.
 *
 * Open to signed-out visitors on purpose. A contact form behind a login cannot
 * receive the message that matters most — "I tried to sign up and it did not
 * work" — so the email field appears only when we do not already know who is
 * writing.
 *
 * Three things this has to get right, none of them obvious:
 *
 *  - **The success state is the whole point.** A form that clears itself and
 *    says nothing reads as a failure, and the sender writes the message again.
 *  - **The draft survives a failed send.** Losing several paragraphs to a
 *    network error is how someone decides not to bother telling you.
 *  - **It closes on Escape and returns focus**, because it is a dialog and a
 *    keyboard user needs to get out of it.
 */

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: "suggestion", label: "Suggestion" },
  { value: "bug", label: "Something is broken" },
  { value: "question", label: "Question" },
  { value: "other", label: "Something else" },
];

const MIN_MESSAGE = 10;
const MAX_MESSAGE = 4000;

export default function FeedbackModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<FeedbackKind>("suggestion");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  // Tracked by subscription rather than read when the dialog opens.
  //
  // Reading it on open looked fine and was not: `signedInEmail` started null,
  // so the first paint rendered the "your email" field, and the moment auth
  // resolved the field vanished and the form reflowed under the sender. The
  // subscription means the answer is already known by the time anyone clicks.
  //
  // `undefined` is "not known yet" and distinct from `null`, which is
  // "definitely signed out" — without that distinction the same flash comes
  // back on a cold load.
  const [signedInEmail, setSignedInEmail] = useState<string | null | undefined>(
    () => auth.currentUser?.email ?? undefined
  );

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setSignedInEmail(u?.email ?? null));
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    returnFocusTo.current = document.activeElement;
    // Focus the message, not the first field: the sender came here to write
    // something, and the category has a sensible default.
    const t = setTimeout(() => textareaRef.current?.focus(), 60);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      (returnFocusTo.current as HTMLElement | null)?.focus?.();
    };
  }, [isOpen, onClose]);

  // Reset only after a successful send, and only once the dialog has closed —
  // clearing a failed draft is what loses someone's message.
  useEffect(() => {
    if (!isOpen && sent) {
      const t = setTimeout(() => {
        setSent(false);
        setMessage("");
        setError(null);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [isOpen, sent]);

  if (!isOpen) return null;

  const trimmed = message.trim();
  // Only when we positively know there is no account. While the answer is
  // still `undefined` the field stays hidden rather than flashing in.
  const needsEmail = signedInEmail === null;
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_MESSAGE;
  const authKnown = signedInEmail !== undefined;
  const canSend =
    !sending &&
    authKnown &&
    trimmed.length >= MIN_MESSAGE &&
    trimmed.length <= MAX_MESSAGE &&
    (!needsEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;

    setSending(true);
    setError(null);
    try {
      await sendFeedback({
        kind,
        message: trimmed,
        email: needsEmail ? email.trim() : undefined,
      });
      setSent(true);
      void events.feedbackSent(kind);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not send that. Please try again."
      );
      void events.actionFailed("feedback_send", err instanceof ApiError ? err.status : undefined);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="feedback-modal glass-strong"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="feedback-done">
            <div className="feedback-done-mark" aria-hidden="true">
              ✓
            </div>
            <h2 id="feedback-title">Thank you — that reached us.</h2>
            <p className="muted">
              We read every message. If it needs a reply, it will come to{" "}
              <strong>{signedInEmail || email.trim()}</strong>.
            </p>
            <button type="button" className="feedback-btn" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="row-between" style={{ marginBottom: 6 }}>
              <h2 id="feedback-title" className="feedback-title">
                Tell us what you think
              </h2>
              <button
                type="button"
                className="feedback-close"
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="muted feedback-sub">
              Suggestions, bugs, or anything that got in your way. It goes
              straight to the people who build this.
            </p>

            <fieldset className="feedback-kinds">
              <legend className="sr-only">What is this about?</legend>
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  className={`feedback-kind${kind === k.value ? " is-active" : ""}`}
                  aria-pressed={kind === k.value}
                  onClick={() => setKind(k.value)}
                >
                  {k.label}
                </button>
              ))}
            </fieldset>

            <label className="sr-only" htmlFor="feedback-message">
              Your message
            </label>
            <textarea
              id="feedback-message"
              ref={textareaRef}
              className="feedback-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX_MESSAGE}
              rows={6}
              placeholder="What would make this better?"
              aria-describedby="feedback-count"
            />
            <div className="feedback-meta">
              <span id="feedback-count" className="muted">
                {tooShort
                  ? `A few more words — at least ${MIN_MESSAGE} characters.`
                  : `${trimmed.length} / ${MAX_MESSAGE}`}
              </span>
            </div>

            {needsEmail ? (
              <>
                <label className="feedback-label" htmlFor="feedback-email">
                  Your email, so we can reply
                </label>
                <input
                  id="feedback-email"
                  className="feedback-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </>
            ) : authKnown ? (
              <p className="muted feedback-as">
                Sending as <strong>{signedInEmail}</strong>
              </p>
            ) : null}

            {error && (
              <p className="feedback-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="feedback-btn feedback-submit" disabled={!canSend}>
              {sending ? "Sending…" : "Send"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { updateProfile, type User } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { needsEmailConfirmation } from "@/lib/authProviders";

export default function ProfileModal({
  isOpen,
  onClose,
  currentUser,
  onUpdated,
  onOpenWorkspaceSettings,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUpdated?: (newDisplayName: string) => void;
  onOpenWorkspaceSettings?: () => void;
}) {
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    setDisplayName(currentUser.displayName ?? "");
    setError(null);
    setNotice(null);
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !currentUser) return null;

  const initial = (
    displayName.trim() ||
    currentUser.displayName ||
    currentUser.email ||
    "U"
  )
    .charAt(0)
    .toUpperCase();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError("Username cannot be empty.");
      return;
    }
    if (trimmed.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 50) {
      setError("Username cannot exceed 50 characters.");
      return;
    }

    const user = currentUser ?? auth.currentUser;
    if (!user) {
      setError("You must be signed in to update your profile.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      // 1. Update Firebase Auth client session
      await updateProfile(user, { displayName: trimmed });

      // 2. Synchronize Firestore users/{uid} document
      try {
        await setDoc(
          doc(db, "users", user.uid),
          { displayName: trimmed, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (fsErr) {
        console.warn("Could not write Firestore users doc directly:", fsErr);
      }

      // 3. Inform worker API backend
      try {
        await api.updateProfile(trimmed);
      } catch (apiErr) {
        console.warn("API profile update:", apiErr);
      }

      setNotice("Username updated successfully.");
      onUpdated?.(trimmed);
      setTimeout(() => {
        setNotice(null);
      }, 3000);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : (err as Error)?.message || "Could not update username. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const copyUid = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(currentUser.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  return (
    <div
      className="auth-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="auth-modal-dialog profile-modal-dialog">
        <button
          type="button"
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Close profile settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="profile-modal-header">
          <div className="profile-avatar-large">
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={displayName || "User"}
                className="profile-avatar-img"
              />
            ) : (
              <span className="profile-avatar-letter">{initial}</span>
            )}
          </div>
          <h3 id="profile-modal-title">{t("profileTitle")}</h3>
          <p className="profile-email-badge">
            <span>{currentUser.email}</span>
            {/* A federated sign-in has nothing pending — see `needsEmailConfirmation`. */}
            {!needsEmailConfirmation(currentUser) ? (
              <span className="badge-verified" title="Email address is verified">
                ✓ Verified
              </span>
            ) : (
              <span className="badge-unverified" title="Email confirmation pending">
                Unverified
              </span>
            )}
          </p>
        </div>

        <div className="auth-modal-body">
          {notice && <div className="banner ok">{notice}</div>}
          {error && <div className="banner err" role="alert">{error}</div>}

          <form onSubmit={handleSave}>
            <div className="auth-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="profile-username" className="auth-field-label">
                  {t("profileUsername")}
                </label>
                <span className="dim" style={{ fontSize: "0.72rem" }}>
                  {displayName.length}/50
                </span>
              </div>
              <div className="auth-input-wrap">
                <input
                  id="profile-username"
                  type="text"
                  required
                  minLength={2}
                  maxLength={50}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name or handle"
                  disabled={busy}
                />
              </div>
              <span className="dim" style={{ fontSize: "0.74rem", marginTop: "2px" }}>
                This name is displayed in the dashboard header, team alerts, and activity logs.
              </span>
            </div>

            <button
              type="submit"
              className="primary"
              style={{ width: "100%", marginTop: "12px", padding: "10px 16px" }}
              disabled={busy || !displayName.trim()}
            >
              {busy ? t("profileSaving") : t("profileSave")}
            </button>
          </form>

          <div className="profile-details-section">
            <div className="profile-detail-row">
              <span className="profile-detail-label">User ID</span>
              <button
                type="button"
                className="profile-uid-pill"
                onClick={copyUid}
                title="Click to copy User ID"
              >
                <code>{currentUser.uid.slice(0, 10)}…{currentUser.uid.slice(-6)}</code>
                <span style={{ fontSize: "0.7rem", color: copiedUid ? "#6fc3df" : "inherit" }}>
                  {copiedUid ? "✓ Copied" : "Copy"}
                </span>
              </button>
            </div>

            {onOpenWorkspaceSettings && (
              <div className="profile-workspace-link">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    onClose();
                    onOpenWorkspaceSettings();
                  }}
                  style={{ fontSize: "0.82rem", color: "#6fc3df", display: "inline-flex", alignItems: "center", gap: "4px" }}
                >
                  <span>🏢 Workspace &amp; Public Status Page Settings</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

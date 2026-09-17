"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type OrgSettings as Settings } from "@/lib/api";

/**
 * Workspace name and public status page address.
 *
 * Two different kinds of thing on one screen, and the difference matters. The
 * name is a private label; the slug is a public URL that has to be unique
 * across every workspace, and once shared it is in someone's bookmarks. So
 * changing it is a deliberate, separate save that says what it replaced.
 */
export default function OrgSettings({
  isOpen,
  onClose,
  onRenamed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onRenamed?: (name: string) => void;
}) {
  const [data, setData] = useState<Settings | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState<"name" | "page" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.org();
      setData(d);
      setName(d.name);
      setSlug(d.statusPage.slug ?? "");
      setTitle(d.statusPage.title ?? "");
      setDescription(d.statusPage.description ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your settings.");
    }
  }, []);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && isOpen && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setBusy("name");
    setError(null);
    setNotice(null);
    try {
      const res = await api.renameOrg(name.trim());
      setNotice("Workspace renamed.");
      onRenamed?.(res.name);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename the workspace.");
    } finally {
      setBusy(null);
    }
  }

  async function savePage(e: React.FormEvent) {
    e.preventDefault();
    setBusy("page");
    setError(null);
    setNotice(null);
    try {
      const res = await api.setStatusPage({
        slug: slug.trim(),
        title: title.trim(),
        description: description.trim(),
      });
      setNotice(
        res.replaced
          ? `Address set. /status/${res.replaced} stops working immediately — update any links.`
          : "Status page address set."
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not set that address.");
    } finally {
      setBusy(null);
    }
  }

  const suggestion = data?.statusPage.suggestion;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" role="dialog" aria-modal="true" aria-label="Workspace settings">
        <div className="modal-header">
          <h2>Workspace</h2>
          <button className="btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {notice && <div className="banner ok">{notice}</div>}
          {error && (
            <div className="banner err" role="alert">
              {error}
            </div>
          )}

          {!data ? (
            <p className="dim">Loading…</p>
          ) : (
            <>
              <form onSubmit={saveName} className="settings-block">
                <div className="field">
                  <label htmlFor="org-name">Workspace name</label>
                  <input
                    id="org-name"
                    value={name}
                    maxLength={60}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Acme Corp"
                  />
                  <p className="dim">Shown to you and anyone you invite. Any language.</p>
                </div>
                <button className="primary" disabled={busy !== null || !name.trim() || name.trim() === data.name}>
                  {busy === "name" ? "Saving…" : "Save name"}
                </button>
              </form>

              <form onSubmit={savePage} className="settings-block">
                <div className="field">
                  <label htmlFor="org-slug">Status page address</label>
                  <div className="slug-input">
                    <span className="slug-prefix">/status/</span>
                    <input
                      id="org-slug"
                      value={slug}
                      maxLength={40}
                      onChange={(e) => setSlug(e.target.value.toLowerCase())}
                      placeholder={suggestion || "acme-status"}
                      aria-describedby="slug-help"
                    />
                  </div>
                  <p className="dim" id="slug-help">
                    Lowercase letters, numbers and hyphens. Must be unique across
                    every workspace.
                    {suggestion && !slug && (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setSlug(suggestion)}
                        >
                          use “{suggestion}”
                        </button>
                      </>
                    )}
                  </p>
                  {/* The address today, whether or not one has been claimed —
                      the org id already works as a fallback. */}
                  <p className="dim">
                    Currently:{" "}
                    <a href={data.statusPage.url} target="_blank" rel="noopener noreferrer">
                      {data.statusPage.url.replace(/^https?:\/\//, "")}
                    </a>
                  </p>
                </div>

                <div className="field">
                  <label htmlFor="org-title">Page heading</label>
                  <input
                    id="org-title"
                    value={title}
                    maxLength={60}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Acme Services"
                  />
                  <p className="dim">
                    Left blank it reads “Service status”. Your workspace name is
                    deliberately not used — it is derived from an email address.
                  </p>
                </div>

                <div className="field">
                  <label htmlFor="org-desc">Page subtitle</label>
                  <input
                    id="org-desc"
                    value={description}
                    maxLength={200}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="How our services are doing."
                  />
                </div>

                <button className="primary" disabled={busy !== null || !slug.trim()}>
                  {busy === "page" ? "Saving…" : "Save status page"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type AlertChannel, type AlertContact } from "@/lib/api";
import { events } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n/context";

/**
 * Who gets paged.
 *
 * This panel is the missing half of the alert pipeline. The delivery machinery
 * — outbox, drainer, five channels — was all there, but a contact could only
 * ever be created once, by the signup bootstrap, and there was no way to add a
 * second one or to confirm it. Monitoring nobody can be told about is worse
 * than none, because you believe you are covered.
 *
 * A contact is unverified until a confirmation sent over its *own* channel is
 * clicked. That is not ceremony: it proves the destination is reachable and
 * wanted, and it stops this service being used to mail strangers.
 */

const CHANNELS: {
  key: AlertChannel;
  label: string;
  hint: string;
  placeholder: string;
}[] = [
  { key: "email", label: "Email", hint: "", placeholder: "you@example.com" },
  {
    key: "slack",
    label: "Slack",
    hint: "Incoming webhook URL from your Slack app",
    placeholder: "https://hooks.slack.com/services/…",
  },
  {
    key: "discord",
    label: "Discord",
    hint: "Channel → Integrations → Webhooks",
    placeholder: "https://discord.com/api/webhooks/…",
  },
  {
    key: "telegram",
    label: "Telegram",
    hint: "Message the bot first, then use the numeric chat id it replies with",
    placeholder: "123456789",
  },
  {
    key: "webhook",
    label: "Webhook",
    hint: "We POST a JSON body on every state change",
    placeholder: "https://example.com/hooks/uptime",
  },
];

export default function AlertContacts({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [contacts, setContacts] = useState<AlertContact[] | null>(null);
  const [channels, setChannels] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [channel, setChannel] = useState<AlertChannel>("email");
  const [destination, setDestination] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const spec = CHANNELS.find((c) => c.key === channel)!;

  const load = useCallback(async () => {
    try {
      const res = await api.contacts();
      setContacts(res.contacts);
      setChannels(res.channels ?? {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your alert contacts.");
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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const created = await api.createContact({
        channel,
        destination: destination.trim(),
        name: name.trim() || undefined,
        ...(channel === "telegram" ? { telegramChatId: destination.trim() } : {}),
      });
      setDestination("");
      setName("");
      await load();
      void events.contactAdded(channel);
      // Send the confirmation straight away rather than making it a second
      // deliberate step — an unverified contact receives nothing, and a list
      // of contacts that look added but are silent is the failure this panel
      // exists to prevent.
      await sendVerification(created.id, { silent: true });
      setNotice(`Added. Check ${created.destination} for a confirmation link.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that contact.");
      void events.actionFailed("contact_add", err instanceof ApiError ? err.status : undefined);
    } finally {
      setAdding(false);
    }
  }

  async function sendVerification(id: string, opts: { silent?: boolean } = {}) {
    setBusyId(id);
    if (!opts.silent) {
      setError(null);
      setNotice(null);
    }
    try {
      const res = await api.verifyContact(id);
      if (!opts.silent) {
        setNotice(
          res.alreadyVerified ? "That contact is already confirmed." : "Confirmation sent."
        );
      }
      await load();
    } catch (err) {
      // Surfaced even when the send was automatic: "added but we could not
      // reach it" is exactly what the user needs to know.
      setError(err instanceof ApiError ? err.message : "Could not send the confirmation.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: AlertContact) {
    if (!confirm(`Stop sending alerts to ${c.destination}?`)) return;
    setBusyId(c.id);
    setError(null);
    setNotice(null);
    try {
      const res = await api.deleteContact(c.id);
      setNotice(
        res.detachedFrom
          ? `Removed, and detached from ${res.detachedFrom} monitor${
              res.detachedFrom === 1 ? "" : "s"
            }.`
          : "Removed."
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that contact.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendTest(c: AlertContact) {
    setBusyId(c.id);
    setError(null);
    setNotice(null);
    try {
      await api.testContact(c.id);
      /**
       * Names the contact, not the destination.
       *
       * For a push contact the destination is the FCM device token — two
       * hundred characters of base64 that filled the banner, told the reader
       * nothing, and put a device credential on screen. The name is what
       * they chose it for.
       */
      const label = c.name?.trim() || (c.channel === "fcm" ? "your device" : c.destination);
      setNotice(
        c.channel === "fcm"
          ? `Test alert sent to ${label}. If it does not arrive, check that notifications are enabled for the app.`
          : `Test alert sent to ${label}. If it does not arrive, check spam — the delivery itself succeeded.`
      );
      void events.contactTested(c.channel, true);
    } catch (err) {
      // The provider's own words, not a generic failure: "domain not verified"
      // or "channel archived" is what actually tells someone what to fix.
      setError(
        err instanceof ApiError ? err.message : "Could not send the test notification."
      );
      void events.contactTested(c.channel, false);
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(c: AlertContact) {
    setBusyId(c.id);
    try {
      await api.updateContact(c.id, { enabled: !c.enabled });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update that contact.");
    } finally {
      setBusyId(null);
    }
  }

  const unverified = (contacts ?? []).filter((c) => !c.verified).length;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" role="dialog" aria-modal="true" aria-label="Alert contacts">
        <div className="modal-header">
          <h2>{t("contactsTitle")}</h2>
          <button className="btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="dim" style={{ marginBottom: 16 }}>
            Everyone confirmed here is paged when a monitor goes down and again
            when it recovers. A monitor with no specific contacts chosen alerts
            all of them.
          </p>

          {notice && <div className="banner ok">{notice}</div>}
          {error && (
            <div className="banner err" role="alert">
              {error}
            </div>
          )}
          {!!unverified && !error && (
            <div className="banner warn">
              {unverified === 1
                ? "One contact has not confirmed yet and will not receive anything."
                : `${unverified} contacts have not confirmed yet and will not receive anything.`}
            </div>
          )}

          <div className="contact-list">
            {contacts === null && <p className="dim">Loading…</p>}
            {contacts?.length === 0 && (
              <p className="dim">{t("contactsNoContacts")}</p>
            )}
            {contacts?.map((c) => (
              <div key={c.id} className="contact-row">
                <span className={`protocol-tag ${c.channel}`}>
                  {c.channel.toUpperCase()}
                </span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="contact-name">
                    {/* Wrapped, not bare: a loose text node is an anonymous
                        flex item and cannot be truncated, so a long name
                        overflowed the row and painted over the badge. */}
                    <span className="contact-name-text" title={c.name}>
                      {c.name}
                    </span>
                    {!c.enabled && <span className="interval-tag">paused</span>}
                  </div>
                  <div className="monitor-target">{c.destination}</div>
                </div>

                {channels[c.channel] === "unconfigured" ? (
                  <span
                    className="status-pill down"
                    title={`${c.channel} delivery is not configured on this server`}
                  >
                    <span className="status-dot down" />
                    undeliverable
                  </span>
                ) : c.verified ? (
                  <span className="status-pill up">
                    <span className="status-dot up" />
                    {t("contactsVerified")}
                  </span>
                ) : (
                  <button
                    className="btn-sm"
                    disabled={busyId === c.id}
                    onClick={() => sendVerification(c.id)}
                  >
                    {busyId === c.id ? t("contactsSending") : t("contactsResend")}
                  </button>
                )}

                {c.verified && c.enabled && channels[c.channel] !== "unconfigured" && (
                  <button
                    className="btn-sm"
                    disabled={busyId === c.id}
                    onClick={() => sendTest(c)}
                    title="Send a real alert now, the same way an outage would"
                  >
                    {busyId === c.id ? t("contactsSending") : t("contactsTestAlert")}
                  </button>
                )}

                <button
                  className="btn-sm"
                  disabled={busyId === c.id}
                  onClick={() => toggle(c)}
                  title={c.enabled ? "Stop paging this contact" : "Resume paging"}
                >
                  {c.enabled ? "Pause" : "Resume"}
                </button>
                <button
                  className="btn-sm danger"
                  disabled={busyId === c.id}
                  onClick={() => remove(c)}
                >
                  {t("contactsDelete")}
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={add} className="contact-add">
            <h3>{t("contactsAddNew")}</h3>

            <div className="field">
              <label htmlFor="ac-channel">{t("contactsChannel")}</label>
              <select
                id="ac-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as AlertChannel)}
              >
                {CHANNELS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {channels[channel] === "unconfigured" && (
              <div className="banner warn">
                {spec.label} delivery is not configured on this server yet, so
                nothing added here can be sent. The other channels still work.
              </div>
            )}

            <div className="field">
              <label htmlFor="ac-dest">{t("contactsDestination")}</label>
              <input
                id="ac-dest"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={spec.placeholder}
                required
              />
              {spec.hint && (
                <p className="dim" style={{ marginTop: 4 }}>
                  {spec.hint}
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="ac-name">{t("contactsName")}</label>
              <input
                id="ac-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="On-call rota"
              />
            </div>

            <button className="primary" type="submit" disabled={adding || !destination.trim()}>
              {adding ? t("contactsSending") : t("contactsAddBtn")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

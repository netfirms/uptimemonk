import { assertSafeUrl } from "../lib/targetGuard.js";
import type { AlertChannel } from "../types.js";

/**
 * What a contact must look like before it is stored.
 *
 * The webhook-ish channels get the same treatment as a probe target, because
 * that is what they are: a customer-supplied URL that this server will fetch
 * from inside our network. Skipping `assertSafeUrl` here would reopen the hole
 * `targetGuard` exists to close, just through a different door.
 */

export class InvalidContactError extends Error {}

const CHANNELS: AlertChannel[] = ["email", "slack", "discord", "telegram", "webhook", "fcm"];

/** Deliberately loose. Strict email regexes reject valid addresses, and the
 *  real proof of validity is that the confirmation arrives. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface ContactInput {
  channel?: string;
  name?: string;
  destination?: string;
  telegramChatId?: string;
  fcmToken?: string;
  platform?: "ios" | "android";
  enabled?: boolean;
}

export interface ValidContact {
  channel: AlertChannel;
  name: string;
  destination: string;
  telegramChatId?: string;
  fcmToken?: string;
  platform?: "ios" | "android";
  enabled: boolean;
}

export async function validateContact(input: ContactInput): Promise<ValidContact> {
  const channel = String(input.channel ?? "").trim() as AlertChannel;
  if (!CHANNELS.includes(channel)) {
    throw new InvalidContactError(
      `Choose one of: ${CHANNELS.join(", ")}`
    );
  }

  const destination = String(input.destination ?? "").trim();
  if (!destination) throw new InvalidContactError("A destination is required");
  if (destination.length > 2048) throw new InvalidContactError("That destination is too long");

  switch (channel) {
    case "email":
      if (!EMAIL.test(destination)) {
        throw new InvalidContactError("That does not look like an email address");
      }
      break;

    case "fcm":
      if (destination.length < 10) {
        throw new InvalidContactError("Invalid device push token");
      }
      break;

    case "slack":
    case "discord":
    case "webhook":
      if (!/^https:\/\//i.test(destination)) {
        // Plain http would put the alert — and any secret in the URL — on the
        // wire in clear text.
        throw new InvalidContactError("The URL must start with https://");
      }
      await assertSafeUrl(destination);
      break;

    case "telegram":
      if (!/^-?\d{1,20}$/.test(input.telegramChatId ?? destination)) {
        throw new InvalidContactError(
          "Telegram needs a numeric chat id — message the bot, then use the id it replies with"
        );
      }
      break;
  }

  return {
    channel,
    name: String(input.name ?? "").trim().slice(0, 120) || destination,
    destination,
    telegramChatId: input.telegramChatId?.trim() || undefined,
    enabled: input.enabled !== false,
  };
}

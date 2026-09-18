import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { deliver, sendFcm, type AlertPayload } from "./channels.js";
import { setCustomMessaging } from "../sync/firebase.js";
import type { AlertContact } from "../types.js";

const payload: AlertPayload = {
  event: "down",
  monitorId: "m123",
  incidentId: "inc456",
  monitor: {
    id: "m123",
    name: "AI Inference Gateway",
    target: "https://ai.example.com/v1/chat",
  } as any,
  incident: {
    id: "inc456",
    startedAt: 1710000000000,
    cause: "HTTP 503 Service Unavailable",
  } as any,
};

describe("Firebase Cloud Messaging (FCM) Push Delivery", () => {
  let sentMessages: any[] = [];

  beforeEach(() => {
    sentMessages = [];
    setCustomMessaging({
      send: (async (msg: any) => {
        sentMessages.push(msg);
        return "msg_id_12345";
      }) as any,
    } as any);
  });

  afterEach(() => {
    setCustomMessaging(null);
  });

  test("sends high-priority push message with structured incident payload", async () => {
    await sendFcm("fcm_device_token_xyz", payload);

    assert.equal(sentMessages.length, 1);
    const msg = sentMessages[0];
    assert.equal(msg.token, "fcm_device_token_xyz");
    assert.match(msg.notification.title, /🔴 DOWN — AI Inference Gateway/);
    assert.equal(msg.data.monitorId, "m123");
    assert.equal(msg.data.event, "down");
    assert.equal(msg.data.cause, "HTTP 503 Service Unavailable");
    assert.equal(msg.data.click_action, "FLUTTER_NOTIFICATION_CLICK");
    assert.equal(msg.android.priority, "high");
    assert.equal(msg.android.notification.channelId, "uptime_alerts");
    assert.equal(msg.apns.payload.aps.interruptionLevel, "time-sensitive");
  });

  test("deliver() routes channel fcm to sendFcm", async () => {
    const contact: AlertContact = {
      id: "c_fcm_1",
      orgId: "org_1",
      channel: "fcm",
      name: "Taweechai's iPhone",
      destination: "fcm_token_iphone_abc",
      fcmToken: "fcm_token_iphone_abc",
      platform: "ios",
      enabled: true,
      verified: true,
    };

    await deliver(contact, payload, {});

    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].token, "fcm_token_iphone_abc");
  });
});

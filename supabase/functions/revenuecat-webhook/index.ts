// Deploy: supabase functions deploy revenuecat-webhook --no-verify-jwt
// JWT verification must be off — RevenueCat does not send a Supabase JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PENDING_STALE_MS = 5 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WebhookEvent = {
  type?: string;
  id?: string;
  app_user_id?: string;
  aliases?: string[];
  store?: string;
  environment?: string;
  product_id?: string;
};

function planFromProductId(productId: string | undefined): "monthly" | "annual" | null {
  if (!productId) return null;
  const lower = productId.toLowerCase();
  if (lower.includes("annual") || lower.includes("yearly")) return "annual";
  if (lower.includes("monthly")) return "monthly";
  return null;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authorizationMatches(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const expected = new TextEncoder().encode(secret);
  const actual = new TextEncoder().encode(header);
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected[i] ^ actual[i];
  }
  return diff === 0;
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function resolveUserId(event: WebhookEvent): string | null {
  const appUserId = event.app_user_id?.trim();
  if (appUserId && isUuid(appUserId)) {
    return appUserId;
  }

  for (const alias of event.aliases ?? []) {
    const id = alias?.trim();
    if (id && isUuid(id)) return id;
  }

  return null;
}

function storeLine(store: string | undefined): string {
  if (store === "APP_STORE") {
    return "On iPhone: Settings → your name → Subscriptions → Homeschool Hub";
  }
  if (store === "PLAY_STORE") {
    return "On Android: Play Store → Payments & subscriptions → Subscriptions";
  }
  return "Update your payment method in your app store's subscription settings.";
}

function billingIssueEmail(store: string | undefined): { subject: string; text: string; html: string } {
  const howToFix = storeLine(store);
  const subject = "We couldn't process your Homeschool Hub payment";
  const text = [
    "Hi,",
    "",
    "Your subscription payment didn't go through — usually an expired card or a billing address that's changed.",
    "",
    "Nothing's lost. Your store will try again over the next few days, and your access continues in the meantime. Updating your payment method now avoids any interruption.",
    "",
    howToFix,
    "",
    "If you've already sorted it out, you can ignore this.",
    "",
    "Questions? Just reply to this email.",
    "",
    "— Homeschool Hub",
    "support@thehomeschoolhub.app",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#FDF8F3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF8F3;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background-color:#ffffff;border-radius:16px;">
          <tr>
            <td style="padding:32px 28px 28px 28px;font-family:Georgia,'Times New Roman',serif;color:#1C1917;font-size:16px;line-height:24px;">
              <h1 style="margin:0 0 20px 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:28px;font-weight:700;color:#6D28D9;">${subject}</h1>
              <p style="margin:0 0 16px 0;">Hi,</p>
              <p style="margin:0 0 16px 0;">Your subscription payment didn't go through — usually an expired card or a billing address that's changed.</p>
              <p style="margin:0 0 16px 0;">Nothing's lost. Your store will try again over the next few days, and your access continues in the meantime. Updating your payment method now avoids any interruption.</p>
              <p style="margin:0 0 16px 0;">${howToFix}</p>
              <p style="margin:0 0 16px 0;">If you've already sorted it out, you can ignore this.</p>
              <p style="margin:0 0 24px 0;">Questions? Just reply to this email.</p>
              <p style="margin:0;color:#1C1917;">— Homeschool Hub</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#78716C;">
              <p style="margin:0;border-top:1px solid #E7E5E4;padding-top:16px;">
                Homeschool Hub<br />
                <a href="mailto:support@thehomeschoolhub.app" style="color:#6D28D9;text-decoration:none;">support@thehomeschoolhub.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

function isUserNotFoundError(error: { status?: number; code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.status === 404) return true;
  const message = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();
  return code === "user_not_found" || message.includes("user not found");
}

async function lookupEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error && !isUserNotFoundError(error)) {
    throw new Error(`auth.admin.getUserById failed: ${error.message}`);
  }
  const email = data.user?.email?.trim();
  if (!email) return null;
  return email;
}

async function sendResendEmail(to: string, store: string | undefined): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const { subject, text, html } = billingIssueEmail(store);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Homeschool Hub <support@thehomeschoolhub.app>",
      reply_to: "support@thehomeschoolhub.app",
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend failed (${response.status}): ${detail}`);
  }
}

async function loadEventRow(eventId: string) {
  const { data, error } = await supabase
    .from("revenuecat_webhook_events")
    .select("event_id, status, created_at")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function insertPending(eventId: string, eventType: string, userId: string | null) {
  const { error } = await supabase.from("revenuecat_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
    status: "pending",
    user_id: userId,
  });
  return error;
}

async function markSent(eventId: string, userId: string | null) {
  const { error } = await supabase
    .from("revenuecat_webhook_events")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      user_id: userId,
    })
    .eq("event_id", eventId);

  if (error) throw new Error(error.message);
}

function isPendingStale(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  return Date.now() - created >= PENDING_STALE_MS;
}

async function handleBillingIssue(event: WebhookEvent): Promise<Response> {
  const eventId = event.id?.trim();
  if (!eventId) {
    return jsonResponse({ error: "Missing event.id" }, 400);
  }

  const existing = await loadEventRow(eventId);

  if (existing?.status === "sent") {
    return jsonResponse({ ok: true, skipped: "already_sent" }, 200);
  }

  if (existing?.status === "pending" && !isPendingStale(existing.created_at)) {
    return jsonResponse({ ok: true, skipped: "in_flight" }, 200);
  }

  if (!existing) {
    const insertError = await insertPending(eventId, "BILLING_ISSUE", null);
    if (insertError) {
      const raced = await loadEventRow(eventId);
      if (raced?.status === "sent") {
        return jsonResponse({ ok: true, skipped: "already_sent" }, 200);
      }
      if (raced?.status === "pending" && !isPendingStale(raced.created_at)) {
        return jsonResponse({ ok: true, skipped: "in_flight" }, 200);
      }
      if (!raced) {
        throw new Error(insertError.message);
      }
    }
  }

  const userId = resolveUserId(event);
  if (!userId) {
    console.warn("revenuecat-webhook: no UUID in app_user_id or aliases", {
      eventId,
      app_user_id: event.app_user_id,
      aliases: event.aliases,
    });
    await markSent(eventId, null);
    return jsonResponse({ ok: true, skipped: "no_user" }, 200);
  }

  const email = await lookupEmail(userId);

  if (!email) {
    await markSent(eventId, userId);
    return jsonResponse({ ok: true, skipped: "no_email" }, 200);
  }

  await sendResendEmail(email, event.store);
  await markSent(eventId, userId);
  return jsonResponse({ ok: true, emailed: true }, 200);
}

async function handleSubscriptionConversion(event: WebhookEvent): Promise<Response> {
  const userId = resolveUserId(event);
  if (!userId) {
    console.warn("revenuecat-webhook: subscription event with no UUID", {
      type: event.type,
      app_user_id: event.app_user_id,
      aliases: event.aliases,
    });
    return jsonResponse({ ok: true, skipped: "no_user" }, 200);
  }

  const plan = planFromProductId(event.product_id);
  const { error } = await supabase.rpc("convert_user_trial_for_user", {
    p_user_id: userId,
    p_plan: plan,
  });

  if (error) {
    if (error.message.includes("No trial record found")) {
      console.warn("revenuecat-webhook: no trial row to convert", { userId, type: event.type });
      return jsonResponse({ ok: true, skipped: "no_trial" }, 200);
    }
    throw new Error(error.message);
  }

  return jsonResponse({ ok: true, converted: true }, 200);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";
  if (!authorizationMatches(req.headers.get("Authorization"), secret)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload: { event?: WebhookEvent };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const event = payload.event;
  if (!event?.type) {
    return jsonResponse({ error: "Missing event" }, 400);
  }

  try {
    switch (event.type) {
      case "BILLING_ISSUE":
        return await handleBillingIssue(event);
      case "INITIAL_PURCHASE":
      case "RENEWAL":
        return await handleSubscriptionConversion(event);
      case "EXPIRATION":
      case "CANCELLATION":
        return jsonResponse({ ok: true, skipped: event.type }, 200);
      default:
        return jsonResponse({ ok: true, ignored: event.type }, 200);
    }
  } catch (error) {
    console.error("revenuecat-webhook error:", error);
    return jsonResponse(
      { error: "Webhook handler failed", detail: String(error) },
      500
    );
  }
});

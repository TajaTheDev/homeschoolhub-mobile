# Deploy: supabase functions deploy email-unsubscribe --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function htmlPage(title: string, message: string, status: number): Response {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#FDF8F3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF8F3;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background-color:#ffffff;border-radius:16px;">
          <tr>
            <td style="padding:32px 28px;font-family:Georgia,'Times New Roman',serif;color:#1C1917;font-size:16px;line-height:24px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:28px;font-weight:700;color:#6D28D9;">${title}</h1>
              <p style="margin:0;">${message}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function extractToken(req: Request): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("token")?.trim();
  if (fromQuery) return fromQuery;

  return null;
}

async function unsubscribeByToken(token: string): Promise<Response> {
  const { data, error } = await supabase
    .from("email_preferences")
    .select("user_id, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (error) {
    console.error("email-unsubscribe lookup error:", error);
    return htmlPage("Something went wrong", "Please try again later or email support@thehomeschoolhub.app.", 500);
  }

  if (!data) {
    return htmlPage("Invalid link", "This unsubscribe link is not valid.", 400);
  }

  if (!data.unsubscribed_at) {
    const { error: updateError } = await supabase
      .from("email_preferences")
      .update({ unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", data.user_id);

    if (updateError) {
      console.error("email-unsubscribe update error:", updateError);
      return htmlPage("Something went wrong", "Please try again later or email support@thehomeschoolhub.app.", 500);
    }
  }

  return htmlPage(
    "You’re unsubscribed",
    "You won’t receive trial tips or lifecycle emails from Homeschool Hub. Billing notices about your subscription are separate and may still be sent when required.",
    200
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return htmlPage("Method not allowed", "This link only supports GET or POST.", 405);
  }

  const token = extractToken(req);
  if (!token) {
    return htmlPage("Missing token", "This unsubscribe link is incomplete.", 400);
  }

  return await unsubscribeByToken(token);
});

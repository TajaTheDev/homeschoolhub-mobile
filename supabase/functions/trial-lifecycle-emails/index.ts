// Deploy: supabase functions deploy trial-lifecycle-emails --no-verify-jwt
// Secrets: RESEND_API_KEY, TRIAL_EMAIL_CRON_SECRET, TRIAL_EMAIL_LAUNCH_AT (ISO UTC)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const MS_HOUR = 60 * 60 * 1000;
const MS_12H = 12 * MS_HOUR;
const MS_36H = 36 * MS_HOUR;

type TemplateKey =
  | "welcome"
  | "feature_curriculum"
  | "feature_attendance"
  | "feature_reports"
  | "progress_recap"
  | "reengage"
  | "converting"
  | "winback";

type UserTrialRow = {
  user_id: string;
  started_at: string;
  expires_at: string;
  status: string;
};

type ActivityMetrics = {
  studentCount: number;
  calendarLessons: number;
  sequenceCompletions: number;
  attendanceDays: number;
  booksTotal: number;
  booksFinished: number;
  subjectsEnrolled: number;
  subjectsWithActivity: number;
};

type EmailContent = {
  subject: string;
  text: string;
  html: string;
  listUnsubscribe: string;
};

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

function requireLaunchAt(): Date {
  const raw = Deno.env.get("TRIAL_EMAIL_LAUNCH_AT")?.trim();
  if (!raw) {
    throw new Error("TRIAL_EMAIL_LAUNCH_AT is not set");
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("TRIAL_EMAIL_LAUNCH_AT is not a valid ISO timestamp");
  }
  return parsed;
}

function trialStartedOnDayWindow(now: Date, day: number): { gte: string; lte: string } {
  const targetMs = now.getTime() - day * 24 * MS_HOUR;
  return {
    gte: new Date(targetMs - MS_12H).toISOString(),
    lte: new Date(targetMs + MS_12H).toISOString(),
  };
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
  return email || null;
}

async function fetchUnsubscribedUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("email_preferences")
    .select("user_id")
    .in("user_id", userIds)
    .not("unsubscribed_at", "is", null);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.user_id as string));
}

async function fetchLoggedTemplates(userIds: string[], templates: TemplateKey[]): Promise<Map<string, Set<string>>> {
  const logged = new Map<string, Set<string>>();
  if (userIds.length === 0) return logged;

  const { data, error } = await supabase
    .from("trial_email_log")
    .select("user_id, template")
    .in("user_id", userIds)
    .in("template", templates);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const userId = row.user_id as string;
    const template = row.template as string;
    if (!logged.has(userId)) logged.set(userId, new Set());
    logged.get(userId)!.add(template);
  }
  return logged;
}

async function ensurePreferences(userId: string): Promise<string> {
  const { data, error } = await supabase.rpc("ensure_email_preferences", {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  const token = (data as { unsubscribe_token?: string })?.unsubscribe_token;
  if (!token) throw new Error("ensure_email_preferences returned no token");
  return token;
}

function unsubscribeUrl(token: string): string {
  return `https://thehomeschoolhub.app/unsubscribe?token=${encodeURIComponent(token)}`;
}

function wrapEmailHtml(subject: string, bodyHtml: string, unsubUrl: string): string {
  return `<!DOCTYPE html>
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
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#78716C;">
              <p style="margin:0;border-top:1px solid #E7E5E4;padding-top:16px;">
                Homeschool Hub<br />
                <a href="mailto:support@thehomeschoolhub.app" style="color:#6D28D9;text-decoration:none;">support@thehomeschoolhub.app</a><br />
                <a href="${unsubUrl}" style="color:#6D28D9;text-decoration:none;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function ctaUrl(template: TemplateKey): string {
  const web = "https://thehomeschoolhub.app";

  // Custom-scheme deep links (homeschoolhubmobile://) fail silently when the
  // app isn't installed or mail is opened on desktop. Until Universal Links
  // exist, keep lifecycle CTAs on the website. Winback also stays on web
  // because we don't know which store the user used.
  const urls: Record<TemplateKey, string> = {
    welcome: `${web}/`,
    feature_curriculum: `${web}/#how`,
    feature_attendance: `${web}/`,
    feature_reports: `${web}/`,
    progress_recap: `${web}/`,
    reengage: `${web}/`,
    converting: `${web}/#pricing`,
    winback: `${web}/#pricing`,
  };
  return urls[template];
}


function buildMetricsLines(metrics: ActivityMetrics | undefined): string[] {
  if (!metrics) return [];

  const lines: string[] = [];
  if (metrics.calendarLessons > 0) {
    lines.push(`**${metrics.calendarLessons} ${pluralize(metrics.calendarLessons, "lesson")} logged**`);
  } else if (metrics.sequenceCompletions > 0) {
    lines.push(
      `**${metrics.sequenceCompletions} ${pluralize(metrics.sequenceCompletions, "lesson")} checked off in your sequence**`
    );
  }

  if (metrics.attendanceDays > 0) {
    lines.push(`**${metrics.attendanceDays} ${pluralize(metrics.attendanceDays, "school day")} marked**`);
  }
  if (metrics.booksTotal > 0) {
    lines.push(`**${metrics.booksTotal} ${pluralize(metrics.booksTotal, "book")} in the reading log**`);
  }
  if (metrics.subjectsWithActivity > 0) {
    lines.push(`**${metrics.subjectsWithActivity} ${pluralize(metrics.subjectsWithActivity, "subject")} on the go**`);
  }

  return lines;
}

function renderTextBody(paragraphs: string[], ctaLabel: string, ctaHref: string, signoff = "— Taja"): string {
  return [
    "Hi,",
    "",
    ...paragraphs,
    "",
    `[${ctaLabel}]`,
    ctaHref,
    "",
    signoff,
    "support@thehomeschoolhub.app",
  ].join("\n");
}

function renderHtmlBody(
  subject: string,
  paragraphs: string[],
  ctaLabel: string,
  ctaHref: string,
  unsubUrl: string,
  signoff = "— Taja"
): string {
  const htmlParagraphs = paragraphs
    .map((paragraph) => {
      const withBold = escapeHtml(paragraph).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      return `<p style="margin:0 0 16px 0;">${withBold}</p>`;
    })
    .join("");

  const cta = `<p style="margin:0 0 24px 0;"><a href="${escapeHtml(
    ctaHref
  )}" style="display:inline-block;background-color:#6D28D9;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;">${escapeHtml(
    ctaLabel
  )}</a></p>`;

  return wrapEmailHtml(
    subject,
    `<h1 style="margin:0 0 20px 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:28px;font-weight:700;color:#6D28D9;">${escapeHtml(
      subject
    )}</h1>
<p style="margin:0 0 16px 0;">Hi,</p>
${htmlParagraphs}
${cta}
<p style="margin:0;color:#1C1917;">${escapeHtml(signoff)}</p>`,
    unsubUrl
  );
}

function buildEmail(
  template: TemplateKey,
  subject: string,
  paragraphs: string[],
  ctaLabel: string,
  unsubUrl: string
): EmailContent {
  const href = ctaUrl(template);
  const text = `${renderTextBody(paragraphs, ctaLabel, href)}\n\nUnsubscribe: ${unsubUrl}`;
  const html = renderHtmlBody(subject, paragraphs, ctaLabel, href, unsubUrl);
  return { subject, text, html, listUnsubscribe: unsubUrl };
}

function buildPlaceholderEmail(template: TemplateKey, unsubUrl: string, metrics?: ActivityMetrics): EmailContent {
  const recapLines = buildMetricsLines(metrics);

  switch (template) {
    case "welcome":
      return buildEmail(
        template,
        "Welcome to Homeschool Hub",
        [
          "You're in. Here's the only thing worth doing today: **add your first student.** It takes about thirty seconds, and nothing else in the app works until you have.",
          "Over the next few weeks I'll show you the parts that save the most time — scanning a curriculum's contents page, tracking attendance, and the reports that come out at the end of it all.",
          "No rush. The app doesn't mind if you fall behind.",
        ],
        "Add your first student",
        unsubUrl
      );
    case "feature_curriculum":
      return buildEmail(
        template,
        "Turn your curriculum's contents page into a lesson plan",
        [
          "This is the part most people don't find on their own, and it's the reason a lot of families stay.",
          "Open any curriculum you're using. Photograph the table of contents. The app reads it and turns every chapter into a lesson you can schedule — the whole term in one go, instead of typing lessons one evening at a time.",
          "It works with anything: Saxon, Apologia, Story of the World, the workbook you found at a used-book sale.",
        ],
        "Scan a curriculum",
        unsubUrl
      );
    case "feature_attendance":
      return buildEmail(
        template,
        "The five seconds that save you in June",
        [
          "Attendance is the thing every homeschool parent means to track and almost nobody keeps up with — until a form arrives asking how many days you schooled this year.",
          "In the app it's one tap from the home screen. Present or absent, per child, done. Forgot yesterday? You can go back and fix it.",
          "Most states require a minimum number of instructional days. Reconstructing them in June from memory is miserable. Five seconds a day means you never have to.",
        ],
        "Mark today's attendance",
        unsubUrl
      );
    case "feature_reports":
      return buildEmail(
        template,
        "What all this logging is actually for",
        [
          "Two weeks in, you've been writing things down. Here's what that turns into.",
          "**An academic transcript** — a formal document with subjects, curricula, lessons completed and grades, ready for a state submission, an umbrella school, or a college application.",
          "**A year in review** — a warmer thing entirely. Lessons completed, books read, school days logged, photos from the year. Something worth printing.",
          "Both are one tap in Settings → Export Data. They pull from everything you've already logged, so there's nothing extra to fill in.",
        ],
        "See your reports",
        unsubUrl
      );
    case "progress_recap":
      return buildEmail(
        template,
        "Your first three weeks",
        [
          "Here's what you've got in Homeschool Hub so far:",
          ...recapLines,
          "That's three weeks of school, written down. If someone asked you today what you'd covered, you could show them.",
        ],
        "Open your progress",
        unsubUrl
      );
    case "reengage":
      return buildEmail(
        template,
        "Still there?",
        [
          "You signed up three weeks ago and haven't logged anything yet. That's usually not about the app — it's a term that started badly, or a week that got away, or you opened it once and life happened.",
          "If you want to give it another go, there's one thing to do: **log a single lesson.** Not a plan, not a system. One lesson, whatever you did today.",
          "And if it's not the right tool for your family, that's genuinely fine — you can ignore this and nothing will chase you.",
          "If something specific got in the way, hit reply and tell me. I read every one.",
        ],
        "Log one lesson",
        unsubUrl
      );
    case "converting":
      return buildEmail(
        template,
        "A quick note about your trial",
        [
          "Your trial ends in a few days, so here's the honest version.",
          "Homeschool Hub is **$4.99 a month, or $49.99 a year** — about $4.16 a month if you pay yearly. Most families pick annual, because a school year is a year.",
          "Everything you've logged stays yours either way. Nothing gets deleted if you don't subscribe — it just goes read-only until you do.",
          "No countdown, no scarcity. If it's earning its place, keep it. If it isn't, you'll know.",
        ],
        "See your options",
        unsubUrl
      );
    case "winback":
      return buildEmail(
        template,
        "Your records are still here",
        [
          "Your trial ended a few days ago. Everything you logged is still in there — the lessons, the attendance, the books. Nothing was deleted and nothing will be.",
          "If you want it back, subscribing picks up exactly where you left off. And if the timing's wrong, it'll keep. Come back in September when the term starts and it'll be waiting.",
          "Either way — thank you for trying it. If there was a specific reason it didn't fit, I'd genuinely like to know. Just reply.",
        ],
        "Pick up where you left off",
        unsubUrl
      );
  }
}

async function sendResendEmail(to: string, content: EmailContent): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

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
      subject: content.subject,
      text: content.text,
      html: content.html,
      headers: {
        "List-Unsubscribe": `<${content.listUnsubscribe}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend failed (${response.status}): ${detail}`);
  }
}

async function logSent(userId: string, template: TemplateKey): Promise<void> {
  const { error } = await supabase.from("trial_email_log").insert({ user_id: userId, template });
  if (error) {
    if (error.code === "23505") return;
    throw new Error(error.message);
  }
}

async function getStudentIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("students").select("id").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

async function fetchActivityMetrics(userId: string, studentIds: string[], trialStartedAt: string): Promise<ActivityMetrics> {
  const startedDate = trialStartedAt.slice(0, 10);

  const metrics: ActivityMetrics = {
    studentCount: studentIds.length,
    calendarLessons: 0,
    sequenceCompletions: 0,
    attendanceDays: 0,
    booksTotal: 0,
    booksFinished: 0,
    subjectsEnrolled: 0,
    subjectsWithActivity: 0,
  };

  if (studentIds.length === 0) return metrics;

  const { count: calendarLessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("completed", true)
    .gte("date", startedDate);
  if (lessonsError) throw new Error(lessonsError.message);
  metrics.calendarLessons = calendarLessons ?? 0;

  const { count: sequenceCompletions, error: completionsError } = await supabase
    .from("lesson_completions")
    .select("id", { count: "exact", head: true })
    .in("student_id", studentIds)
    .is("school_year_archive_id", null)
    .gte("date", startedDate);
  if (completionsError) throw new Error(completionsError.message);
  metrics.sequenceCompletions = sequenceCompletions ?? 0;

  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("attendance")
    .select("date")
    .eq("user_id", userId)
    .eq("present", true)
    .gte("date", startedDate);
  if (attendanceError) throw new Error(attendanceError.message);
  metrics.attendanceDays = new Set((attendanceRows ?? []).map((row) => row.date as string)).size;

  const { count: booksTotal, error: booksError } = await supabase
    .from("reading_log")
    .select("id", { count: "exact", head: true })
    .in("student_id", studentIds)
    .gte("created_at", trialStartedAt);
  if (booksError) throw new Error(booksError.message);
  metrics.booksTotal = booksTotal ?? 0;

  const { count: booksFinished, error: finishedError } = await supabase
    .from("reading_log")
    .select("id", { count: "exact", head: true })
    .in("student_id", studentIds)
    .eq("status", "finished")
    .gte("created_at", trialStartedAt);
  if (finishedError) throw new Error(finishedError.message);
  metrics.booksFinished = booksFinished ?? 0;

  const { count: subjectsEnrolled, error: subjectsError } = await supabase
    .from("student_subjects")
    .select("id", { count: "exact", head: true })
    .in("student_id", studentIds);
  if (subjectsError) throw new Error(subjectsError.message);
  metrics.subjectsEnrolled = subjectsEnrolled ?? 0;

  const activeSubjects = new Set<string>();

  const { data: lessonSubjects, error: lessonSubjectsError } = await supabase
    .from("lessons")
    .select("subject")
    .eq("user_id", userId)
    .eq("completed", true)
    .gte("date", startedDate);
  if (lessonSubjectsError) throw new Error(lessonSubjectsError.message);
  for (const row of lessonSubjects ?? []) {
    const subject = (row.subject as string)?.trim();
    if (subject) activeSubjects.add(subject);
  }

  const { data: completionSubjects, error: completionSubjectsError } = await supabase
    .from("lesson_completions")
    .select("subject")
    .in("student_id", studentIds)
    .is("school_year_archive_id", null)
    .gte("date", startedDate);
  if (completionSubjectsError) throw new Error(completionSubjectsError.message);
  for (const row of completionSubjects ?? []) {
    const subject = (row.subject as string)?.trim();
    if (subject) activeSubjects.add(subject);
  }

  metrics.subjectsWithActivity = activeSubjects.size;
  return metrics;
}

function hasAnyActivity(metrics: ActivityMetrics): boolean {
  return (
    metrics.studentCount > 0 &&
    (metrics.calendarLessons > 0 ||
      metrics.sequenceCompletions > 0 ||
      metrics.attendanceDays > 0 ||
      metrics.booksTotal > 0)
  );
}

async function queryActiveTrials(
  launchAt: Date,
  extra: { startedGte?: string; startedLte?: string; expiresGte?: string; expiresLte?: string }
): Promise<UserTrialRow[]> {
  let query = supabase
    .from("user_trials")
    .select("user_id, started_at, expires_at, status")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .gte("started_at", launchAt.toISOString());

  if (extra.startedGte) query = query.gte("started_at", extra.startedGte);
  if (extra.startedLte) query = query.lte("started_at", extra.startedLte);
  if (extra.expiresGte) query = query.gte("expires_at", extra.expiresGte);
  if (extra.expiresLte) query = query.lte("expires_at", extra.expiresLte);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as UserTrialRow[];
}

async function queryWinbackTrials(launchAt: Date, now: Date): Promise<UserTrialRow[]> {
  const expiresGte = new Date(now.getTime() - 3 * 24 * MS_HOUR - MS_12H).toISOString();
  const expiresLte = new Date(now.getTime() - 3 * 24 * MS_HOUR + MS_12H).toISOString();

  const { data, error } = await supabase
    .from("user_trials")
    .select("user_id, started_at, expires_at, status")
    .eq("status", "expired")
    .is("converted_at", null)
    .gte("started_at", launchAt.toISOString())
    .gte("expires_at", expiresGte)
    .lte("expires_at", expiresLte);

  if (error) throw new Error(error.message);
  return (data ?? []) as UserTrialRow[];
}

async function filterDueUsers(rows: UserTrialRow[], template: TemplateKey): Promise<UserTrialRow[]> {
  if (rows.length === 0) return [];
  const userIds = rows.map((row) => row.user_id);
  const [unsubscribed, logged] = await Promise.all([
    fetchUnsubscribedUserIds(userIds),
    fetchLoggedTemplates(userIds, [template]),
  ]);

  return rows.filter((row) => {
    if (unsubscribed.has(row.user_id)) return false;
    if (logged.get(row.user_id)?.has(template)) return false;
    return true;
  });
}

async function sendTemplateToUsers(
  rows: UserTrialRow[],
  template: TemplateKey,
  metricsByUser?: Map<string, ActivityMetrics>
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    const email = await lookupEmail(row.user_id);
    if (!email) {
      skipped += 1;
      continue;
    }

    const token = await ensurePreferences(row.user_id);
    const unsubUrl = unsubscribeUrl(token);
    const metrics = metricsByUser?.get(row.user_id);
    const content = buildPlaceholderEmail(template, unsubUrl, metrics);

    await sendResendEmail(email, content);
    await logSent(row.user_id, template);
    sent += 1;
  }

  return { sent, skipped };
}

async function runDay22(now: Date, launchAt: Date): Promise<{ progress_recap: number; reengage: number; skipped: number }> {
  const window = trialStartedOnDayWindow(now, 22);
  const candidates = await queryActiveTrials(launchAt, {
    startedGte: window.gte,
    startedLte: window.lte,
  });

  if (candidates.length === 0) return { progress_recap: 0, reengage: 0, skipped: 0 };

  const userIds = candidates.map((row) => row.user_id);
  const [unsubscribed, logged] = await Promise.all([
    fetchUnsubscribedUserIds(userIds),
    fetchLoggedTemplates(userIds, ["progress_recap", "reengage"]),
  ]);

  const due = candidates.filter((row) => {
    if (unsubscribed.has(row.user_id)) return false;
    const templates = logged.get(row.user_id);
    if (templates?.has("progress_recap") || templates?.has("reengage")) return false;
    return true;
  });

  const recapRows: UserTrialRow[] = [];
  const reengageRows: UserTrialRow[] = [];
  const metricsByUser = new Map<string, ActivityMetrics>();

  for (const row of due) {
    const studentIds = await getStudentIds(row.user_id);
    const metrics = await fetchActivityMetrics(row.user_id, studentIds, row.started_at);
    if (hasAnyActivity(metrics)) {
      recapRows.push(row);
      metricsByUser.set(row.user_id, metrics);
    } else {
      reengageRows.push(row);
    }
  }

  const recapResult = await sendTemplateToUsers(recapRows, "progress_recap", metricsByUser);
  const reengageResult = await sendTemplateToUsers(reengageRows, "reengage");

  return {
    progress_recap: recapResult.sent,
    reengage: reengageResult.sent,
    skipped: recapResult.skipped + reengageResult.skipped,
  };
}

async function runLifecycleJob(): Promise<Record<string, unknown>> {
  const now = new Date();
  const launchAt = requireLaunchAt();
  const results: Record<string, unknown> = { ok: true, at: now.toISOString(), launchAt: launchAt.toISOString() };

  const welcomeRows = await queryActiveTrials(launchAt, {
    startedGte: new Date(now.getTime() - MS_36H).toISOString(),
  });
  const welcomeDue = await filterDueUsers(welcomeRows, "welcome");
  results.welcome = await sendTemplateToUsers(welcomeDue, "welcome");

  for (const day of [3, 7, 14] as const) {
    const template =
      day === 3 ? "feature_curriculum" : day === 7 ? "feature_attendance" : "feature_reports";
    const window = trialStartedOnDayWindow(now, day);
    const rows = await queryActiveTrials(launchAt, { startedGte: window.gte, startedLte: window.lte });
    const due = await filterDueUsers(rows, template);
    results[template] = await sendTemplateToUsers(due, template);
  }

  results.day22 = await runDay22(now, launchAt);

  const convertingWindow = {
    expiresGte: new Date(now.getTime() + 4 * 24 * MS_HOUR + MS_12H).toISOString(),
    expiresLte: new Date(now.getTime() + 5 * 24 * MS_HOUR + MS_12H).toISOString(),
  };
  const convertingRows = await queryActiveTrials(launchAt, convertingWindow);
  const convertingDue = await filterDueUsers(convertingRows, "converting");
  results.converting = await sendTemplateToUsers(convertingDue, "converting");

  const winbackRows = await queryWinbackTrials(launchAt, now);
  const winbackDue = await filterDueUsers(winbackRows, "winback");
  results.winback = await sendTemplateToUsers(winbackDue, "winback");

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("TRIAL_EMAIL_CRON_SECRET") ?? "";
  if (!authorizationMatches(req.headers.get("Authorization"), secret)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const results = await runLifecycleJob();
    return jsonResponse(results, 200);
  } catch (error) {
    console.error("trial-lifecycle-emails error:", error);
    return jsonResponse(
      { error: "Lifecycle job failed", detail: String(error) },
      500
    );
  }
});

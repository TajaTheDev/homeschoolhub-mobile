// supabase/functions/extract-toc/index.ts  (v2 — multi-page support)
// Accepts multiple TOC image paths, sends all to Claude Vision in one call.
// Deploy: supabase functions deploy extract-toc --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function downloadImage(
  path: string
): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const { data, error } = await supabase.storage
      .from("curriculum-toc")
      .download(path);
    if (error || !data) return null;
    const buf = await data.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const ext = path.split(".").pop()?.toLowerCase() ?? "jpg";
    return {
      base64: toBase64(bytes),
      mediaType: ext === "png" ? "image/png" : "image/jpeg",
    };
  } catch {
    return null;
  }
}

async function extractFromImages(
  images: { base64: string; mediaType: string }[]
): Promise<string[]> {
  // Build content array: all images first, then the prompt
  const content: unknown[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mediaType, data: img.base64 },
  }));

  const pageNote =
    images.length > 1
      ? `These are ${images.length} pages of the same table of contents, in order. `
      : "";

  content.push({
    type: "text",
    text: `${pageNote}Extract ALL lesson and chapter titles from this table of contents in order across all pages.

Return ONLY a valid JSON array of strings. Each string is one lesson or chapter title.
Do not include page numbers, descriptions, or extra text.
Do not include broad unit/section headers unless they are themselves lesson titles.
Preserve original titles exactly as written.

Example: ["Lesson 1 — Place Value", "Lesson 2 — Even and Odd Numbers"]

Return ONLY the JSON array — nothing else.`,
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const raw = (data.content?.[0]?.text ?? "[]")
    .trim()
    .replace(/^```json\s*/, "")
    .replace(/\s*```$/, "");

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();

    // Accept either storage_paths[] (multi-page) or lesson_plan_id (legacy single)
    let storagePaths: string[] = [];

    if (body.storage_paths && Array.isArray(body.storage_paths)) {
      storagePaths = body.storage_paths;
    } else if (body.lesson_plan_id) {
      // Legacy: look up the single path from lesson_plans
      const { data: plan } = await supabase
        .from("lesson_plans")
        .select("toc_image_path")
        .eq("id", body.lesson_plan_id)
        .single();
      if (plan?.toc_image_path) storagePaths = [plan.toc_image_path];
    }

    if (storagePaths.length === 0) {
      return new Response(
        JSON.stringify({ error: "No image paths provided" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Download all images in parallel
    const imageResults = await Promise.all(
      storagePaths.map((p) => downloadImage(p))
    );
    const images = imageResults.filter(
      (img): img is { base64: string; mediaType: string } => img !== null
    );

    if (images.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to download images" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const titles = await extractFromImages(images);

    return new Response(
      JSON.stringify({ titles, count: titles.length }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("extract-toc error:", err);
    return new Response(
      JSON.stringify({ error: "Extraction failed", detail: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});

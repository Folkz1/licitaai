// Internal scheduler for LicitaAI cron jobs
// Runs inside the Next.js server process on EasyPanel (long-lived Docker container)

export async function register() {
  // Only run server-side, not during build or on edge
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Skip during build
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) return;

  const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const CRON_SECRET = process.env.CRON_SECRET || "licitai-cron-2026";

  const headers = {
    Authorization: `Bearer ${CRON_SECRET}`,
    "Content-Type": "application/json",
  };

  async function callCron(path: string, method: "GET" | "POST" = "POST") {
    try {
      const res = await fetch(`${APP_URL}${path}`, {
        method,
        headers,
        signal: AbortSignal.timeout(300_000), // 5min timeout
      });
      const data = await res.json().catch(() => ({}));
      console.log(`[SCHEDULER] ${path} -> ${res.status}`, JSON.stringify(data).slice(0, 200));
    } catch (err) {
      console.error(`[SCHEDULER] ${path} failed:`, err instanceof Error ? err.message : err);
    }
  }

  // Wait for server to be fully ready
  await new Promise((r) => setTimeout(r, 15_000));
  console.log("[SCHEDULER] Starting internal cron scheduler...");

  // Execute (tenant workflows) - every 15 min
  setInterval(() => callCron("/api/cron/execute", "GET"), 15 * 60 * 1000);

  // Nurturing (lead WhatsApp sequences) - every 10 min
  setInterval(() => callCron("/api/cron/nurturing"), 10 * 60 * 1000);

  // Lead alerts (daily matches) - every 6 hours
  setInterval(() => callCron("/api/cron/lead-alerts"), 6 * 60 * 60 * 1000);

  // Blog generation - every 12 hours (handler checks day-of-week internally)
  setInterval(() => callCron("/api/cron/blog-generate"), 12 * 60 * 60 * 1000);

  // Prospect status updates (trial tracking) - every 6 hours
  setInterval(() => callCron("/api/cron/prospect-status"), 6 * 60 * 60 * 1000);

  // Scrape PNCP (daily portal sync) - every 24 hours
  setInterval(
    () => callCron("/api/cron/scrape-pncp", "GET"),
    24 * 60 * 60 * 1000
  );

  // Run initial batch after startup (staggered to avoid overload)
  setTimeout(() => callCron("/api/cron/execute", "GET"), 20_000);
  setTimeout(() => callCron("/api/cron/nurturing"), 40_000);
  setTimeout(() => callCron("/api/cron/scrape-pncp", "GET"), 60_000);

  console.log("[SCHEDULER] Cron jobs registered:");
  console.log("  - /api/cron/execute         -> every 15 min");
  console.log("  - /api/cron/nurturing       -> every 10 min");
  console.log("  - /api/cron/lead-alerts     -> every 6 hours");
  console.log("  - /api/cron/prospect-status -> every 6 hours");
  console.log("  - /api/cron/blog-generate   -> every 12 hours");
  console.log("  - /api/cron/scrape-pncp     -> every 24 hours");
}

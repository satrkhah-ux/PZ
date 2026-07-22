// بوت تليغرام لإحصائيات بيزارا كافيه — /today /week /month
// Long-polling stats bot. Reads the daily rollup via the service-role key
// (range_summary is service-role-only because it exposes profit).
// Run: npm run bot   (needs TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_CHAT_IDS in .env.local)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv() {
  try {
    const raw = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m && process.env[m[1]] === undefined) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {
    /* rely on real env */
  }
}
loadEnv();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNERS = (process.env.TELEGRAM_OWNER_CHAT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN غير مضبوط في .env.local — أنشئ بوت عبر @BotFather وضع التوكن ثم أعد التشغيل.");
  process.exit(1);
}
if (!URL || !SVC) {
  console.error("Supabase env غير مكتمل (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

// Baghdad is UTC+3 year-round (no DST).
function baghdadDay(offsetDays = 0) {
  return new Date(Date.now() + 3 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);
}

async function summary(from, to) {
  const r = await fetch(`${URL}/rest/v1/rpc/range_summary`, {
    method: "POST",
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_from: from, p_to: to }),
  });
  if (!r.ok) throw new Error(`range_summary HTTP ${r.status}`);
  return r.json();
}

const fmt = (n) => new Intl.NumberFormat("en-US").format(n);

function report(title, rows) {
  const t = rows.reduce(
    (a, d) => ({
      sales: a.sales + Number(d.sales),
      cnt: a.cnt + Number(d.orders_count),
      profit: a.profit + Number(d.profit),
      exp: a.exp + Number(d.expenses),
      net: a.net + Number(d.net),
    }),
    { sales: 0, cnt: 0, profit: 0, exp: 0, net: 0 },
  );
  return [
    `☕️ <b>بيزارا كافيه — ${title}</b>`,
    "",
    `🧾 الطلبات: <b>${t.cnt}</b>`,
    `💰 المبيعات: <b>${fmt(t.sales)} د.ع</b>`,
    `📈 الأرباح: <b>${fmt(t.profit)} د.ع</b>`,
    `📉 المصروفات: <b>${fmt(t.exp)} د.ع</b>`,
    `✅ الصافي: <b>${fmt(t.net)} د.ع</b>`,
  ].join("\n");
}

async function send(chatId, text) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

console.log("✓ bot started (long polling)…");
await fetch(`${API}/deleteWebhook`).catch(() => {});

let offset = 0;
// ponytail: single long-poll loop, no sessions/state — this bot only answers stats.
for (;;) {
  try {
    const r = await fetch(`${API}/getUpdates?timeout=30&offset=${offset}`);
    const j = await r.json();
    for (const u of j.result ?? []) {
      offset = u.update_id + 1;
      const msg = u.message;
      if (!msg?.text) continue;
      const chatId = String(msg.chat.id);

      if (OWNERS.length && !OWNERS.includes(chatId)) {
        await send(chatId, `غير مصرّح لك بهذا البوت.\nمعرّفك: <code>${chatId}</code> — أعطه للمدير لإضافتك.`);
        continue;
      }

      const cmd = msg.text.trim().split(/[\s@]/)[0];
      const today = baghdadDay();
      try {
        if (cmd === "/start" || cmd === "/help") {
          await send(chatId, "أوامر بيزارا كافيه:\n/today — إحصائيات اليوم\n/week — آخر ٧ أيام\n/month — آخر ٣٠ يوم");
        } else if (cmd === "/today" || cmd === "اليوم") {
          await send(chatId, report(`اليوم ${today}`, await summary(today, today)));
        } else if (cmd === "/week" || cmd === "الأسبوع") {
          await send(chatId, report("آخر ٧ أيام", await summary(baghdadDay(-6), today)));
        } else if (cmd === "/month" || cmd === "الشهر") {
          await send(chatId, report("آخر ٣٠ يوماً", await summary(baghdadDay(-29), today)));
        }
      } catch (e) {
        await send(chatId, `تعذّر جلب البيانات: ${e.message}`);
      }
    }
  } catch (e) {
    console.error("poll error:", e.message);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

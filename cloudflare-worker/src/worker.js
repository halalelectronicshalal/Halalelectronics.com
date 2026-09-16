/**
 * Halal Electronics — Unified Cloudflare Worker
 * ------------------------------------------------------------------
 * ሦስቱ Worker (halalelectronics + halal-electronics-api + halal-sms-worker)
 * በዚህ አንድ ፋይል ውስጥ ተዋህደዋል።
 *
 * Endpoints (ሁሉም POST):
 *   /sendSms                     → AfroMessage SMS
 *   /sendTelegramMessage         → ጽሑፍ (+ አማራጭ inline button)
 *   /sendTelegramLocation        → ሥፍራ
 *   /sendTelegramPhoto           → አንድ ፎቶ (dataUrl)
 *   /sendTelegramMediaGroup      → 1–10 ፎቶዎች
 *   /telegramConnectPoll         → ቴክኒሺያን የቴሌግራም መለያ ማገናኛ
 *   /verifyAdminMasterPassword   → የአድሚን ይለፍ ቃል ማረጋገጫ
 *   /changeAdminMasterPassword   → የአድሚን ይለፍ ቃል መቀየሪያ
 *   /verifyFinancePassword       → የፋይናንስ ይለፍ ቃል ማረጋገጫ
 *
 * GET /health → የጤና ምርመራ (secrets የተሟሉ መሆኑን ያሳያል፤ ዋጋቸውን አያሳይም)
 *
 * ⚠️ ማንኛውም token/password በዚህ ፋይል ውስጥ በግልጽ አይጻፍም።
 *    ሁሉም በ `wrangler secret put` ብቻ ነው የሚገባው።
 */

/* ------------------------------------------------------------------ */
/* CORS                                                                */
/* ------------------------------------------------------------------ */

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const raw = (env && env.ALLOWED_ORIGINS) || "";
  const allowList = raw.split(",").map((s) => s.trim()).filter(Boolean);

  // ALLOWED_ORIGINS ካልተቀመጠ → ሁሉንም ፍቀድ (ወደ ኋላ ተኳሃኝ)
  let allowOrigin = "*";
  if (allowList.length) {
    allowOrigin = allowList.includes(origin) ? origin : allowList[0];
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request, env),
    },
  });
}

/* ------------------------------------------------------------------ */
/* Rate limiting — ቋሚ መስኮት (fixed window)                              */
/* ------------------------------------------------------------------ */

async function throttle(env, key, limit = 5, windowSeconds = 60) {
  if (!env.HALAL_KV) return true; // KV ካልታሰረ አታግድ
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const k = `throttle:${key}:${bucket}`;
  try {
    const current = parseInt((await env.HALAL_KV.get(k)) || "0", 10);
    if (current >= limit) return false;
    await env.HALAL_KV.put(k, String(current + 1), {
      expirationTtl: Math.max(60, windowSeconds * 2),
    });
    return true;
  } catch (e) {
    return true;
  }
}

/* ------------------------------------------------------------------ */
/* Password hashing (PBKDF2 + constant-time compare)                   */
/* ------------------------------------------------------------------ */

const PBKDF2_ITERATIONS = 100000;

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const bytes = String(hex).match(/.{2}/g) || [];
  return new Uint8Array(bytes.map((h) => parseInt(h, 16)));
}

async function deriveBits(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(password, salt);
  return `${toHex(salt)}:${toHex(bits)}`;
}

function constantTimeEqual(a, b) {
  const A = String(a);
  const B = String(b);
  if (A.length !== B.length) return false;
  let diff = 0;
  for (let i = 0; i < A.length; i++) diff |= A.charCodeAt(i) ^ B.charCodeAt(i);
  return diff === 0;
}

async function verifyPasswordHash(password, stored) {
  const [saltHex, hashHex] = String(stored || "").split(":");
  if (!saltHex || !hashHex) return false;
  const bits = await deriveBits(password, fromHex(saltHex));
  return constantTimeEqual(toHex(bits), hashHex);
}

/* ------------------------------------------------------------------ */
/* Telegram helpers                                                    */
/* ------------------------------------------------------------------ */

function tgToken(env, n) {
  const token = n === 2 ? env.TELEGRAM_BOT_TOKEN_2 : env.TELEGRAM_BOT_TOKEN_1;
  if (!token) throw new Error(`TELEGRAM_BOT_TOKEN_${n} is not configured`);
  return token;
}

function chatId(env, n) {
  return n === 2 ? env.TELEGRAM_CHAT_ID_2 : env.TELEGRAM_CHAT_ID_1;
}

async function tgFetch(token, method, body) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function dataUrlToBlob(dataUrl) {
  const match = typeof dataUrl === "string" && dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: match[1] });
  } catch (e) {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* AfroMessage SMS                                                     */
/* ------------------------------------------------------------------ */

async function sendAfroMessageSms(body, env, request) {
  const to = body.to || body.phone;
  const message = body.message;

  if (!to || !message) {
    return json({ success: false, message: "Missing required fields: to, message" }, 400, request, env);
  }

  const token = env.AFROMESSAGE_TOKEN;
  const identifierId = env.AFROMESSAGE_IDENTIFIER_ID;
  const senderName = env.AFROMESSAGE_SENDER_NAME;

  if (!token || !identifierId) {
    return json(
      {
        success: false,
        message: "Server misconfigured: missing AFROMESSAGE_TOKEN or AFROMESSAGE_IDENTIFIER_ID",
      },
      500,
      request,
      env
    );
  }

  const params = new URLSearchParams({ from: identifierId, to: String(to), message: String(message) });
  if (senderName) params.set("sender", senderName);

  const res = await fetch(`https://api.afromessage.com/api/send?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  let result;
  try {
    result = await res.json();
  } catch (e) {
    result = { success: false, message: "AfroMessage returned a non-JSON response" };
  }
  return json(result, res.status, request, env);
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    // GET /health — ምንም ምስጢር ሳያሳይ ውቅሩ የተሟላ መሆኑን ይነግርሃል
    if (request.method === "GET" && (path === "health" || path === "")) {
      return json(
        {
          ok: true,
          worker: "halalelectronics (unified)",
          time: new Date().toISOString(),
          config: {
            kv: Boolean(env.HALAL_KV),
            telegram1: Boolean(env.TELEGRAM_BOT_TOKEN_1),
            telegram2: Boolean(env.TELEGRAM_BOT_TOKEN_2),
            chatId1: Boolean(env.TELEGRAM_CHAT_ID_1),
            chatId2: Boolean(env.TELEGRAM_CHAT_ID_2),
            afroToken: Boolean(env.AFROMESSAGE_TOKEN),
            afroIdentifier: Boolean(env.AFROMESSAGE_IDENTIFIER_ID),
            adminPassword: Boolean(env.ADMIN_MASTER_PASSWORD),
            financePassword: Boolean(env.FINANCE_PASSWORD),
          },
        },
        200,
        request,
        env
      );
    }

    if (request.method !== "POST") {
      return json({ error: "POST only" }, 405, request, env);
    }

    let body = {};
    try {
      body = (await request.json()) || {};
    } catch (e) {
      body = {};
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

    // ከድሮው halal-sms-worker ጋር ተኳሃኝነት፦ path ባይኖርም SMS ይላካል
    const looksLikeSms =
      body.action === "sendSms" || (!path && (body.phone || body.to) && body.message);

    try {
      if (path === "sendSms" || looksLikeSms) {
        if (!(await throttle(env, "sms:" + ip, 20, 60))) {
          return json({ success: false, message: "too many requests" }, 429, request, env);
        }
        return await sendAfroMessageSms(body, env, request);
      }

      switch (path) {
        /* ---------------- Telegram ---------------- */

        case "sendTelegramMessage": {
          const { text, targetChatId, buttonText, buttonUrl } = body;
          if (!text || typeof text !== "string" || text.length > 4000) {
            return json({ error: "invalid text" }, 400, request, env);
          }
          const msg = {
            chat_id: targetChatId || chatId(env, 1),
            text,
            parse_mode: "Markdown",
          };
          if (buttonText && buttonUrl) {
            msg.reply_markup = {
              inline_keyboard: [[{ text: String(buttonText), url: String(buttonUrl) }]],
            };
          }
          await tgFetch(tgToken(env, 1), "sendMessage", msg).catch(() => {});

          // targetChatId ካልተገለጸ → ለሁለተኛው ቦት/ቻት ቅጂ ላክ
          if (!targetChatId && env.TELEGRAM_BOT_TOKEN_2 && chatId(env, 2)) {
            await tgFetch(tgToken(env, 2), "sendMessage", {
              ...msg,
              chat_id: chatId(env, 2),
            }).catch(() => {});
          }
          return json({ ok: true }, 200, request, env);
        }

        case "sendTelegramLocation": {
          const { lat, lng, targetChatId } = body;
          if (typeof lat !== "number" || typeof lng !== "number") {
            return json({ error: "lat/lng required" }, 400, request, env);
          }
          await tgFetch(tgToken(env, 1), "sendLocation", {
            chat_id: targetChatId || chatId(env, 1),
            latitude: lat,
            longitude: lng,
          }).catch(() => {});
          return json({ ok: true }, 200, request, env);
        }

        case "sendTelegramPhoto": {
          const { dataUrl, caption, targetChatId } = body;
          const blob = dataUrlToBlob(dataUrl);
          if (!blob) return json({ error: "invalid dataUrl" }, 400, request, env);

          const fd = new FormData();
          fd.append("chat_id", String(targetChatId || chatId(env, 1)));
          fd.append("caption", String(caption || "").slice(0, 1024));
          fd.append("photo", blob, "photo.jpg");

          await fetch(`https://api.telegram.org/bot${tgToken(env, 1)}/sendPhoto`, {
            method: "POST",
            body: fd,
          }).catch(() => {});
          return json({ ok: true }, 200, request, env);
        }

        case "sendTelegramMediaGroup": {
          const { images, captions, targetChatId } = body;
          if (!Array.isArray(images) || images.length === 0 || images.length > 10) {
            return json({ error: "1-10 images required" }, 400, request, env);
          }

          const blobs = images.map(dataUrlToBlob);
          if (blobs.some((b) => !b)) {
            return json({ error: "invalid image dataUrl" }, 400, request, env);
          }

          const fd = new FormData();
          fd.append("chat_id", String(targetChatId || chatId(env, 1)));
          const media = blobs.map((blob, i) => {
            const field = `photo${i}`;
            fd.append(field, blob, `${field}.jpg`);
            return {
              type: "photo",
              media: `attach://${field}`,
              caption: String((captions && captions[i]) || "").slice(0, 1024),
            };
          });
          fd.append("media", JSON.stringify(media));

          await fetch(`https://api.telegram.org/bot${tgToken(env, 1)}/sendMediaGroup`, {
            method: "POST",
            body: fd,
          }).catch(() => {});
          return json({ ok: true }, 200, request, env);
        }

        case "telegramConnectPoll": {
          const { technicianId, expectedText, expectedTextWithMention, clearWebhookFirst } = body;
          if (!technicianId) return json({ error: "technicianId required" }, 400, request, env);

          const token = tgToken(env, 1);

          if (clearWebhookFirst) {
            await fetch(
              `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`
            ).catch(() => {});
            return json({ status: "webhook_cleared" }, 200, request, env);
          }

          try {
            const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`);
            const data = await res.json();

            if (data && data.ok && Array.isArray(data.result)) {
              const match = data.result
                .filter((u) => u.message && u.message.text)
                .reverse()
                .find((u) => {
                  const t = u.message.text.trim();
                  return t === expectedText || t === expectedTextWithMention;
                });

              if (match) {
                const foundChatId = String(match.message.chat.id);
                await tgFetch(token, "sendMessage", {
                  chat_id: foundChatId,
                  text:
                    "🎉 ተገናኝቷል!\n\nየቴሌግራም መለያዎ በተሳካ ሁኔታ ተገናኝቷል። " +
                    "ከአሁን ጀምሮ ሥራ ሲመደብልዎት ወዲያውኑ እዚህ ማሳወቂያ ይደርስዎታል።",
                }).catch(() => {});
                return json({ status: "connected", chatId: foundChatId }, 200, request, env);
              }
              return json({ status: "pending" }, 200, request, env);
            }

            if (data && data.error_code === 409) {
              await fetch(
                `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`
              ).catch(() => {});
              return json({ status: "conflict" }, 200, request, env);
            }

            return json({ status: "pending" }, 200, request, env);
          } catch (e) {
            return json({ status: "error" }, 200, request, env);
          }
        }

        /* ---------------- Admin / Finance ---------------- */

        case "verifyAdminMasterPassword": {
          if (!(await throttle(env, "admin:" + ip, 5, 60))) {
            return json({ error: "too many attempts" }, 429, request, env);
          }
          const { password } = body;
          if (typeof password !== "string" || !password) {
            return json({ ok: false }, 200, request, env);
          }
          if (!env.HALAL_KV) {
            return json({ ok: false, error: "kv-not-bound" }, 500, request, env);
          }

          let stored = await env.HALAL_KV.get("admin_password_hash");
          if (!stored) {
            if (!env.ADMIN_MASTER_PASSWORD) {
              return json({ ok: false, error: "not-configured" }, 500, request, env);
            }
            stored = await hashPassword(env.ADMIN_MASTER_PASSWORD);
            await env.HALAL_KV.put("admin_password_hash", stored);
          }
          return json({ ok: await verifyPasswordHash(password, stored) }, 200, request, env);
        }

        case "changeAdminMasterPassword": {
          if (!(await throttle(env, "adminchange:" + ip, 5, 60))) {
            return json({ error: "too many attempts" }, 429, request, env);
          }
          const { oldPassword, newPassword } = body;
          if (
            typeof oldPassword !== "string" ||
            typeof newPassword !== "string" ||
            newPassword.length < 6
          ) {
            return json({ error: "invalid" }, 400, request, env);
          }
          if (!env.HALAL_KV) {
            return json({ ok: false, error: "kv-not-bound" }, 500, request, env);
          }

          let stored = await env.HALAL_KV.get("admin_password_hash");
          if (!stored) {
            if (!env.ADMIN_MASTER_PASSWORD) {
              return json({ ok: false, error: "not-configured" }, 500, request, env);
            }
            stored = await hashPassword(env.ADMIN_MASTER_PASSWORD);
          }

          if (!(await verifyPasswordHash(oldPassword, stored))) {
            return json({ ok: false, error: "wrong-old-password" }, 200, request, env);
          }

          await env.HALAL_KV.put("admin_password_hash", await hashPassword(newPassword));
          return json({ ok: true }, 200, request, env);
        }

        case "verifyFinancePassword": {
          if (!(await throttle(env, "finance:" + ip, 5, 60))) {
            return json({ error: "too many attempts" }, 429, request, env);
          }
          const { password } = body;
          const expected = env.FINANCE_PASSWORD;
          const ok =
            typeof password === "string" &&
            password.length > 0 &&
            typeof expected === "string" &&
            expected.length > 0 &&
            constantTimeEqual(password, expected);
          return json({ ok }, 200, request, env);
        }

        default:
          return json({ error: "not found", path }, 404, request, env);
      }
    } catch (e) {
      return json({ error: "server error: " + (e && e.message) }, 500, request, env);
    }
  },
};

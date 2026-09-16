# Halal Electronics — የተዋሃደ Cloudflare Worker

SMS (AfroMessage)፣ ቴሌግራም፣ እና የአድሚን/ፋይናንስ ይለፍ ቃል ማረጋገጫ — **ሦስቱም በአንድ Worker** ውስጥ።

---

## 🚨 ከሁሉ በፊት — የቴሌግራም ቦት ቶክኖችን ሻር

ቀድሞ የነበሩት ሁለት ቶክኖች በኮዱ ውስጥ በግልጽ ተጽፈው ስለነበር **ተጋልጠዋል**።

1. ቴሌግራም ላይ `@BotFather` ክፈት
2. `/revoke` → ሁለቱንም ቦቶች ምረጥ → አዲስ ቶክን ተቀበል
3. አዲሶቹን ቶክኖች ከታች እንደሚታየው እንደ **secret** አስገባ

አዲሱ ኮድ ቶክን በኮድ ውስጥ ፈጽሞ አያስቀምጥም — ከ secret ውጭ አይሠራም።

---

## 1. ዝግጅት

```bash
cd cloudflare-worker
npm install
npx wrangler login
```

## 2. KV namespace ፍጠር

```bash
npx wrangler kv namespace create HALAL_KV
```

የሚያትመውን `id` ወስደህ በ `wrangler.jsonc` ውስጥ ያለውን
`PUT_YOUR_KV_NAMESPACE_ID_HERE` ተካው።

> ነባር `HALAL_KV` ካለህ አዲስ አትፍጠር — ነባሩን id ተጠቀም።
> አለበለዚያ የተቀመጠው የአድሚን ይለፍ ቃል hash ይጠፋል።

## 3. Secrets አስገባ

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN_1
npx wrangler secret put TELEGRAM_BOT_TOKEN_2
npx wrangler secret put AFROMESSAGE_TOKEN
npx wrangler secret put AFROMESSAGE_IDENTIFIER_ID
npx wrangler secret put ADMIN_MASTER_PASSWORD
npx wrangler secret put FINANCE_PASSWORD
```

## 4. አሰማራ

```bash
npx wrangler deploy
```

## 5. አረጋግጥ

```bash
curl https://halalelectronics.ashenafi6275.workers.dev/health
```

ሁሉም `config` ዕሴቶች `true` መሆን አለባቸው። `false` የሆነ ካለ ያ secret አልገባም።

ከዚያ SMS ሞክር፦

```bash
curl -X POST https://halalelectronics.ashenafi6275.workers.dev/sendSms \
  -H "Content-Type: application/json" \
  -d '{"phone":"+2519XXXXXXXX","message":"test"}'
```

## 6. አሮጌዎቹን አጥፋ

ሁሉም ከሠራ በኋላ ብቻ — Cloudflare Dashboard → Compute → Workers & Pages፦

- `halal-electronics-api` → Delete
- `halal-sms-worker` → Delete

---

## Endpoints

ሁሉም **POST** ናቸው፤ body በ JSON።

| Path | Body | ማብራሪያ |
|---|---|---|
| `/sendSms` | `{ phone \| to, message }` | AfroMessage SMS |
| `/sendTelegramMessage` | `{ text, targetChatId?, buttonText?, buttonUrl? }` | ጽሑፍ |
| `/sendTelegramLocation` | `{ lat, lng, targetChatId? }` | ሥፍራ |
| `/sendTelegramPhoto` | `{ dataUrl, caption?, targetChatId? }` | አንድ ፎቶ |
| `/sendTelegramMediaGroup` | `{ images[], captions?, targetChatId? }` | 1–10 ፎቶ |
| `/telegramConnectPoll` | `{ technicianId, expectedText, expectedTextWithMention, clearWebhookFirst? }` | መለያ ማገናኛ |
| `/verifyAdminMasterPassword` | `{ password }` | አድሚን |
| `/changeAdminMasterPassword` | `{ oldPassword, newPassword }` | አድሚን |
| `/verifyFinancePassword` | `{ password }` | ፋይናንስ |

`GET /health` → የውቅር ሁኔታ (ምስጢር አያሳይም)።

---

## ከድሮው ኮድ የተስተካከሉ

| ጉዳይ | ቀድሞ | አሁን |
|---|---|---|
| ቦት ቶክኖች | በኮድ ውስጥ በግልጽ | secrets ብቻ |
| Chat ID | በኮድ ውስጥ ቋሚ | `vars` |
| Rate limit | መስኮቱ እየተራዘመ ይሄድ ነበር | ቋሚ መስኮት |
| `sendTelegramMediaGroup` | ብልሹ ምስል ላይ ይሰበራል | 400 ይመልሳል |
| Finance password | ቀጥታ `===` | constant-time |
| CORS | ሁልጊዜ `*` | `ALLOWED_ORIGINS` allowlist |
| GET | 405 ብቻ | `/health` ተጨምሯል |
| ፋይሉ | bundled (`__name(...)`) | ንጹህ source |

---

## ⚠️ የ `telegramConnectPoll` ማሳሰቢያ

ይህ endpoint `getUpdates` ይጠቀማል። በተመሳሳይ ቦት ላይ webhook ከተመዘገበ ወይም
ሌላ ቦታ polling እየሄደ ከሆነ ቴሌግራም **409 Conflict** ይመልሳል።
አንድ ቦት በአንድ ጊዜ በአንድ ቦታ ብቻ ይሠራ።

## ⚠️ የ Route ግጭት

በ Cloudflare **አንድ route ለአንድ Worker ብቻ** ነው። ነባር route ካለ
`A route with this pattern already exists` የሚል ስህተት ይመጣል።
ስለዚህ አዲሱን ከመጣል በፊት ከአሮጌው Worker ላይ route መንቀል አለብህ።

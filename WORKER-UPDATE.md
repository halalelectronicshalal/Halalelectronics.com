# Cloudflare Worker ማስተካከያ (የቴሌግራም ሁለት ቦት)

የ Worker ኮድ በዚህ ዚፕ ውስጥ ስላልነበረ ራሱ አልተቀየረም። ገጾቹ አሁን ለ `sendTelegramMessage`,
`sendTelegramPhoto`, `sendTelegramMediaGroup`, `sendTelegramLocation` ጥሪዎች `bot` መስክ ይልካሉ፦

- `bot: "admin"` → አድሚን ቦት → ወደ አድሚን chat ID(ዎች) (targetChatId አይኖርም)
- `bot: "tech"`  → ቴክኒሻን ቦት (HalAlElectronics_bot) → ወደ `targetChatId` (የቴክኒሻኑ chatId)
- `bot` ከሌለ → የቀድሞው ባህሪ

```js
// በ Worker ውስጥ ቶከን/ተቀባይ የሚመርጥበት ቦታ ላይ
function pickBot(body, env) {
  if (body.bot === 'tech') {
    return { token: env.TELEGRAM_BOT_TOKEN_1, chatIds: body.targetChatId ? [body.targetChatId] : [] };
  }
  if (body.bot === 'admin') {
    return { token: env.TELEGRAM_BOT_TOKEN_2, chatIds: [env.ADMIN_CHAT_ID_2] }; // የአድሚን ቦትዎ ቶከን/chat ID
  }
  /* ...የቀድሞው ኮድ (ሁለቱም ቦቶች) */
}
```
`TOKEN_1/TOKEN_2` እና chat ID ስሞች በእርስዎ Worker ውስጥ ካሉት ጋር ያስተካክሉ።

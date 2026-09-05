import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers
} from "@whiskeysockets/baileys";

import { Boom } from "@hapi/boom";
import pino from "pino";
import express from "express";
import fs from "fs";
import path from "path";

/*
====================================================
                 SPOPO BOT
          Railway + Pairing Code
====================================================
*/

const PREFIX = ".";
const PORT = process.env.PORT || 3000;

/*
 * Railway Volume:
 * Mount Path = /app
 *
 * لذلك Session غادي تكون:
 * /app/auth_info_baileys
 */
const SESSION_DIR =
  process.env.SESSION_DIR || "/app/auth_info_baileys";

/*
 * رقم WhatsApp ديال البوت
 *
 * حط الرقم ديالك هنا بلا +
 * مثال المغرب:
 * 2126XXXXXXXX
 */
const BOT_NUMBER =
  process.env.BOT_NUMBER || "212644140800";

/*
====================================================
                 EXPRESS SERVER
====================================================
*/

const app = express();

app.get("/", (req, res) => {
  res.json({
    bot: "SPOPO BOT",
    status: "online",
    whatsapp: "connecting",
    time: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    bot: "SPOPO BOT",
    uptime: process.uptime()
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 SPOPO BOT Web Server: ${PORT}`);
});

/*
====================================================
              CREATE SESSION DIRECTORY
====================================================
*/

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, {
    recursive: true
  });
}

/*
====================================================
                  BOT STATUS
====================================================
*/

let sock = null;
let reconnecting = false;
let pairingShown = false;

/*
====================================================
                 CONNECT WHATSAPP
====================================================
*/

async function startBot() {
  if (reconnecting) {
    return;
  }

  reconnecting = true;

  try {
    console.log("");
    console.log("╔════════════════════════════════════╗");
    console.log("║          🤖 SPOPO BOT              ║");
    console.log("║       WhatsApp Connection          ║");
    console.log("╚════════════════════════════════════╝");
    console.log("");

    console.log("📁 Session:");
    console.log(SESSION_DIR);

    /*
     * تحميل Session
     */
    const {
      state,
      saveCreds
    } = await useMultiFileAuthState(SESSION_DIR);

    /*
     * إنشاء Socket
     */
    sock = makeWASocket({
      auth: state,

      logger: pino({
        level: "silent"
      }),

      browser: Browsers.ubuntu("Chrome"),

      printQRInTerminal: false,

      connectTimeoutMs: 60000,

      defaultQueryTimeoutMs: 60000,

      keepAliveIntervalMs: 25000,

      markOnlineOnConnect: false
    });

    /*
     * حفظ Credentials
     */
    sock.ev.on(
      "creds.update",
      saveCreds
    );

    /*
====================================================
              CONNECTION UPDATE
====================================================
    */

    sock.ev.on(
      "connection.update",
      async (update) => {

        const {
          connection,
          lastDisconnect
        } = update;

        /*
        ---------------------------------------------
                    CONNECTING
        ---------------------------------------------
        */

        if (connection === "connecting") {
          console.log(
            "⏳ جاري الاتصال بـ WhatsApp..."
          );
        }

        /*
        ---------------------------------------------
                    CONNECTED
        ---------------------------------------------
        */

        if (connection === "open") {

          reconnecting = false;
          pairingShown = false;

          console.log("");
          console.log("╔════════════════════════════════════╗");
          console.log("║       ✅ WHATSAPP CONNECTED        ║");
          console.log("║          🤖 SPOPO BOT             ║");
          console.log("╚════════════════════════════════════╝");
          console.log("");

          try {
            await sock.sendMessage(
              `${BOT_NUMBER}@s.whatsapp.net`,
              {
                text:
                  "🤖 *SPOPO BOT*\n\n" +
                  "✅ تم الاتصال بنجاح بـ WhatsApp\n" +
                  "🚀 البوت خدام دابا."
              }
            );
          } catch (e) {
            console.log(
              "ℹ️ ما قدرناش نرسل رسالة البداية."
            );
          }
        }

        /*
        ---------------------------------------------
                    CONNECTION CLOSED
        ---------------------------------------------
        */

        if (connection === "close") {

          reconnecting = false;

          const statusCode =
            new Boom(lastDisconnect?.error)
              ?.output?.statusCode;

          console.log("");
          console.log(
            "❌ WhatsApp Connection Closed"
          );

          console.log(
            "STATUS:",
            statusCode
          );

          /*
          ============================================
                    401 = LOGGED OUT
          ============================================
          */

          if (
            statusCode ===
            DisconnectReason.loggedOut
          ) {

            console.log("");
            console.log(
              "🚪 WhatsApp خرج الحساب من الجهاز."
            );

            console.log(
              "⚠️ Session الحالية ما بقاتش صالحة."
            );

            console.log(
              "🔗 خاصك Pairing Code جديد."
            );

            console.log("");

            /*
             * مهم:
             * ما نحذفوش Session هنا
             * وما نديروش reconnect loop.
             */

            process.exit(0);
          }

          /*
          ============================================
                   RESTART REQUIRED
          ============================================
          */

          if (
            statusCode ===
            DisconnectReason.restartRequired
          ) {

            console.log(
              "🔄 WhatsApp طلب Restart..."
            );

            setTimeout(() => {
              startBot();
            }, 3000);

            return;
          }

          /*
          ============================================
                   TEMPORARY CONNECTION ERROR
          ============================================
          */

          console.log(
            "🔄 إعادة الاتصال بعد 5 ثواني..."
          );

          setTimeout(() => {
            startBot();
          }, 5000);
        }
      }
    );

    /*
====================================================
                  PAIRING CODE
====================================================
    */

    /*
     * إذا Session مازال ما تسجلتش
     * نطلب Pairing Code
     */

    if (!state.creds.registered) {

      /*
       * نخلي socket يعطي الوقت باش يتصل
       */
      await new Promise(
        resolve => setTimeout(resolve, 5000)
      );

      /*
       * التأكد أن الرقم صحيح
       */

      const phoneNumber =
        BOT_NUMBER
          .replace(/\D/g, "");

      if (!phoneNumber) {
        throw new Error(
          "BOT_NUMBER غير صحيح."
        );
      }

      try {

        const code =
          await sock.requestPairingCode(
            phoneNumber
          );

        if (!pairingShown) {

          pairingShown = true;

          console.log("");
          console.log(
            "╔════════════════════════════════════╗"
          );

          console.log(
            "║       🔐 SPOPO PAIRING CODE       ║"
          );

          console.log(
            "╠════════════════════════════════════╣"
          );

          console.log(
            `║            ${code}              ║`
          );

          console.log(
            "╚════════════════════════════════════╝"
          );

          console.log("");

          console.log(
            "📱 WhatsApp:"
          );

          console.log(
            "Settings → Linked Devices"
          );

          console.log(
            "→ Link a Device"
          );

          console.log(
            "→ Link with phone number instead"
          );

          console.log(
            `→ دخل الكود: ${code}`
          );

          console.log("");
        }

      } catch (error) {

        console.log("");
        console.log(
          "❌ فشل إنشاء Pairing Code"
        );

        console.log(
          error?.message || error
        );

        console.log("");

        /*
         * ما نحذفوش Session
         */

        setTimeout(() => {
          startBot();
        }, 10000);
      }
    }

  } catch (error) {

    reconnecting = false;

    console.log("");
    console.log(
      "❌ خطأ في تشغيل SPOPO BOT"
    );

    console.log(
      error?.message || error
    );

    console.log("");

    setTimeout(() => {
      startBot();
    }, 10000);
  }
}

/*
====================================================
                    COMMANDS
====================================================
*/

async function handleCommand(
  message,
  jid,
  sender
) {

  const text =
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    "";

  if (!text.startsWith(PREFIX)) {
    return;
  }

  const args =
    text.trim().split(/\s+/);

  const command =
    args[0]
      .slice(PREFIX.length)
      .toLowerCase();

  /*
  ================================================
                    MENU
  ================================================
  */

  if (command === "menu") {

    const menu =
`╭━━━〔 🤖 SPOPO BOT 〕━━━╮
┃
┃ 👋 مرحبا بك
┃
┃ 📌 الأوامر:
┃
┃ .menu
┃ .ping
┃ .alive
┃ .info
┃ .owner
┃ .time
┃ .group
┃ .tagall
┃ .rules
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`;

    await sock.sendMessage(
      jid,
      {
        text: menu
      }
    );

    return;
  }

  /*
  ================================================
                    PING
  ================================================
  */

  if (command === "ping") {

    await sock.sendMessage(
      jid,
      {
        text: "🏓 Pong!\n⚡ SPOPO BOT خدام."
      }
    );

    return;
  }

  /*
  ================================================
                    ALIVE
  ================================================
  */

  if (command === "alive") {

    await sock.sendMessage(
      jid,
      {
        text:
          "🤖 *SPOPO BOT*\n\n" +
          "🟢 Online\n" +
          "⚡ Ready\n" +
          "🚀 Railway"
      }
    );

    return;
  }

  /*
  ================================================
                    INFO
  ================================================
  */

  if (command === "info") {

    await sock.sendMessage(
      jid,
      {
        text:
          "🤖 *SPOPO BOT*\n\n" +
          "Version: 1.0.0\n" +
          "Platform: Railway\n" +
          "Auth: Pairing Code\n" +
          "Status: Online"
      }
    );

    return;
  }

  /*
  ================================================
                    OWNER
  ================================================
  */

  if (command === "owner") {

    await sock.sendMessage(
      jid,
      {
        text:
          "👑 Owner: SPOPO\n" +
          "🤖 Bot: SPOPO BOT"
      }
    );

    return;
  }

  /*
  ================================================
                    TIME
  ================================================
  */

  if (command === "time") {

    const now =
      new Date().toLocaleString(
        "fr-MA",
        {
          timeZone:
            "Africa/Casablanca"
        }
      );

    await sock.sendMessage(
      jid,
      {
        text:
          `🕐 الوقت دابا:\n${now}`
      }
    );

    return;
  }

  /*
  ================================================
                    RULES
  ================================================
  */

  if (command === "rules") {

    await sock.sendMessage(
      jid,
      {
        text:
          "📜 *قوانين المجموعة*\n\n" +
          "1️⃣ الاحترام\n" +
          "2️⃣ ممنوع السبام\n" +
          "3️⃣ ممنوع الإزعاج\n" +
          "4️⃣ اتبع قوانين المجموعة"
      }
    );

    return;
  }

  /*
  ================================================
                  UNKNOWN
  ================================================
  */

  await sock.sendMessage(
    jid,
    {
      text:
        `❌ الأمر *${command}* ما كاينش.\n\n` +
        `اكتب ${PREFIX}menu`
    }
  );
}

/*
====================================================
                 MESSAGE HANDLER
====================================================
*/

function setupMessages() {

  sock.ev.on(
    "messages.upsert",
    async ({
      messages,
      type
    }) => {

      if (type !== "notify") {
        return;
      }

      for (const msg of messages) {

        try {

          if (!msg.message) {
            continue;
          }

          if (msg.key.fromMe) {
            continue;
          }

          const jid =
            msg.key.remoteJid;

          if (!jid) {
            continue;
          }

          const message =
            msg.message;

          const sender =
            msg.key.participant ||
            jid;

          await handleCommand(
            message,
            jid,
            sender
          );

        } catch (error) {

          console.log(
            "❌ Message Error:",
            error?.message || error
          );

        }
      }
    }
  );
}

/*
====================================================
                  START BOT
====================================================
*/

(async () => {

  await startBot();

  /*
   * Messages listener خاصو يتربط
   * مع socket الحالي.
   */
  if (sock) {
    setupMessages();
  }

})();

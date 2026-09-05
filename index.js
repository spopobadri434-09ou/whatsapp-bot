import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers
} from "@whiskeysockets/baileys";

import P from "pino";
import { Boom } from "@hapi/boom";

const PHONE_NUMBER = "212644140800";
const PREFIX = ".";

let pairingRequested = false;

async function startBot() {
  console.log("");
  console.log("=================================");
  console.log("       🤖 SPOPO BOT V2");
  console.log("=================================");
  console.log("");

  const { state, saveCreds } =
    await useMultiFileAuthState("./auth_info");

  const sock = makeWASocket({
    auth: state,

    // مهم للـ Pairing Code
    printQRInTerminal: false,

    // إعداد رسمي/قياسي
    browser: Browsers.windows("Chrome"),

    logger: P({ level: "silent" }),

    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,

    markOnlineOnConnect: false
  });

  // حفظ بيانات تسجيل الدخول
  sock.ev.on("creds.update", saveCreds);

  // حالة الاتصال
  sock.ev.on("connection.update", async (update) => {
    const {
      connection,
      lastDisconnect
    } = update;

    if (connection === "connecting") {
      console.log("⏳ جاري الاتصال بـ WhatsApp...");

      // إذا الحساب غير مربوط، نطلب Pairing Code مرة واحدة فقط
      if (!state.creds.registered && !pairingRequested) {
        pairingRequested = true;

        try {
          console.log("");
          console.log("📱 رقم الهاتف:");
          console.log(PHONE_NUMBER);
          console.log("");

          const code = await sock.requestPairingCode(
            PHONE_NUMBER
          );

          console.log("=================================");
          console.log("🔐 SPOPO BOT - PAIRING CODE");
          console.log("=================================");
          console.log("");
          console.log("CODE:", code);
          console.log("");
          console.log(
            "WhatsApp > الإعدادات > الأجهزة المرتبطة > ربط جهاز"
          );
          console.log(
            "ثم اختر: الربط باستخدام رقم الهاتف"
          );
          console.log("");
          console.log("=================================");
        } catch (error) {
          console.log("");
          console.log("❌ فشل إنشاء Pairing Code");
          console.log(error?.message || error);
          console.log("");
          pairingRequested = false;
        }
      }
    }

    if (connection === "open") {
      console.log("");
      console.log("=================================");
      console.log("✅ SPOPO BOT متصل بـ WhatsApp");
      console.log("=================================");
      console.log("");
    }

    if (connection === "close") {
      const statusCode =
        new Boom(lastDisconnect?.error)?.output?.statusCode;

      console.log("");
      console.log("❌ الاتصال تقطع");
      console.log("STATUS:", statusCode);
      console.log("");

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("🚪 تم تسجيل الخروج.");
        console.log("احذف مجلد auth_info ثم أعد التشغيل.");
        return;
      }

      console.log("🔄 إعادة الاتصال...");
      pairingRequested = false;

      setTimeout(() => {
        startBot();
      }, 3000);
    }
  });

  // استقبال الرسائل
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];

      if (!msg?.message) return;
      if (msg.key.fromMe) return;

      const jid = msg.key.remoteJid;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      if (!text) return;

      console.log(
        `📩 رسالة من ${jid}: ${text}`
      );

      // .ping
      if (text.trim().toLowerCase() === ".ping") {
        await sock.sendMessage(jid, {
          text: "🏓 Pong!\n\n🤖 SPOPO BOT خدام ✅"
        });
      }

      // .menu
      else if (text.trim().toLowerCase() === ".menu") {
        await sock.sendMessage(jid, {
          text:
`╭━━━〔 🤖 SPOPO BOT 〕━━━╮

┃ 📌 الأوامر:
┃
┃ .ping
┃ .menu
┃ .bot
┃ .owner

╰━━━━━━━━━━━━━━━━━━━━╯`
        });
      }

      // .bot
      else if (text.trim().toLowerCase() === ".bot") {
        await sock.sendMessage(jid, {
          text:
`🤖 SPOPO BOT

الحالة: Online 🟢
النظام: WhatsApp
الإصدار: V2`
        });
      }

      // .owner
      else if (text.trim().toLowerCase() === ".owner") {
        await sock.sendMessage(jid, {
          text:
`👑 OWNER

SPOPO`
        });
      }

    } catch (error) {
      console.log(
        "❌ Message Error:",
        error?.message || error
      );
    }
  });
}

startBot().catch((error) => {
  console.error("");
  console.error("❌ BOT ERROR");
  console.error(error);
  console.error("");
});

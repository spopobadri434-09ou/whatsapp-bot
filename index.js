import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

import P from "pino";
import { Boom } from "@hapi/boom";
import fs from "fs";

// ╔══════════════════════════════════════╗
// ║          🤖 SPOPO BOT V2            ║
// ╚══════════════════════════════════════╝

const BOT_NUMBER = "212644140800";
const PREFIX = ".";

const AUTH_FOLDER = "./auth_info";

let reconnecting = false;
let pairingRequested = false;

// ──────────────────────────────────────
// تنظيف رقم الهاتف
// ──────────────────────────────────────
function cleanPhoneNumber(number) {
  return String(number).replace(/[^0-9]/g, "");
}

// ──────────────────────────────────────
// حذف Session قديمة
// ──────────────────────────────────────
function deleteAuth() {
  try {
    if (fs.existsSync(AUTH_FOLDER)) {
      fs.rmSync(AUTH_FOLDER, {
        recursive: true,
        force: true
      });

      console.log("🗑️ تم حذف Session القديمة.");
    }
  } catch (error) {
    console.log("⚠️ تعذر حذف Session القديمة.");
  }
}

// ──────────────────────────────────────
// Pairing Code منظم
// ──────────────────────────────────────
function showPairingCode(code) {
  const cleanCode = String(code)
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();

  const formatted =
    cleanCode.length === 8
      ? `${cleanCode.slice(0, 4)}-${cleanCode.slice(4)}`
      : cleanCode;

  console.log("");
  console.log("╔══════════════════════════════════════╗");
  console.log("║          🔐 SPOPO BOT               ║");
  console.log("╠══════════════════════════════════════╣");
  console.log("║                                      ║");
  console.log(`║          ${formatted.padEnd(20)}║`);
  console.log("║                                      ║");
  console.log("╠══════════════════════════════════════╣");
  console.log("║ WhatsApp → الإعدادات                 ║");
  console.log("║ → الأجهزة المرتبطة                   ║");
  console.log("║ → ربط جهاز                           ║");
  console.log("║ → الربط باستخدام رقم الهاتف          ║");
  console.log("╚══════════════════════════════════════╝");
  console.log("");
}

// ──────────────────────────────────────
// تشغيل البوت
// ──────────────────────────────────────
async function startBot() {
  try {
    console.log("");
    console.log("╔══════════════════════════════════════╗");
    console.log("║          🤖 SPOPO BOT V2            ║");
    console.log("╚══════════════════════════════════════╝");
    console.log("");

    const { state, saveCreds } =
      await useMultiFileAuthState(AUTH_FOLDER);

    const { version } =
      await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      auth: state,

      version,

      printQRInTerminal: false,

      browser: Browsers.ubuntu("SPOPO BOT"),

      logger: P({
        level: "silent"
      }),

      markOnlineOnConnect: false,

      connectTimeoutMs: 60000,

      defaultQueryTimeoutMs: 60000,

      syncFullHistory: false
    });

    // حفظ بيانات الحساب
    sock.ev.on(
      "creds.update",
      saveCreds
    );

    // ─────────────────────────────────
    // حالة الاتصال
    // ─────────────────────────────────
    sock.ev.on(
      "connection.update",
      async (update) => {
        const {
          connection,
          lastDisconnect
        } = update;

        // جاري الاتصال
        if (connection === "connecting") {
          console.log(
            "⏳ جاري الاتصال بـ WhatsApp..."
          );
        }

        // ─────────────────────────────
        // Pairing Code
        // ─────────────────────────────
        if (
          connection === "connecting" &&
          !state.creds.registered &&
          !pairingRequested
        ) {
          pairingRequested = true;

          try {
            const phone =
              cleanPhoneNumber(BOT_NUMBER);

            console.log("");
            console.log(
              "📱 رقم الهاتف:",
              phone
            );
            console.log(
              "🔐 جاري إنشاء Pairing Code..."
            );

            // نعطي الاتصال شوية وقت باش يكون جاهز
            await new Promise(
              resolve => setTimeout(resolve, 3000)
            );

            const code =
              await sock.requestPairingCode(
                phone
              );

            showPairingCode(code);

          } catch (error) {

            pairingRequested = false;

            console.log("");
            console.log(
              "╔══════════════════════════════════════╗"
            );
            console.log(
              "║       ❌ فشل Pairing Code            ║"
            );
            console.log(
              "╚══════════════════════════════════════╝"
            );

            console.log(
              "السبب:",
              error?.message || error
            );

            console.log("");
          }
        }

        // ─────────────────────────────
        // متصل
        // ─────────────────────────────
        if (connection === "open") {

          reconnecting = false;
          pairingRequested = true;

          console.log("");
          console.log(
            "╔══════════════════════════════════════╗"
          );
          console.log(
            "║      ✅ SPOPO BOT ONLINE             ║"
          );
          console.log(
            "╠══════════════════════════════════════╣"
          );
          console.log(
            "║      WhatsApp Connected 🟢           ║"
          );
          console.log(
            "╚══════════════════════════════════════╝"
          );
          console.log("");
        }

        // ─────────────────────────────
        // انقطع الاتصال
        // ─────────────────────────────
        if (connection === "close") {

          const statusCode =
            new Boom(
              lastDisconnect?.error
            )?.output?.statusCode;

          console.log("");
          console.log(
            "❌ اتصال WhatsApp انقطع"
          );

          console.log(
            "STATUS:",
            statusCode
          );

          // تسجيل خروج نهائي
          if (
            statusCode ===
            DisconnectReason.loggedOut
          ) {

            console.log(
              "🚪 الحساب خرج من WhatsApp."
            );

            console.log(
              "🗑️ حذف Session..."
            );

            deleteAuth();

            pairingRequested = false;

            console.log(
              "🔄 أعد تشغيل الخدمة للحصول على كود جديد."
            );

            return;
          }

          // Session غير صالحة
          if (statusCode === 401) {

            console.log(
              "⚠️ Session غير صالحة (401)."
            );

            deleteAuth();

            pairingRequested = false;
          }

          // إعادة الاتصال
          if (!reconnecting) {

            reconnecting = true;

            console.log(
              "🔄 إعادة الاتصال خلال 5 ثواني..."
            );

            setTimeout(() => {

              reconnecting = false;

              startBot();

            }, 5000);
          }
        }
      }
    );

    // ─────────────────────────────────
    // استقبال الرسائل
    // ─────────────────────────────────
    sock.ev.on(
      "messages.upsert",
      async ({ messages }) => {

        try {

          for (const msg of messages) {

            if (!msg?.message)
              continue;

            if (msg.key.fromMe)
              continue;

            const jid =
              msg.key.remoteJid;

            if (!jid)
              continue;

            const text =
              msg.message.conversation ||
              msg.message.extendedTextMessage?.text ||
              "";

            if (!text)
              continue;

            const command =
              text.trim().toLowerCase();

            console.log(
              `📩 Message: ${text}`
            );

            // ─────────────────────────
            // .ping
            // ─────────────────────────
            if (
              command === `${PREFIX}ping`
            ) {

              await sock.sendMessage(
                jid,
                {
                  text:
`╭━━━〔 🏓 PONG 〕━━━╮

┃ 🤖 SPOPO BOT
┃ 🟢 Online
┃ ⚡ الخدمة خدامة مزيان

╰━━━━━━━━━━━━━━━━╯`
                }
              );
            }

            // ─────────────────────────
            // .menu
            // ─────────────────────────
            else if (
              command === `${PREFIX}menu`
            ) {

              await sock.sendMessage(
                jid,
                {
                  text:
`╭━━━〔 🤖 SPOPO BOT 〕━━━╮

┃ 📌 الأوامر المتاحة:
┃
┃ 🏓 .ping
┃ 📋 .menu
┃ 🤖 .bot
┃ 👑 .owner
┃ 🧪 .test
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
                }
              );
            }

            // ─────────────────────────
            // .bot
            // ─────────────────────────
            else if (
              command === `${PREFIX}bot`
            ) {

              await sock.sendMessage(
                jid,
                {
                  text:
`╭━━━〔 🤖 BOT INFO 〕━━━╮

┃ الاسم: SPOPO BOT
┃ الإصدار: V2
┃ الحالة: 🟢 Online
┃ النظام: WhatsApp
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
                }
              );
            }

            // ─────────────────────────
            // .owner
            // ─────────────────────────
            else if (
              command === `${PREFIX}owner`
            ) {

              await sock.sendMessage(
                jid,
                {
                  text:
`╭━━━〔 👑 OWNER 〕━━━╮

┃ الاسم: SPOPO
┃ 🤖 SPOPO BOT V2
┃
╰━━━━━━━━━━━━━━━━━━╯`
                }
              );
            }

            // ─────────────────────────
            // .test
            // ─────────────────────────
            else if (
              command === `${PREFIX}test`
            ) {

              await sock.sendMessage(
                jid,
                {
                  text:
`╭━━━〔 🧪 TEST 〕━━━╮

┃ ✅ Message system: OK
┃ ✅ WhatsApp: OK
┃ ✅ Bot: OK
┃
┃ 🤖 SPOPO BOT خدام

╰━━━━━━━━━━━━━━━━━╯`
                }
              );
            }
          }

        } catch (error) {

          console.log(
            "❌ Message Error:",
            error?.message || error
          );

        }
      }
    );

  } catch (error) {

    console.log("");
    console.log(
      "❌ خطأ في تشغيل SPOPO BOT"
    );

    console.log(
      error?.message || error
    );

    console.log("");
  }
}

// تشغيل
startBot();

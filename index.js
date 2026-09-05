import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import express from "express";
const PREFIX = ".";
const PORT = process.env.PORT || 3000;
// 📱 رقم البوت
const BOT_NUMBER = "212644140080";
const BOT_NAME = "SPOPO BOT";
const SESSION_DIR = "/app/auth_info_baileys";
let sock = null;
let connected = false;
let reconnecting = false;
// ===============================
// WEB SERVER - RAILWAY
// ===============================
const app = express();
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>SPOPO BOT</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family:Arial;text-align:center;padding:40px">
        <h1>🤖 SPOPO BOT</h1>
        <h2>🔐 Pairing Code</h2>
        <p>${connected ? "🟢 Connected" : "🟡 Waiting..."}</p>
        <h3>🎁 GFT</h3>
      </body>
    </html>
  `);
});
app.get("/health", (req, res) => {
  res.json({
    bot: BOT_NAME,
    connected: connected,
    pairing: !connected
  });
});
app.listen(PORT, () => {
  console.log(`🌐 Railway server running on port ${PORT}`);
});
// ===============================
// HELPERS
// ===============================
function getText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ""
  );
}
function getSender(message) {
  return (
    message?.key?.participant ||
    message?.key?.remoteJid ||
    ""
  );
}
function isGroup(jid) {
  return jid?.endsWith("@g.us");
}
async function getGroup(jid) {
  try {
    return await sock.groupMetadata(jid);
  } catch {
    return null;
  }
}
async function isAdmin(jid, sender) {
  const group = await getGroup(jid);
  if (!group) return false;
  const user = group.participants.find(
    p =>
      p.id === sender ||
      p.jid === sender ||
      p.lid === sender
  );
  return Boolean(user?.admin);
}
async function isBotAdmin(jid) {
  const group = await getGroup(jid);
  if (!group || !sock?.user?.id) return false;
  const botNumber = sock.user.id.split(":")[0];
  const botJid = `${botNumber}@s.whatsapp.net`;
  const bot = group.participants.find(
    p =>
      p.id === botJid ||
      p.jid === botJid ||
      p.id === sock.user.id
  );
  return Boolean(bot?.admin);
}
async function groupOnly(jid) {
  if (!isGroup(jid)) {
    await sock.sendMessage(jid, {
      text: "❌ هاد الأمر غير للجروبات."
    });
    return false;
  }
  return true;
}
async function adminOnly(jid, sender) {
  if (!(await groupOnly(jid))) return false;
  if (!(await isAdmin(jid, sender))) {
    await sock.sendMessage(jid, {
      text: "❌ خاصك تكون Admin."
    });
    return false;
  }
  if (!(await isBotAdmin(jid))) {
    await sock.sendMessage(jid, {
      text: "❌ خاصني نكون Admin باش ندير هاد الأمر."
    });
    return false;
  }
  return true;
}
function getMentioned(message) {
  return (
    message?.message?.extendedTextMessage
      ?.contextInfo?.mentionedJid?.[0] || null
  );
}
function numberToJid(number) {
  const clean = String(number || "")
    .replace(/[^\d]/g, "");
  if (!clean) return null;
  return `${clean}@s.whatsapp.net`;
}
function casablancaTime() {
  return new Date().toLocaleString("fr-FR", {
    timeZone: "Africa/Casablanca"
  });
}
// ===============================
// MENU
// ===============================
function getMenu() {
  return `
╭━━━〔 🤖 SPOPO BOT 〕━━━╮
┃
┃ 🎁 GFT BOT
┃
┃ ⚡ Prefix: ${PREFIX}
┃
┣━━〔 GENERAL 〕━━
┃
┃ ${PREFIX}menu
┃ ${PREFIX}help
┃ ${PREFIX}ping
┃ ${PREFIX}alive
┃ ${PREFIX}info
┃ ${PREFIX}owner
┃ ${PREFIX}time
┃ ${PREFIX}date
┃ ${PREFIX}about
┃ ${PREFIX}bot
┃
┣━━〔 GROUP 〕━━
┃
┃ ${PREFIX}groupinfo
┃ ${PREFIX}admins
┃ ${PREFIX}tagall
┃ ${PREFIX}hidetag
┃ ${PREFIX}kick
┃ ${PREFIX}add
┃ ${PREFIX}promote
┃ ${PREFIX}demote
┃ ${PREFIX}subject
┃ ${PREFIX}desc
┃ ${PREFIX}link
┃ ${PREFIX}revoke
┃ ${PREFIX}rules
┃ ${PREFIX}welcome
┃
┣━━〔 TOOLS 〕━━
┃
┃ ${PREFIX}id
┃ ${PREFIX}jid
┃ ${PREFIX}calc
┃ ${PREFIX}say
┃
╰━━━━━━━━━━━━━━━━━━━━╯
🎁 GFT — SPOPO BOT
`;
}
// ===============================
// CONNECT WHATSAPP
// ===============================
async function connectWhatsApp() {
  try {
    const { state, saveCreds } =
      await useMultiFileAuthState(SESSION_DIR);
    sock = makeWASocket({
      auth: state,
      logger: pino({
        level: "silent"
      }),
      browser: Browsers.ubuntu("SPOPO BOT"),
      printQRInTerminal: false,
      markOnlineOnConnect: false
    });
    sock.ev.on("creds.update", saveCreds);
    // ===============================
    // PAIRING CODE
    // ===============================
    if (!state.creds.registered) {
      console.log("");
      console.log("🔐 SPOPO BOT");
      console.log("📱 Preparing Pairing Code...");
      console.log("");
      try {
        const code = await sock.requestPairingCode(
          BOT_NUMBER
        );
        console.log("");
        console.log("╔══════════════════════════════╗");
        console.log("║      🔐 PAIRING CODE         ║");
        console.log("╠══════════════════════════════╣");
        console.log(`║      ${code}              ║`);
        console.log("╚══════════════════════════════╝");
        console.log("");
        console.log(
          "WhatsApp → Linked Devices → Link with phone number"
        );
        console.log("");
      } catch (error) {
        console.log(
          "❌ Pairing Code Error:",
          error?.message || error
        );
      }
    }
    // ===============================
    // CONNECTION
    // ===============================
    sock.ev.on("connection.update", async update => {
      const {
        connection,
        lastDisconnect
      } = update;
      if (connection === "open") {
        connected = true;
        reconnecting = false;
        console.log("");
        console.log("╔══════════════════════════════╗");
        console.log("║    🟢 SPOPO BOT ONLINE       ║");
        console.log("║    🎁 GFT                    ║");
        console.log("╚══════════════════════════════╝");
        console.log("");
      }
      if (connection === "close") {
        connected = false;
        const statusCode =
          new Boom(lastDisconnect?.error)
            ?.output?.statusCode;
        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut;
        console.log(
          "🔴 WhatsApp disconnected:",
          statusCode
        );
        if (shouldReconnect && !reconnecting) {
          reconnecting = true;
          console.log("🔄 Reconnecting in 5 seconds...");
          setTimeout(() => {
            reconnecting = false;
            connectWhatsApp();
          }, 5000);
        }
      }
    });
    // ===============================
    // WELCOME + GFT
    // ===============================
    sock.ev.on(
      "group-participants.update",
      async update => {
        try {
          if (update.action !== "add") return;
          const group =
            await sock.groupMetadata(update.id);
          for (const participant of update.participants) {
            const number =
              participant.split("@")[0];
            await sock.sendMessage(update.id, {
              text:
`╭━━━〔 🎉 WELCOME 〕━━━╮
👋 مرحبا @${number}
🤖 مرحبا بك فـ ${BOT_NAME}
🎁 GFT 🎁
📌 كتب ${PREFIX}menu
باش تشوف الأوامر.
👥 Group:
${group.subject}
╰━━━━━━━━━━━━━━━━━━━━╯`,
              mentions: [participant]
            });
          }
        } catch (error) {
          console.log(
            "Welcome Error:",
            error?.message || error
          );
        }
      }
    );
    // ===============================
    // MESSAGES
    // ===============================
    sock.ev.on(
      "messages.upsert",
      async ({ messages }) => {
        try {
          const message = messages?.[0];
          if (!message?.message) return;
          if (message.key?.fromMe) return;
          const jid = message.key?.remoteJid;
          const sender = getSender(message);
          if (!jid) return;
          const text =
            getText(message).trim();
          if (!text.startsWith(PREFIX)) return;
          const commandText =
            text.slice(PREFIX.length).trim();
          const parts =
            commandText.split(/\s+/);
          const command =
            parts.shift()?.toLowerCase();
          const args = parts;
          const argText =
            args.join(" ");
          // =========================
          // MENU
          // =========================
          if (
            command === "menu" ||
            command === "help"
          ) {
            return await sock.sendMessage(jid, {
              text: getMenu()
            });
          }
          // =========================
          // PING
          // =========================
          if (command === "ping") {
            return await sock.sendMessage(jid, {
              text:
                "🏓 PONG!\n\n" +
                "🟢 SPOPO BOT Working\n" +
                "🎁 GFT"
            });
          }
          // =========================
          // ALIVE
          // =========================
          if (command === "alive") {
            return await sock.sendMessage(jid, {
              text:
                `🟢 ${BOT_NAME} ONLINE\n\n` +
                `🎁 GFT\n` +
                `⏰ ${casablancaTime()}`
            });
          }
          // =========================
          // BOT
          // =========================
          if (command === "bot") {
            return await sock.sendMessage(jid, {
              text:
                "🤖 SPOPO BOT\n\n" +
                "🟢 Online\n" +
                "🔐 Pairing Code\n" +
                "🎁 GFT\n" +
                "🚀 Railway"
            });
          }
          // =========================
          // ABOUT / INFO
          // =========================
          if (
            command === "about" ||
            command === "info"
          ) {
            return await sock.sendMessage(jid, {
              text:
                `🤖 ${BOT_NAME}\n\n` +
                `🎁 GFT BOT\n` +
                `⚡ Prefix: ${PREFIX}\n` +
                `🔐 Pairing Code\n` +
                `🚀 Railway Ready`
            });
          }
          // =========================
          // OWNER
          // =========================
          if (command === "owner") {
            return await sock.sendMessage(jid, {
              text:
                "👑 BOT OWNER\n\n" +
                "🤖 SPOPO BOT\n" +
                "🎁 GFT"
            });
          }
          // =========================
          // TIME
          // =========================
          if (command === "time") {
            return await sock.sendMessage(jid, {
              text:
                `⏰ ${casablancaTime()}`
            });
          }
          // =========================
          // DATE
          // =========================
          if (command === "date") {
            const date =
              new Date().toLocaleDateString(
                "fr-FR",
                {
                  timeZone:
                    "Africa/Casablanca"
                }
              );
            return await sock.sendMessage(jid, {
              text: `📅 ${date}`
            });
          }
          // =========================
          // ID / JID
          // =========================
          if (
            command === "id" ||
            command === "jid"
          ) {
            return await sock.sendMessage(jid, {
              text:
                `🆔 JID:\n${jid}`
            });
          }
          // =========================
          // CALCULATOR
          // =========================
          if (command === "calc") {
            if (!argText) {
              return await sock.sendMessage(jid, {
                text:
                  `❌ مثال:\n${PREFIX}calc 10+5*2`
              });
            }
            if (!/^[0-9+\-*/(). %]+$/.test(argText)) {
              return await sock.sendMessage(jid, {
                text:
                  "❌ عملية غير صالحة."
              });
            }
            try {
              const result =
                Function(
                  `"use strict"; return (${argText})`
                )();
              return await sock.sendMessage(jid, {
                text:
                  `🧮 ${argText} = ${result}`
              });
            } catch {
              return await sock.sendMessage(jid, {
                text:
                  "❌ خطأ فالحساب."
              });
            }
          }
          // =========================
          // SAY
          // =========================
          if (command === "say") {
            if (!argText) {
              return await sock.sendMessage(jid, {
                text:
                  `❌ مثال:\n${PREFIX}say Hello`
              });
            }
            return await sock.sendMessage(jid, {
              text: argText
            });
          }
          // =========================
          // GROUP INFO
          // =========================
          if (command === "groupinfo") {
            if (!(await groupOnly(jid))) return;
            const group =
              await getGroup(jid);
            const admins =
              group.participants.filter(
                p => p.admin
              );
            return await sock.sendMessage(jid, {
              text:
`╭━━〔 GROUP INFO 〕━━╮
📌 Name: ${group.subject}
👥 Members: ${group.participants.length}
👮 Admins: ${admins.length}
🆔 ${group.id}
🎁 GFT
╰━━━━━━━━━━━━━━━━╯`
            });
          }
          // =========================
          // ADMINS
          // =========================
          if (command === "admins") {
            if (!(await groupOnly(jid))) return;
            const group =
              await getGroup(jid);
            const admins =
              group.participants.filter(
                p => p.admin
              );
            const mentions =
              admins.map(p => p.id);
            let text =
              "👮 *GROUP ADMINS*\n\n";
            for (const admin of admins) {
              text +=
                `@${admin.id.split("@")[0]}\n`;
            }
            return await sock.sendMessage(jid, {
              text,
              mentions
            });
          }
          // =========================
          // TAG ALL
          // =========================
          if (command === "tagall") {
            if (!(await adminOnly(jid, sender))) return;
            const group =
              await getGroup(jid);
            const mentions =
              group.participants.map(
                p => p.id
              );
            let text =
              "📢 *TAG ALL*\n\n";
            for (const p of group.participants) {
              text +=
                `@${p.id.split("@")[0]} `;
            }
            return await sock.sendMessage(jid, {
              text,
              mentions
            });
          }
          // =========================
          // HIDETAG
          // =========================
          if (command === "hidetag") {
            if (!(await adminOnly(jid, sender))) return;
            const group =
              await getGroup(jid);
            const mentions =
              group.participants.map(
                p => p.id
              );
            return await sock.sendMessage(jid, {
              text:
                argText ||
                "📢 Message from Admin\n🎁 GFT",
              mentions
            });
          }
          // =========================
          // KICK
          // =========================
          if (command === "kick") {
            if (!(await adminOnly(jid, sender))) return;
            let target =
              getMentioned(message);
            if (!target && args[0]) {
              target =
                numberToJid(args[0]);
            }
            if (!target) {
              return await sock.sendMessage(jid, {
                text:
                  `❌ ${PREFIX}kick @user`
              });
            }
            await sock.groupParticipantsUpdate(
              jid,
              [target],
              "remove"
            );
            return await sock.sendMessage(jid, {
              text:
                `✅ تم إخراج @${target.split("@")[0]}`,
              mentions: [target]
            });
          }
          // =========================
          // ADD
          // =========================
          if (command === "add") {
            if (!(await adminOnly(jid, sender))) return;
            if (!args[0]) {
              return await sock.sendMessage(jid, {
                text:
                  `❌ ${PREFIX}add 212XXXXXXXXX`
              });
            }
            const target =
              numberToJid(args[0]);
            await sock.groupParticipantsUpdate(
              jid,
              [target],
              "add"
            );
            return await sock.sendMessage(jid, {
              text:
                `✅ تمت محاولة إضافة @${target.split("@")[0]}`,
              mentions: [target]
            });
          }
          // =========================
          // PROMOTE
          // =========================
          if (command === "promote") {
            if (!(await adminOnly(jid, sender))) return;
            let target =
              getMentioned(message);
            if (!target && args[0]) {
              target =
                numberToJid(args[0]);
            }
            if (!target) {
              return await sock.sendMessage(jid, {
                text:
                  `❌ ${PREFIX}promote @user`
              });
            }
            await sock.groupParticipantsUpdate(
              jid,
              [target],
              "promote"
            );
            return await sock.sendMessage(jid, {
              text:
                `👑 @${target.split("@")[0]} ولى Admin`,
              mentions: [target]
            });
          }
          // =========================
          // DEMOTE
          // =========================
          if (command === "demote") {
            if (!(await adminOnly(jid, sender))) return;
            let target =
              getMentioned(message);
            if (!target && args[0]) {
              target =
                numberToJid(args[0]);
            }
            if (!target) {
              return await sock.sendMessage(jid, {
                text:
                  `❌ ${PREFIX}demote @user`
              });
            }
            await sock.groupParticipantsUpdate(
              jid,
              [target],
              "demote"
            );
            return await sock.sendMessage(jid, {
              text:
                `✅ تحيد Admin من @${target.split("@")[0]}`,
              mentions: [target]
            });
          }
          // =========================
          // SUBJECT
          // =========================
          if (command === "subject") {
            if (!(await adminOnly(jid, sender))) return;
            if (!argText) {
              return await sock.sendMessage(jid, {
                text:
                  `❌ ${PREFIX}subject الاسم الجديد`
              });
            }
            await sock.groupUpdateSubject(
              jid,
              argText
            );
            return await sock.sendMessage(jid, {
              text:
                "✅ تبدل اسم الجروب.\n🎁 GFT"
            });
          }
          // =========================
          // DESCRIPTION
          // =========================
          if (command === "desc") {
            if (!(await adminOnly(jid, sender))) return;
            if (!argText) {
              return await sock.sendMessage(jid, {
                text:
                  `❌ ${PREFIX}desc الوصف الجديد`
              });
            }
            await sock.groupUpdateDescription(
              jid,
              argText
            );
            return await sock.sendMessage(jid, {
              text:
                "✅ تبدل وصف الجروب.\n🎁 GFT"
            });
          }
          // =========================
          // GROUP LINK
          // =========================
          if (command === "link") {
            if (!(await adminOnly(jid, sender))) return;
            const code =
              await sock.groupInviteCode(jid);
            return await sock.sendMessage(jid, {
              text:
                `🔗 Group Link:\n\n` +
                `https://chat.whatsapp.com/${code}`
            });
          }
          // =========================
          // REVOKE
          // =========================
          if (command === "revoke") {
            if (!(await adminOnly(jid, sender))) return;
            await sock.groupRevokeInvite(jid);
            return await sock.sendMessage(jid, {
              text:
                "✅ تبدل رابط الجروب."
            });
          }
          // =========================
          // RULES
          // =========================
          if (command === "rules") {
            return await sock.sendMessage(jid, {
              text:
`📜 *GROUP RULES*
1️⃣ الاحترام
2️⃣ ممنوع السبام
3️⃣ ممنوع المشاكل
4️⃣ احترام Admins
🎁 GFT`
            });
          }
          // =========================
          // WELCOME
          // =========================
          if (command === "welcome") {
            if (!(await groupOnly(jid))) return;
            return await sock.sendMessage(jid, {
              text:
`👋 *WELCOME SYSTEM*
🟢 Status: ON
🎁 GFT
أي عضو جديد يدخل للجروب
غادي توصله رسالة ترحيب.`
            });
          }
          // =========================
          // UNKNOWN
          // =========================
          return await sock.sendMessage(jid, {
            text:
              `❌ الأمر غير موجود.\n\n` +
              `كتب ${PREFIX}menu`
          });
        } catch (error) {
          console.log(
            "❌ Message Error:",
            error?.message || error
          );
        }
      }
    );
  } catch (error) {
    connected = false;
    console.log(
      "❌ Main Error:",
      error?.message || error
    );
    if (!reconnecting) {
      reconnecting = true;
      setTimeout(() => {
        reconnecting = false;
        connectWhatsApp();
      }, 5000);
    }
  }
}
// ===============================
// START
// ===============================
console.log("");
console.log("╔══════════════════════════════╗");
console.log("║        🤖 SPOPO BOT          ║");
console.log("║        🎁 GFT BOT            ║");
console.log("║        🔐 PAIRING CODE       ║");
console.log("╚══════════════════════════════╝");
console.log("");
connectWhatsApp();

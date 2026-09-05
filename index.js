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
const BOT_NAME = "SPOPO BOT";
const BOT_NUMBER = 212644140080
const SESSION_DIR =
  process.env.SESSION_DIR || "/app/auth_info_baileys";
let sock = null;
let connected = false;
let pairingCode = null;
let reconnecting = false;
// ===============================
// EXPRESS / RAILWAY
// ===============================
const app = express();
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>${BOT_NAME}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family:Arial;text-align:center;padding:40px">
        <h1>🤖 ${BOT_NAME}</h1>
        <h2>🔐 Pairing Code System</h2>
        <p>Status: ${connected ? "🟢 Connected" : "🟡 Waiting"}</p>
        <p>GFT 🎁</p>
      </body>
    </html>
  `);
});
app.get("/health", (req, res) => {
  res.json({
    bot: BOT_NAME,
    connected,
    pairing: !connected
  });
});
app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});
// ===============================
// HELPERS
// ===============================
const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));
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
  const metadata = await getGroup(jid);
  if (!metadata) return false;
  const participant = metadata.participants.find(
    p =>
      p.id === sender ||
      p.jid === sender ||
      p.lid === sender
  );
  return !!participant?.admin;
}
async function isBotAdmin(jid) {
  const metadata = await getGroup(jid);
  if (!metadata || !sock?.user?.id) return false;
  const botId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
  const participant = metadata.participants.find(
    p =>
      p.id === botId ||
      p.jid === botId ||
      p.id === sock.user.id
  );
  return !!participant?.admin;
}
async function requireGroup(jid) {
  if (!isGroup(jid)) {
    await sock.sendMessage(jid, {
      text: "❌ هاد الأمر غير للجروبات."
    });
    return false;
  }
  return true;
}
async function requireAdmin(jid, sender) {
  if (!(await requireGroup(jid))) return false;
  if (!(await isAdmin(jid, sender))) {
    await sock.sendMessage(jid, {
      text: "❌ خاصك تكون Admin باش تستعمل هاد الأمر."
    });
    return false;
  }
  if (!(await isBotAdmin(jid))) {
    await sock.sendMessage(jid, {
      text: "❌ خاصني حتى أنا نكون Admin."
    });
    return false;
  }
  return true;
}
function mentionNumber(number) {
  number = number.replace(/[^\d]/g, "");
  if (!number) return null;
  return `${number}@s.whatsapp.net`;
}
function formatTime() {
  return new Date().toLocaleString("fr-FR", {
    timeZone: "Africa/Casablanca"
  });
}
// ===============================
// MENU
// ===============================
function menu() {
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
┃ ${PREFIX}bot
┃ ${PREFIX}about
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
┃
┣━━〔 SETTINGS 〕━━
┃
┃ ${PREFIX}welcome
┃ ${PREFIX}rules
┃ ${PREFIX}id
┃ ${PREFIX}jid
┃
╰━━━━━━━━━━━━━━━━━━━━╯
🎁 GFT — SPOPO BOT
`;
}
// ===============================
// CONNECTION
// ===============================
async function connectWhatsApp() {
  try {
    if (!BOT_NUMBER) {
      console.log("");
      console.log("❌ BOT_NUMBER ما متحطاش.");
      console.log("Railway → Variables → BOT_NUMBER");
      console.log("");
      return;
    }
    const { state, saveCreds } =
      await useMultiFileAuthState(SESSION_DIR);
    sock = makeWASocket({
      auth: state,
      logger: pino({
        level: "silent"
      }),
      browser: Browsers.ubuntu(BOT_NAME),
      printQRInTerminal: false,
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect: false
    });
    sock.ev.on("creds.update", saveCreds);
    // ===============================
    // PAIRING CODE
    // ===============================
    if (!state.creds.registered) {
      console.log("");
      console.log("🔐 Preparing Pairing Code...");
      console.log("");
      await sleep(3000);
      try {
        const cleanNumber =
          BOT_NUMBER.replace(/[^\d]/g, "");
        pairingCode =
          await sock.requestPairingCode(cleanNumber);
        console.log("");
        console.log("╔════════════════════════════╗");
        console.log("║     🔐 SPOPO PAIRING       ║");
        console.log("╠════════════════════════════╣");
        console.log(`║ CODE: ${pairingCode}`);
        console.log("╚════════════════════════════╝");
        console.log("");
        console.log(
          "📱 WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number"
        );
        console.log("");
      } catch (error) {
        console.log("❌ Pairing Code Error:", error.message);
      }
    }
    // ===============================
    // CONNECTION UPDATE
    // ===============================
    sock.ev.on("connection.update", async update => {
      const {
        connection,
        lastDisconnect
      } = update;
      if (connection === "open") {
        connected = true;
        reconnecting = false;
        pairingCode = null;
        console.log("");
        console.log("╔════════════════════════════╗");
        console.log("║   🟢 SPOPO BOT ONLINE      ║");
        console.log("║   🎁 GFT                   ║");
        console.log("╚════════════════════════════╝");
        console.log("");
      }
      if (connection === "close") {
        connected = false;
        const statusCode =
          new Boom(lastDisconnect?.error)?.output
            ?.statusCode;
        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut;
        console.log(
          "🔴 Connection closed:",
          statusCode
        );
        if (shouldReconnect && !reconnecting) {
          reconnecting = true;
          console.log("🔄 Reconnecting...");
          setTimeout(() => {
            connectWhatsApp();
          }, 5000);
        } else {
          console.log(
            "❌ Session logged out. Delete auth folder and pair again."
          );
        }
      }
    });
    // ===============================
    // AUTO WELCOME + GFT
    // ===============================
    sock.ev.on(
      "group-participants.update",
      async update => {
        try {
          if (update.action !== "add") return;
          const metadata =
            await sock.groupMetadata(update.id);
          for (const participant of update.participants) {
            const number =
              participant.split("@")[0];
            const welcomeText = `
╭━━━〔 🎉 WELCOME 〕━━━╮
👋 مرحبا @${number}
🤖 مرحبا بك مع ${BOT_NAME}
🎁 GFT 🎁
📌 كتب ${PREFIX}menu باش تشوف الأوامر.
📜 ${metadata.subject}
╰━━━━━━━━━━━━━━━━━━━━╯
`;
            await sock.sendMessage(update.id, {
              text: welcomeText,
              mentions: [participant]
            });
          }
        } catch (error) {
          console.log(
            "Welcome Error:",
            error.message
          );
        }
      }
    );
    // ===============================
    // MESSAGES
    // ===============================
    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const message = messages?.[0];
        if (!message?.message) return;
        if (message.key?.fromMe) return;
        const jid = message.key.remoteJid;
        const sender = getSender(message);
        if (!jid) return;
        const text = getText(message).trim();
        if (!text.startsWith(PREFIX)) return;
        const body = text.slice(PREFIX.length).trim();
        if (!body) return;
        const args = body.split(/\s+/);
        const command = args.shift().toLowerCase();
        const argText = args.join(" ");
        // ===============================
        // GENERAL
        // ===============================
        if (command === "menu" || command === "help") {
          return await sock.sendMessage(jid, {
            text: menu()
          });
        }
        if (command === "ping") {
          return await sock.sendMessage(jid, {
            text: "🏓 Pong!\n⚡ SPOPO BOT is working."
          });
        }
        if (command === "alive") {
          return await sock.sendMessage(jid, {
            text:
              `🟢 ${BOT_NAME} Online\n\n` +
              `🎁 GFT\n` +
              `⏰ ${formatTime()}`
          });
        }
        if (command === "bot") {
          return await sock.sendMessage(jid, {
            text:
              `🤖 ${BOT_NAME}\n\n` +
              `🎁 GFT BOT\n` +
              `⚡ Prefix: ${PREFIX}\n` +
              `🟢 Status: Online`
          });
        }
        if (command === "about" || command === "info") {
          return await sock.sendMessage(jid, {
            text:
              `🤖 ${BOT_NAME}\n\n` +
              `🎁 GFT\n` +
              `⚡ WhatsApp Bot\n` +
              `🚀 Railway Ready\n` +
              `🔐 Pairing Code`
          });
        }
        if (command === "owner") {
          return await sock.sendMessage(jid, {
            text:
              "👑 Owner\n\n" +
              "🤖 SPOPO BOT\n" +
              "🎁 GFT"
          });
        }
        if (command === "time") {
          return await sock.sendMessage(jid, {
            text: `⏰ ${formatTime()}`
          });
        }
        if (command === "date") {
          return await sock.sendMessage(jid, {
            text: `📅 ${new Date().toLocaleDateString("fr-FR", {
              timeZone: "Africa/Casablanca"
            })}`
          });
        }
        // ===============================
        // ID
        // ===============================
        if (command === "id" || command === "jid") {
          return await sock.sendMessage(jid, {
            text: `🆔 JID:\n${jid}`
          });
        }
        // ===============================
        // GROUP INFO
        // ===============================
        if (command === "groupinfo") {
          if (!(await requireGroup(jid))) return;
          const metadata =
            await getGroup(jid);
          const admins =
            metadata.participants.filter(
              p => p.admin
            ).length;
          return await sock.sendMessage(jid, {
            text:
              `╭━━〔 GROUP INFO 〕━━╮\n\n` +
              `📌 Name: ${metadata.subject}\n` +
              `👥 Members: ${metadata.participants.length}\n` +
              `👮 Admins: ${admins}\n` +
              `🆔 ${metadata.id}\n\n` +
              `🎁 GFT\n` +
              `╰━━━━━━━━━━━━━━╯`
          });
        }
        // ===============================
        // ADMINS
        // ===============================
        if (command === "admins") {
          if (!(await requireGroup(jid))) return;
          const metadata =
            await getGroup(jid);
          const admins =
            metadata.participants.filter(
              p => p.admin
            );
          const mentions =
            admins.map(a => a.id);
          let msg = "👮 *GROUP ADMINS*\n\n";
          admins.forEach((admin, index) => {
            msg += `${index + 1}. @${admin.id.split("@")[0]}\n`;
          });
          return await sock.sendMessage(jid, {
            text: msg,
            mentions
          });
        }
        // ===============================
        // TAG ALL
        // ===============================
        if (command === "tagall") {
          if (!(await requireAdmin(jid, sender))) return;
          const metadata =
            await getGroup(jid);
          const mentions =
            metadata.participants.map(
              p => p.id
            );
          let msg =
            `📢 *TAG ALL*\n\n`;
          metadata.participants.forEach(p => {
            msg += `@${p.id.split("@")[0]} `;
          });
          return await sock.sendMessage(jid, {
            text: msg,
            mentions
          });
        }
        // ===============================
        // HIDETAG
        // ===============================
        if (command === "hidetag") {
          if (!(await requireAdmin(jid, sender))) return;
          const metadata =
            await getGroup(jid);
          const mentions =
            metadata.participants.map(
              p => p.id
            );
          return await sock.sendMessage(jid, {
            text:
              argText ||
              "📢 Message from Admin\n🎁 GFT",
            mentions
          });
        }
        // ===============================
        // KICK
        // ===============================
        if (command === "kick") {
          if (!(await requireAdmin(jid, sender))) return;
          let target = null;
          if (
            message.message?.extendedTextMessage
              ?.contextInfo?.mentionedJid?.length
          ) {
            target =
              message.message.extendedTextMessage
                .contextInfo.mentionedJid[0];
          }
          if (!target && args[0]) {
            target = mentionNumber(args[0]);
          }
          if (!target) {
            return await sock.sendMessage(jid, {
              text:
                `❌ استعمل:\n${PREFIX}kick @user`
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
        // ===============================
        // ADD
        // ===============================
        if (command === "add") {
          if (!(await requireAdmin(jid, sender))) return;
          if (!args[0]) {
            return await sock.sendMessage(jid, {
              text:
                `❌ استعمل:\n${PREFIX}add 212XXXXXXXXX`
            });
          }
          const target =
            mentionNumber(args[0]);
          if (!target) return;
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
        // ===============================
        // PROMOTE
        // ===============================
        if (command === "promote") {
          if (!(await requireAdmin(jid, sender))) return;
          let target =
            message.message?.extendedTextMessage
              ?.contextInfo?.mentionedJid?.[0];
          if (!target && args[0]) {
            target = mentionNumber(args[0]);
          }
          if (!target) {
            return await sock.sendMessage(jid, {
              text:
                `❌ استعمل:\n${PREFIX}promote @user`
            });
          }
          await sock.groupParticipantsUpdate(
            jid,
            [target],
            "promote"
          );
          return await sock.sendMessage(jid, {
            text:
              `👑 تم إعطاء Admin لـ @${target.split("@")[0]}`,
            mentions: [target]
          });
        }
        // ===============================
        // DEMOTE
        // ===============================
        if (command === "demote") {
          if (!(await requireAdmin(jid, sender))) return;
          let target =
            message.message?.extendedTextMessage
              ?.contextInfo?.mentionedJid?.[0];
          if (!target && args[0]) {
            target = mentionNumber(args[0]);
          }
          if (!target) {
            return await sock.sendMessage(jid, {
              text:
                `❌ استعمل:\n${PREFIX}demote @user`
            });
          }
          await sock.groupParticipantsUpdate(
            jid,
            [target],
            "demote"
          );
          return await sock.sendMessage(jid, {
            text:
              `✅ تم نزع Admin من @${target.split("@")[0]}`,
            mentions: [target]
          });
        }
        // ===============================
        // SUBJECT
        // ===============================
        if (command === "subject") {
          if (!(await requireAdmin(jid, sender))) return;
          if (!argText) {
            return await sock.sendMessage(jid, {
              text:
                `❌ استعمل:\n${PREFIX}subject اسم الجروب`
            });
          }
          await sock.groupUpdateSubject(
            jid,
            argText
          );
          return await sock.sendMessage(jid, {
            text:
              `✅ تبدل اسم الجروب.\n\n🎁 GFT`
          });
        }
        // ===============================
        // DESCRIPTION
        // ===============================
        if (command === "desc") {
          if (!(await requireAdmin(jid, sender))) return;
          if (!argText) {
            return await sock.sendMessage(jid, {
              text:
                `❌ استعمل:\n${PREFIX}desc الوصف الجديد`
            });
          }
          await sock.groupUpdateDescription(
            jid,
            argText
          );
          return await sock.sendMessage(jid, {
            text:
              `✅ تبدل وصف الجروب.\n\n🎁 GFT`
          });
        }
        // ===============================
        // GROUP LINK
        // ===============================
        if (command === "link") {
          if (!(await requireAdmin(jid, sender))) return;
          const code =
            await sock.groupInviteCode(jid);
          return await sock.sendMessage(jid, {
            text:
              `🔗 Group Link:\n\n` +
              `https://chat.whatsapp.com/${code}`
          });
        }
        // ===============================
        // REVOKE LINK
        // ===============================
        if (command === "revoke") {
          if (!(await requireAdmin(jid, sender))) return;
          await sock.groupRevokeInvite(jid);
          return await sock.sendMessage(jid, {
            text:
              "✅ تم تغيير رابط الجروب."
          });
        }
        // ===============================
        // RULES
        // ===============================
        if (command === "rules") {
          return await sock.sendMessage(jid, {
            text:
              `📜 *GROUP RULES*\n\n` +
              `1️⃣ الاحترام\n` +
              `2️⃣ ممنوع السبام\n` +
              `3️⃣ ممنوع المشاكل\n` +
              `4️⃣ احترم Admins\n\n` +
              `🎁 GFT`
          });
        }
        // ===============================
        // WELCOME
        // ===============================
        if (command === "welcome") {
          if (!(await requireAdmin(jid, sender))) return;
          return await sock.sendMessage(jid, {
            text:
              `👋 Welcome System\n\n` +
              `🟢 ON\n` +
              `🎁 GFT\n\n` +
              `أي عضو جديد غادي يوصله الترحيب.`
          });
        }
        // ===============================
        // UNKNOWN COMMAND
        // ===============================
        return await sock.sendMessage(jid, {
          text:
            `❌ الأمر غير موجود.\n\n` +
            `كتب ${PREFIX}menu باش تشوف الأوامر.`
        });
      } catch (error) {
        console.log(
          "Message Error:",
          error?.message || error
        );
      }
    });
  } catch (error) {
    connected = false;
    console.log(
      "❌ Connection Error:",
      error?.message || error
    );
    if (!reconnecting) {
      reconnecting = true;
      setTimeout(() => {
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
console.log("║       🤖 SPOPO BOT           ║");
console.log("║       🎁 GFT BOT             ║");
console.log("║       🔐 PAIRING CODE        ║");
console.log("╚══════════════════════════════╝");
console.log("");
connectWhatsApp();

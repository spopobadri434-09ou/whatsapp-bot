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

// ==================================================
// 📱 NUMBER
// ==================================================

const BOT_NUMBER = "212690948777";

const BOT_NAME = "SPOPO BOT";

// مهم: استعمل فولدر جديد باش ما نبقاوش عالقين فالـsession القديمة
const SESSION_DIR = "/app/spopo_auth";

// ==================================================
// VARIABLES
// ==================================================

let sock = null;
let connected = false;
let reconnecting = false;
let pairingRequested = false;

// ==================================================
// EXPRESS - RAILWAY
// ==================================================

const app = express();

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SPOPO BOT</title>
</head>

<body style="
font-family:Arial;
text-align:center;
background:#111;
color:white;
padding:40px;
">

<h1>🤖 SPOPO BOT</h1>

<h2>🔐 Pairing Code</h2>

<p>
Status:
<strong>
${connected ? "🟢 Connected" : "🟡 Waiting"}
</strong>
</p>

<h3>🎁 GFT</h3>

<p>WhatsApp Pairing Bot</p>

</body>
</html>
`);
});

app.get("/health", (req, res) => {
  res.json({
    bot: BOT_NAME,
    connected,
    pairingCode: !connected
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Railway server running on port ${PORT}`);
});

// ==================================================
// HELPERS
// ==================================================

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

  if (!group || !sock?.user?.id) {
    return false;
  }

  const botNumber =
    sock.user.id.split(":")[0];

  const botJid =
    `${botNumber}@s.whatsapp.net`;

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
  if (!(await groupOnly(jid))) {
    return false;
  }

  if (!(await isAdmin(jid, sender))) {
    await sock.sendMessage(jid, {
      text: "❌ خاصك تكون Admin."
    });

    return false;
  }

  if (!(await isBotAdmin(jid))) {
    await sock.sendMessage(jid, {
      text:
        "❌ خاصني نكون Admin باش ننفذ هاد الأمر."
    });

    return false;
  }

  return true;
}

function getMentioned(message) {
  return (
    message
      ?.message
      ?.extendedTextMessage
      ?.contextInfo
      ?.mentionedJid?.[0] ||
    null
  );
}

function numberToJid(number) {
  const clean =
    String(number || "")
      .replace(/[^\d]/g, "");

  if (!clean) return null;

  return `${clean}@s.whatsapp.net`;
}

function getTime() {
  return new Date().toLocaleString(
    "fr-FR",
    {
      timeZone: "Africa/Casablanca"
    }
  );
}

// ==================================================
// MENU
// ==================================================

function menu() {
  return `
╭━━━〔 🤖 SPOPO BOT 〕━━━╮
┃
┃ 🎁 GFT BOT
┃ 🔐 PAIRING CODE
┃
┣━━〔 GENERAL 〕━━
┃
┃ .menu
┃ .help
┃ .ping
┃ .alive
┃ .bot
┃ .info
┃ .about
┃ .owner
┃ .time
┃ .date
┃ .id
┃ .jid
┃
┣━━〔 TOOLS 〕━━
┃
┃ .say
┃ .calc
┃
┣━━〔 GROUP 〕━━
┃
┃ .groupinfo
┃ .admins
┃ .tagall
┃ .hidetag
┃ .kick
┃ .add
┃ .promote
┃ .demote
┃ .subject
┃ .desc
┃ .link
┃ .revoke
┃ .rules
┃ .welcome
┃
╰━━━━━━━━━━━━━━━━━━━━╯

🎁 GFT — SPOPO BOT
`;
}

// ==================================================
// START BOT
// ==================================================

async function startBot() {

  try {

    console.log("");
    console.log("================================");
    console.log("🤖 STARTING SPOPO BOT");
    console.log("================================");
    console.log("");

    console.log(
      `📱 Number: ${BOT_NUMBER}`
    );

    console.log(
      `📁 Session: ${SESSION_DIR}`
    );

    console.log("");

    const {
      state,
      saveCreds
    } = await useMultiFileAuthState(
      SESSION_DIR
    );

    // ==================================================
    // SOCKET
    // ==================================================

    sock = makeWASocket({

      auth: state,

      logger: pino({
        level: "silent"
      }),

      browser:
        Browsers.ubuntu("Chrome"),

      printQRInTerminal: false,

      markOnlineOnConnect: false,

      syncFullHistory: false,

      connectTimeoutMs: 60000,

      defaultQueryTimeoutMs: 60000

    });

    // ==================================================
    // SAVE SESSION
    // ==================================================

    sock.ev.on(
      "creds.update",
      saveCreds
    );

    // ==================================================
    // CONNECTION UPDATE
    // ==================================================

    sock.ev.on(
      "connection.update",
      async update => {

        const {
          connection,
          lastDisconnect
        } = update;

        // ==============================================
        // CONNECTING
        // ==============================================

        if (
          connection === "connecting"
        ) {

          console.log(
            "🟡 Connecting to WhatsApp..."
          );

          // ==========================================
          // PAIRING CODE
          // ==========================================

          if (
            !state.creds.registered &&
            !pairingRequested
          ) {

            pairingRequested = true;

            try {

              console.log("");
              console.log(
                "🔐 REQUESTING PAIRING CODE..."
              );
              console.log("");

              const cleanNumber =
                BOT_NUMBER.replace(
                  /[^\d]/g,
                  ""
                );

              const code =
                await sock.requestPairingCode(
                  cleanNumber
                );

              console.log("");
              console.log(
                "╔══════════════════════════════╗"
              );

              console.log(
                "║       🔐 PAIRING CODE        ║"
              );

              console.log(
                "╠══════════════════════════════╣"
              );

              console.log(
                `║        ${code}               ║`
              );

              console.log(
                "╚══════════════════════════════╝"
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
                "→ Link with phone number"
              );

              console.log("");

              console.log(
                "🎁 SPOPO BOT / GFT"
              );

              console.log("");

            } catch (error) {

              console.log("");
              console.log(
                "❌ PAIRING CODE ERROR"
              );

              console.log(
                error?.message ||
                error
              );

              console.log("");

              // باش نقدروا نعاودوا المحاولة
              pairingRequested = false;
            }
          }
        }

        // ==============================================
        // OPEN
        // ==============================================

        if (
          connection === "open"
        ) {

          connected = true;
          reconnecting = false;
          pairingRequested = true;

          console.log("");
          console.log(
            "╔══════════════════════════════╗"
          );

          console.log(
            "║     🟢 SPOPO BOT ONLINE      ║"
          );

          console.log(
            "║          🎁 GFT              ║"
          );

          console.log(
            "╚══════════════════════════════╝"
          );

          console.log("");
        }

        // ==============================================
        // CLOSE
        // ==============================================

        if (
          connection === "close"
        ) {

          connected = false;

          const statusCode =
            new Boom(
              lastDisconnect?.error
            )?.output?.statusCode;

          console.log("");
          console.log(
            `🔴 WhatsApp disconnected: ${statusCode}`
          );

          console.log(
            lastDisconnect?.error?.message ||
            ""
          );

          // 401 = session logged out
          if (
            statusCode ===
            DisconnectReason.loggedOut
          ) {

            console.log("");
            console.log(
              "❌ SESSION LOGGED OUT"
            );

            console.log(
              "🧹 Delete the session folder and pair again."
            );

            console.log("");

            return;
          }

          // reconnect
          if (!reconnecting) {

            reconnecting = true;

            console.log(
              "🔄 Reconnecting in 5 seconds..."
            );

            setTimeout(
              () => {

                reconnecting = false;
                pairingRequested = false;

                startBot();

              },
              5000
            );
          }
        }

      }
    );

    // ==================================================
    // WELCOME
    // ==================================================

    sock.ev.on(
      "group-participants.update",
      async update => {

        try {

          if (
            update.action !== "add"
          ) {
            return;
          }

          const group =
            await sock.groupMetadata(
              update.id
            );

          for (
            const participant
            of update.participants
          ) {

            const number =
              participant.split("@")[0];

            await sock.sendMessage(
              update.id,
              {

                text:
`╭━━━〔 🎉 WELCOME 〕━━━╮

👋 مرحبا @${number}

🤖 مرحبا بك فـ ${BOT_NAME}

🎁 GFT 🎁

📌 كتب .menu
باش تشوف الأوامر.

👥 Group:
${group.subject}

╰━━━━━━━━━━━━━━━━━━━━╯`,

                mentions: [
                  participant
                ]

              }
            );
          }

        } catch (error) {

          console.log(
            "❌ Welcome Error:",
            error?.message ||
            error
          );

        }

      }
    );

    // ==================================================
    // MESSAGES
    // ==================================================

    sock.ev.on(
      "messages.upsert",
      async ({ messages }) => {

        try {

          const message =
            messages?.[0];

          if (
            !message?.message
          ) {
            return;
          }

          if (
            message.key?.fromMe
          ) {
            return;
          }

          const jid =
            message.key?.remoteJid;

          const sender =
            getSender(message);

          if (!jid) {
            return;
          }

          const text =
            getText(message).trim();

          if (
            !text.startsWith(PREFIX)
          ) {
            return;
          }

          const body =
            text.slice(
              PREFIX.length
            ).trim();

          if (!body) {
            return;
          }

          const parts =
            body.split(/\s+/);

          const command =
            parts
              .shift()
              ?.toLowerCase();

          const args = parts;

          const argText =
            args.join(" ");

          // ==================================================
          // MENU
          // ==================================================

          if (
            command === "menu" ||
            command === "help"
          ) {

            return await sock.sendMessage(
              jid,
              {
                text: menu()
              }
            );
          }

          // ==================================================
          // PING
          // ==================================================

          if (
            command === "ping"
          ) {

            return await sock.sendMessage(
              jid,
              {
                text:
`🏓 PONG!

🟢 SPOPO BOT Working
🎁 GFT`
              }
            );
          }

          // ==================================================
          // ALIVE
          // ==================================================

          if (
            command === "alive"
          ) {

            return await sock.sendMessage(
              jid,
              {
                text:
`🟢 ${BOT_NAME} ONLINE

🎁 GFT
🔐 Pairing Code
⏰ ${getTime()}`
              }
            );
          }

          // ==================================================
          // BOT
          // ==================================================

          if (
            command === "bot"
          ) {

            return await sock.sendMessage(
              jid,
              {
                text:
`🤖 SPOPO BOT

🟢 Online
🔐 Pairing Code
🎁 GFT
🚀 Railway`
              }
            );
          }

          // ==================================================
          // INFO
          // ==================================================

          if (
            command === "info" ||
            command === "about"
          ) {

            return await sock.sendMessage(
              jid,
              {
                text:
`╭━━〔 🤖 INFO 〕━━╮

🤖 Name: ${BOT_NAME}
🎁 GFT
⚡ Prefix: ${PREFIX}
🔐 Pairing Code
🚀 Railway

╰━━━━━━━━━━━━━━╯`
              }
            );
          }

          // ==================================================
          // OWNER
          // ==================================================

          if (
            command === "owner"
          ) {

            return await sock.sendMessage(
              jid,
              {
                text:
`👑 OWNER

🤖 ${BOT_NAME}
🎁 GFT`
              }
            );
          }

          // ==================================================
          // TIME
          // ==================================================

          if (
            command === "time"
          ) {

            return await sock.sendMessage(
              jid,
              {
                text:
                  `⏰ ${getTime()}`
              }
            );
          }

          // ==================================================
          // DATE
          // ==================================================

          if (
            command === "date"
          ) {

            const date =
              new Date()
                .toLocaleDateString(
                  "fr-FR",
                  {
                    timeZone:
                      "Africa/Casablanca"
                  }
                );

            return await sock.sendMessage(
              jid,
              {
                text:
                  `📅 ${date}`
              }
            );
          }

          // ==================================================
          // ID
          // ==================================================

          if (
            command === "id" ||
            command === "jid"
          ) {

            return await sock.sendMessage(
              jid,
              {
                text:
                  `🆔 JID:\n${jid}`
              }
            );
          }

          // ==================================================
          // SAY
          // ==================================================

          if (
            command === "say"
          ) {

            if (!argText) {

              return await sock.sendMessage(
                jid,
                {
                  text:
                    "❌ مثال:\n.say Hello"
                }
              );
            }

            return await sock.sendMessage(
              jid,
              {
                text: argText
              }
            );
          }

          // ==================================================
          // CALC
          // ==================================================

          if (
            command === "calc"
          ) {

            if (!argText) {

              return await sock.sendMessage(
                jid,
                {
                  text:
                    "❌ مثال:\n.calc 10+5*2"
                }
              );
            }

            if (
              !/^[0-9+\-*/(). %]+$/.test(
                argText
              )
            ) {

              return await sock.sendMessage(
                jid,
                {
                  text:
                    "❌ عملية غير صالحة."
                }
              );
            }

            try {

              const result =
                Function(
                  `"use strict"; return (${argText})`
                )();

              return await sock.sendMessage(
                jid,
                {
                  text:
                    `🧮 ${argText} = ${result}`
                }
              );

            } catch {

              return await sock.sendMessage(
                jid,
                {
                  text:
                    "❌ خطأ فالحساب."
                }
              );
            }
          }

          // ==================================================
          // GROUP INFO
          // ==================================================

          if (
            command === "groupinfo"
          ) {

            if (
              !(await groupOnly(jid))
            ) {
              return;
            }

            const group =
              await getGroup(jid);

            const admins =
              group.participants.filter(
                p => p.admin
              );

            return await sock.sendMessage(
              jid,
              {
                text:
`╭━━〔 GROUP INFO 〕━━╮

📌 Name:
${group.subject}

👥 Members:
${group.participants.length}

👮 Admins:
${admins.length}

🆔 ${group.id}

🎁 GFT

╰━━━━━━━━━━━━━━━━╯`
              }
            );
          }

          // ==================================================
          // ADMINS
          // ==================================================

          if (
            command === "admins"
          ) {

            if (
              !(await groupOnly(jid))
            ) {
              return;
            }

            const group =
              await getGroup(jid);

            const admins =
              group.participants.filter(
                p => p.admin
              );

            const mentions =
              admins.map(
                p => p.id
              );

            let msg =
              "👮 GROUP ADMINS\n\n";

            for (
              const admin
              of admins
            ) {

              msg +=
                `@${admin.id.split("@")[0]}\n`;
            }

            return await sock.sendMessage(
              jid,
              {
                text: msg,
                mentions
              }
            );
          }

          // ==================================================
          // TAG ALL
          // ==================================================

          if (
            command === "tagall"
          ) {

            if (
              !(await adminOnly(
                jid,
                sender
              ))
            ) {
              return;
            }

            const group =
              await getGroup(jid);

            const mentions =
              group.participants.map(
                p => p.id
              );

            let msg =
              "📢 TAG ALL\n\n";

            for (
              const p
              of group.participants
            ) {

              msg +=
                `@${p.id.split("@")[0]} `;
            }

            return await sock.sendMessage(
              jid,
              {
                text: msg,
                mentions
              }
            );
          }

          // ==================================================
          // HIDETAG
          // ==================================================

          if (
            command === "hidetag"
          ) {

            if (
              !(await adminOnly(
                jid,
                sender
              ))
            ) {
              return;
            }

            const group =
              await getGroup(jid);

            const mentions =
              group.participants.map(
                p => p.id
              );

            return await sock.sendMessage(
              jid,
              {
                text:
                  argText ||
                  "📢 Message from Admin\n🎁 GFT",
                mentions
              }
            );
          }

          // ==================================================
          // KICK
          // ==================================================

          if (
            command === "kick"
          ) {

            if (
              !(await adminOnly(
                jid,
                sender
              ))
            ) {
              return;
            }

            let target =
              getMentioned(message);

            if (
              !target &&
              args[0]
            ) {

              target =
                numberToJid(
                  args[0]
                );
            }

            if (!target) {

              return await sock.sendMessage(
                jid,
                {
                  text:
                    "❌ .kick @user"
                }
              );
            }

            await sock.groupParticipantsUpdate(
              jid,
              [target],
              "remove"
            );

            return await sock.sendMessage(
              jid,
              {
                text:
                  `✅ تم إخراج @${target.split("@")[0]}`,
                mentions: [target]
              }
            );
          }

          // ==================================================
          // ADD
          // ==================================================

          if (
            command === "add"
          ) {

            if (
              !(await adminOnly(
                jid,
                sender
              ))
            ) {
              return;
            }

            if (!args[0]) {

              return await sock.sendMessage(
                jid,
                {
                  text:
                    "❌ مثال:\n.add 2126XXXXXXXX"
                }
              );
            }

            const target =
              numberToJid(
                args[0]
              );

            await sock.groupParticipantsUpdate(
              jid,
              [target],
              "add"
            );

            return await sock.sendMessage(
              jid,
              {
                text:
                  `✅ تمت محاولة إضافة @${target.split("@")[0]}`,
                mentions: [target]
              }
            );
          }

          // ==================================================
          // PROMOTE
          // ==================================================

          if (
            command === "promote"
          ) {

            if (
              !(await adminOnly(
                jid,
                sender
              ))
            ) {
              return;
            }

            let target =
              getMentioned(message);

            if (
              !target &&
              args[0]
            ) {

              target =
                numberToJid(
                  args[0]
                );
            }

            if (!target) {

              return await sock.sendMessage(
                jid,
                {
                  text:
                    "❌ .promote @user"
                }
              );
            }

            await sock.groupParticipantsUpdate(
              jid,
              [target],
              "promote"
            );

            return await sock.sendMessage(
              jid,
              {
                text:
                  `👑 @${target.split("@")[0]} ولى Admin`,
                mentions: [target]
              }
            );
          }

          // ==================================================
          // DEMOTE
          // ==================================================

          if (
            command === "demote"
          ) {

            if (
              !(await adminOnly(
                jid,
                sender
              ))
            ) {
              return;
            }

            let target =
              getMentioned(message);

            if (
              !target &&
              args[0]
            ) {

              target =
                numberToJid(
                  args[0]
                );
            }

            if (!target) {

              return await sock.sendMessage(
                jid,
                {
                  text:
                    "❌ .demote @user"
                }
              );
            }

            await sock.groupParticipantsUpdate(
              jid,
              [target],
              "demote"
            );

            return await sock.sendMessage(
              jid,
              {
                text:
                  `✅ تحيد Admin من @${target.split("@")[0]}`,
                mentions: [target]
              }
            );
          }

          // ==================================================
          // SUBJECT
          // ==================================================

          if (
            command === "subject"
          ) {

            if (
              !(await adminOnly(
                jid,
                sender
              ))
            ) {
              return;
            }

            if (!argText) {

              return await sock.sendMessage(
                jid,
                {
                  text:
                    "❌ .subject الاسم الجديد"
                }
              );
            }

            await sock.groupUpdateSubject(
              jid,
              argText
            );

            return await sock.sendMessage(
              jid,
              {
                text:
                  "✅ تبدل اسم الجروب.\n🎁 GFT"
              }
            );
          }

          // ==================================================
          // DESC
          // ==================================================

          if (
            command === "desc"
          ) {

            if (
              !(await adminOnly(
                jid,
                sender
              ))
            ) {
              return;
            }

            if (!argText) {

              return await sock.sendMessage(
                jid,
                {
                  text:
                    "❌ .desc الوصف الجديد"
                }
              );
            }

            await sock.groupUpdateDescription(
              jid,
              argText
            );

            return await sock.sendMessage(
              jid,
              {
                text:
                  "✅ تبدل وصف الجروب.\n🎁 GFT"
              }
            );
          }

          // ==================================================
          // LINK
          // ==================================================

          if (
            command === "link"
          ) {

            if (
              !(await adminOnly(
                jid,
                sender
              ))
            ) {
              return;
            }

            const code =
              await sock.groupInviteCode(
                jid
              );

            return await sock.sendMessage(
              jid,
              {
                text:
`🔗 GROUP LINK

https://chat.whatsapp.com/${code}

🎁 GFT`
              }
            );
          }

          // ==================================================
          // REVOKE
          // ==================================================

          if (
            command === "revoke"
          ) {

            if (
              !(await adminOnly(
                jid,
                sender
              ))
            ) {
              return;
            }

            await sock.groupRevokeInvite(
              jid
            );

            return await sock.sendMessage(
              jid,
              {
                text:
                  "✅ تبدل رابط الجروب."
              }
            );
          }

          // ==================================================
          // RULES
          // ==================================================

          if (
            command === "rules"
          ) {

            return await sock.sendMessage(
              jid,
              {
                text:
`📜 GROUP RULES

1️⃣ الاحترام
2️⃣ ممنوع السبام
3️⃣ ممنوع المشاكل
4️⃣ احترام Admins

🎁 GFT`
              }
            );
          }

          // ==================================================
          // WELCOME
          // ==================================================

          if (
            command === "welcome"
          ) {

            if (
              !(await groupOnly(jid))
            ) {
              return;
            }

            return await sock.sendMessage(
              jid,
              {
                text:
`👋 WELCOME SYSTEM

🟢 Status: ON

🎁 GFT

أي عضو جديد يدخل
غادي توصله رسالة ترحيب.`
              }
            );
          }

          // ==================================================
          // UNKNOWN
          // ==================================================

          return await sock.sendMessage(
            jid,
            {
              text:
`❌ الأمر غير موجود.

كتب:
.menu

🎁 GFT`
            }
          );

        } catch (error) {

          console.log(
            "❌ Message Error:",
            error?.message ||
            error
          );

        }

      }
    );

  } catch (error) {

    connected = false;

    console.log("");
    console.log(
      "❌ START ERROR:"
    );

    console.log(
      error?.message ||
      error
    );

    console.log("");

    if (!reconnecting) {

      reconnecting = true;

      setTimeout(
        () => {

          reconnecting = false;
          pairingRequested = false;

          startBot();

        },
        5000
      );
    }

  }

}

// ==================================================
// START
// ==================================================

console.log("");
console.log(
  "╔════════════════════════════════╗"
);

console.log(
  "║        🤖 SPOPO BOT            ║"
);

console.log(
  "║        🎁 GFT BOT              ║"
);

console.log(
  "║        🔐 PAIRING CODE         ║"
);

console.log(
  "╚════════════════════════════════╝"
);

console.log("");

startBot();

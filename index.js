const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const P = require("pino");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// ===============================
// 🤖 SPOPO BOT
// ===============================

const PHONE_NUMBER = "212644140800";

const AUTH_DIR = "./auth_info_baileys";

let pairingRequested = false;

const settings = new Map();
const spamData = new Map();
const joinTimes = new Map();

// ===============================
// 🛠️ أدوات مساعدة
// ===============================

function getText(message) {
  if (!message) return "";

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    ""
  ).trim();
}

function jidNumber(jid) {
  if (!jid) return "";
  return jid.split("@")[0].split(":")[0];
}

function sameUser(a, b) {
  return jidNumber(a) === jidNumber(b);
}

function mentionText(participants) {
  return participants
    .map((p) => `@${jidNumber(p.id)}`)
    .join(" ");
}

function isLink(text) {
  return /(https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\/|discord\.gg\/)/i.test(
    text
  );
}

async function isGroupAdmin(sock, jid, user) {
  try {
    const metadata = await sock.groupMetadata(jid);

    const participant = metadata.participants.find((p) =>
      sameUser(p.id, user)
    );

    return !!participant?.admin;
  } catch {
    return false;
  }
}

async function botIsAdmin(sock, jid) {
  try {
    const metadata = await sock.groupMetadata(jid);

    if (!sock.user?.id) return false;

    const me = metadata.participants.find((p) =>
      sameUser(p.id, sock.user.id)
    );

    return !!me?.admin;
  } catch {
    return false;
  }
}

async function getTarget(msg, text) {
  if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    return msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
  }

  const number = text.match(/@(\d{5,16})/);

  if (number) {
    return `${number[1]}@s.whatsapp.net`;
  }

  return null;
}

async function send(sock, jid, text, mentions = []) {
  return sock.sendMessage(jid, {
    text,
    mentions
  });
}

// ===============================
// 🚀 تشغيل البوت
// ===============================

async function startBot() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,

    logger: P({
      level: "silent"
    }),

    // Browser ثابت
    browser: ["Ubuntu", "Chrome", "20.0.04"],

    printQRInTerminal: false,

    markOnlineOnConnect: false
  });

  sock.ev.on("creds.update", saveCreds);

  // ===============================
  // 🔑 Pairing Code
  // ===============================

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (
      connection === "connecting" &&
      !state.creds.registered &&
      !pairingRequested
    ) {
      pairingRequested = true;

      try {
        // نعطي وقت للاتصال قبل طلب الكود
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const code = await sock.requestPairingCode(
          PHONE_NUMBER.replace(/\D/g, "")
        );

        console.log("");
        console.log("====================================");
        console.log("🤖 SPOPO BOT");
        console.log("🔑 PAIRING CODE:");
        console.log(code);
        console.log("====================================");
        console.log("");
      } catch (error) {
        console.log("❌ Pairing Code Error:");
        console.log(error?.message || error);

        pairingRequested = false;
      }
    }

    if (connection === "open") {
      console.log("");
      console.log("====================================");
      console.log("✅ SPOPO BOT CONNECTED!");
      console.log("🤖 البوت خدام دابا");
      console.log("====================================");
      console.log("");
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      console.log("❌ الاتصال تسد");

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("🚪 WhatsApp دار Logout.");
        console.log("❌ خاصك تربط الحساب من جديد.");
      } else {
        console.log("🔄 إعادة الاتصال...");
        pairingRequested = false;

        setTimeout(() => {
          startBot();
        }, 5000);
      }
    }
  });

  // ===============================
  // 👥 دخول وخروج الأعضاء
  // ===============================

  sock.ev.on("group-participants.update", async (update) => {
    try {
      const { id, participants, action } = update;

      if (action === "add") {
        for (const participant of participants) {
          joinTimes.set(`${id}:${participant}`, Date.now());
        }

        const enabled = settings.get(`${id}:welcome`);

        if (enabled !== false) {
          for (const participant of participants) {
            const number = jidNumber(participant);

            await send(
              sock,
              id,
              `👋 مرحبا بك @${number}\n\n🤖 مرحبا بك مع *SPOPO BOT* 🌟`,
              [participant]
            );
          }
        }
      }

      if (action === "remove") {
        for (const participant of participants) {
          joinTimes.delete(`${id}:${participant}`);
        }
      }
    } catch (error) {
      console.log("Welcome error:", error?.message || error);
    }
  });

  // ===============================
  // 💬 الرسائل
  // ===============================

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];

      if (!msg?.message) return;

      if (msg.key.fromMe) return;

      const jid = msg.key.remoteJid;

      if (!jid) return;

      const text = getText(msg.message);

      if (!text) return;

      const sender =
        msg.key.participant ||
        msg.key.remoteJid;

      const isGroup = jid.endsWith("@g.us");

      // ===============================
      // 🛡️ Anti Spam
      // ===============================

      if (isGroup) {
        const spamKey = `${jid}:${sender}`;

        const now = Date.now();

        let data = spamData.get(spamKey);

        if (!data) {
          data = [];
        }

        data = data.filter((time) => now - time < 10000);

        data.push(now);

        spamData.set(spamKey, data);

        const spamEnabled =
          settings.get(`${jid}:antispam`) === true;

        if (spamEnabled && data.length >= 6) {
          const admin = await isGroupAdmin(
            sock,
            jid,
            sender
          );

          if (!admin) {
            await sock.sendMessage(jid, {
              delete: msg.key
            });

            if (await botIsAdmin(sock, jid)) {
              await sock.groupParticipantsUpdate(
                jid,
                [sender],
                "remove"
              );
            }

            return;
          }
        }
      }

      // ===============================
      // 🔗 Anti Link
      // ===============================

      if (isGroup && isLink(text)) {
        const antiLinkEnabled =
          settings.get(`${jid}:antilink`) === true;

        if (antiLinkEnabled) {
          const admin = await isGroupAdmin(
            sock,
            jid,
            sender
          );

          if (!admin) {
            await sock.sendMessage(jid, {
              delete: msg.key
            });

            await send(
              sock,
              jid,
              "🚫 ممنوع إرسال الروابط هنا."
            );

            return;
          }
        }
      }

      // ===============================
      // 📋 MENU
      // ===============================

      if (
        text.toLowerCase() === ".menu" ||
        text.toLowerCase() === ".help"
      ) {
        await send(
          sock,
          jid,
          `╭━━━〔 🤖 *SPOPO BOT* 〕━━━╮

📋 *الأوامر العامة*

.menu
.hello
.bot
.ping
.groupinfo
.admins
.info @عضو

👥 *أوامر الأعضاء*

.tagall
.منشن
.طرد @عضو
.kick @عضو

👑 *أوامر الإدارة*

.ادمن @عضو
.promote @عضو

.نزع @عضو
.demote @عضو

🔗 *الحماية*

.antilink on
.antilink off

.antispam on
.antispam off

👋 *الترحيب*

.welcome on
.welcome off

🎨 *الصور*

.sticker

╰━━━━━━━━━━━━━━━━━━╯

🤖 *SPOPO BOT*`
        );

        return;
      }

      // ===============================
      // ❤️ HELLO
      // ===============================

      if (
        text.toLowerCase() === ".hello" ||
        text.toLowerCase() === ".bot"
      ) {
        await send(
          sock,
          jid,
          "👋 سلام!\n🤖 أنا *SPOPO BOT* 🤖"
        );

        return;
      }

      // ===============================
      // 🏓 PING
      // ===============================

      if (text.toLowerCase() === ".ping") {
        await send(
          sock,
          jid,
          "🏓 Pong!\n🤖 SPOPO BOT خدام مزيان."
        );

        return;
      }

      // ===============================
      // ℹ️ GROUP INFO
      // ===============================

      if (
        isGroup &&
        text.toLowerCase() === ".groupinfo"
      ) {
        const metadata = await sock.groupMetadata(jid);

        const admins = metadata.participants.filter(
          (p) => p.admin
        );

        await send(
          sock,
          jid,
          `📊 *معلومات المجموعة*

👥 الاسم: ${metadata.subject}

👤 عدد الأعضاء: ${metadata.participants.length}

👑 عدد الأدمنية: ${admins.length}

🆔 ${jid}`
        );

        return;
      }

      // ===============================
      // 👑 ADMINS
      // ===============================

      if (
        isGroup &&
        text.toLowerCase() === ".admins"
      ) {
        const metadata = await sock.groupMetadata(jid);

        const admins = metadata.participants.filter(
          (p) => p.admin
        );

        const mentions = admins.map((p) => p.id);

        const list = admins
          .map((p) => `👑 @${jidNumber(p.id)}`)
          .join("\n");

        await send(
          sock,
          jid,
          `👑 *أدمنية المجموعة:*\n\n${list}`,
          mentions
        );

        return;
      }

      // ===============================
      // 📢 TAG ALL
      // ===============================

      if (
        isGroup &&
        (
          text.toLowerCase() === ".tagall" ||
          text.toLowerCase() === ".منشن"
        )
      ) {
        const metadata = await sock.groupMetadata(jid);

        const admin = await isGroupAdmin(
          sock,
          jid,
          sender
        );

        if (!admin) {
          await send(
            sock,
            jid,
            "❌ هاد الأمر غير للأدمنية."
          );

          return;
        }

        const mentions = metadata.participants.map(
          (p) => p.id
        );

        const list = metadata.participants
          .map((p) => `@${jidNumber(p.id)}`)
          .join(" ");

        await send(
          sock,
          jid,
          `📢 *منشن لجميع الأعضاء*\n\n${list}`,
          mentions
        );

        return;
      }

      // ===============================
      // 🚫 KICK
      // ===============================

      if (
        isGroup &&
        (
          text.toLowerCase().startsWith(".طرد") ||
          text.toLowerCase().startsWith(".kick")
        )
      ) {
        const admin = await isGroupAdmin(
          sock,
          jid,
          sender
        );

        if (!admin) {
          await send(
            sock,
            jid,
            "❌ خاصك تكون Admin."
          );

          return;
        }

        if (!(await botIsAdmin(sock, jid))) {
          await send(
            sock,
            jid,
            "❌ خاصني أنا حتى نكون Admin باش نقدر نطرد."
          );

          return;
        }

        const target = await getTarget(
          msg,
          text
        );

        if (!target) {
          await send(
            sock,
            jid,
            "⚠️ منشن العضو.\nمثال:\n.طرد @212XXXXXXXXX"
          );

          return;
        }

        await sock.groupParticipantsUpdate(
          jid,
          [target],
          "remove"
        );

        await send(
          sock,
          jid,
          `🚫 تم طرد @${jidNumber(target)}`,
          [target]
        );

        return;
      }

      // ===============================
      // 👑 PROMOTE
      // ===============================

      if (
        isGroup &&
        (
          text.toLowerCase().startsWith(".ادمن") ||
          text.toLowerCase().startsWith(".promote")
        )
      ) {
        const admin = await isGroupAdmin(
          sock,
          jid,
          sender
        );

        if (!admin) {
          await send(
            sock,
            jid,
            "❌ هاد الأمر للأدمنية فقط."
          );

          return;
        }

        if (!(await botIsAdmin(sock, jid))) {
          await send(
            sock,
            jid,
            "❌ خاصني نكون Admin."
          );

          return;
        }

        const target = await getTarget(
          msg,
          text
        );

        if (!target) {
          await send(
            sock,
            jid,
            "⚠️ منشن العضو."
          );

          return;
        }

        await sock.groupParticipantsUpdate(
          jid,
          [target],
          "promote"
        );

        await send(
          sock,
          jid,
          `👑 @${jidNumber(target)} ولى Admin.`,
          [target]
        );

        return;
      }

      // ===============================
      // 🔽 DEMOTE
      // ===============================

      if (
        isGroup &&
        (
          text.toLowerCase().startsWith(".نزع") ||
          text.toLowerCase().startsWith(".demote")
        )
      ) {
        const admin = await isGroupAdmin(
          sock,
          jid,
          sender
        );

        if (!admin) {
          await send(
            sock,
            jid,
            "❌ هاد الأمر للأدمنية فقط."
          );

          return;
        }

        if (!(await botIsAdmin(sock, jid))) {
          await send(
            sock,
            jid,
            "❌ خاصني نكون Admin."
          );

          return;
        }

        const target = await getTarget(
          msg,
          text
        );

        if (!target) {
          await send(
            sock,
            jid,
            "⚠️ منشن العضو."
          );

          return;
        }

        await sock.groupParticipantsUpdate(
          jid,
          [target],
          "demote"
        );

        await send(
          sock,
          jid,
          `🔽 @${jidNumber(target)} ما بقاش Admin.`,
          [target]
        );

        return;
      }

      // ===============================
      // 🔗 ANTILINK ON/OFF
      // ===============================

      if (
        isGroup &&
        (
          text.toLowerCase() === ".antilink on" ||
          text.toLowerCase() === ".antilink off"
        )
      ) {
        const admin = await isGroupAdmin(
          sock,
          jid,
          sender
        );

        if (!admin) {
          await send(
            sock,
            jid,
            "❌ غير الأدمنية يقدرو يبدلو الحماية."
          );

          return;
        }

        const enabled =
          text.toLowerCase() === ".antilink on";

        settings.set(
          `${jid}:antilink`,
          enabled
        );

        await send(
          sock,
          jid,
          enabled
            ? "✅ Anti-Link تشعل."
            : "❌ Anti-Link تطفات."
        );

        return;
      }

      // ===============================
      // 🛡️ ANTISPAM
      // ===============================

      if (
        isGroup &&
        (
          text.toLowerCase() === ".antispam on" ||
          text.toLowerCase() === ".antispam off"
        )
      ) {
        const admin = await isGroupAdmin(
          sock,
          jid,
          sender
        );

        if (!admin) {
          await send(
            sock,
            jid,
            "❌ غير الأدمنية."
          );

          return;
        }

        const enabled =
          text.toLowerCase() === ".antispam on";

        settings.set(
          `${jid}:antispam`,
          enabled
        );

        await send(
          sock,
          jid,
          enabled
            ? "✅ Anti-Spam تشعل."
            : "❌ Anti-Spam تطفات."
        );

        return;
      }

      // ===============================
      // 👋 WELCOME
      // ===============================

      if (
        isGroup &&
        (
          text.toLowerCase() === ".welcome on" ||
          text.toLowerCase() === ".welcome off"
        )
      ) {
        const admin = await isGroupAdmin(
          sock,
          jid,
          sender
        );

        if (!admin) {
          await send(
            sock,
            jid,
            "❌ غير الأدمنية."
          );

          return;
        }

        const enabled =
          text.toLowerCase() === ".welcome on";

        settings.set(
          `${jid}:welcome`,
          enabled
        );

        await send(
          sock,
          jid,
          enabled
            ? "✅ الترحيب تشعل."
            : "❌ الترحيب تطفا."
        );

        return;
      }

      // ===============================
      // 👤 INFO
      // ===============================

      if (
        isGroup &&
        text.toLowerCase().startsWith(".info")
      ) {
        const target = await getTarget(
          msg,
          text
        );

        if (!target) {
          await send(
            sock,
            jid,
            "⚠️ منشن العضو.\nمثال:\n.info @212XXXXXXXXX"
          );

          return;
        }

        const metadata =
          await sock.groupMetadata(jid);

        const participant =
          metadata.participants.find((p) =>
            sameUser(p.id, target)
          );

        if (!participant) {
          await send(
            sock,
            jid,
            "❌ العضو ما لقيتوش."
          );

          return;
        }

        const joinKey =
          `${jid}:${participant.id}`;

        const joined =
          joinTimes.get(joinKey);

        let joinedText =
          "غير معروف";

        if (joined) {
          joinedText =
            new Date(joined).toLocaleString(
              "fr-MA"
            );
        }

        await send(
          sock,
          jid,
          `👤 *معلومات العضو*

📱 الرقم: @${jidNumber(participant.id)}

👑 الرتبة: ${
            participant.admin
              ? "Admin"
              : "عضو"
          }

🕒 وقت الدخول: ${joinedText}`,
          [participant.id]
        );

        return;
      }

      // ===============================
      // 🎨 STICKER
      // ===============================

      if (
        isGroup &&
        text.toLowerCase() === ".sticker"
      ) {
        const imageMessage =
          msg.message?.imageMessage;

        const quoted =
          msg.message?.extendedTextMessage
            ?.contextInfo
            ?.quotedMessage;

        let image =
          imageMessage ||
          quoted?.imageMessage;

        if (!image) {
          await send(
            sock,
            jid,
            "📸 صيفط صورة وكتب فالكابشن:\n.sticker"
          );

          return;
        }

        try {
          const stream =
            await downloadContentFromMessage(
              image,
              "image"
            );

          const chunks = [];

          for await (const chunk of stream) {
            chunks.push(chunk);
          }

          const inputBuffer =
            Buffer.concat(chunks);

          const stickerBuffer =
            await sharp(inputBuffer)
              .resize(512, 512, {
                fit: "inside",
                withoutEnlargement: true
              })
              .webp({
                quality: 80
              })
              .toBuffer();

          await sock.sendMessage(
            jid,
            {
              sticker: stickerBuffer
            }
          );
        } catch (error) {
          console.log(
            "Sticker error:",
            error?.message || error
          );

          await send(
            sock,
            jid,
            "❌ ما قدرتش نصاوب Sticker لهاد الصورة."
          );
        }

        return;
      }

    } catch (error) {
      console.log(
        "Message Error:",
        error?.message || error
      );
    }
  });
}

// ===============================
// ▶️ START
// ===============================

startBot().catch((error) => {
  console.error("❌ Bot Error:", error);
});

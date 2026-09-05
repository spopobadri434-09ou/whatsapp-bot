const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const P = require("pino");

const PHONE_NUMBER = "212644140800";

const antiLink = new Map();
const spam = new Map();
let pairingRequested = false;

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("./auth_info_baileys");

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (
      connection === "connecting" &&
      !state.creds.registered &&
      !pairingRequested
    ) {
      pairingRequested = true;

      try {
        await new Promise((r) => setTimeout(r, 3000));
        const code = await sock.requestPairingCode(PHONE_NUMBER);
        console.log("🔑 Pairing Code:", code);
      } catch (e) {
        pairingRequested = false;
        console.log("❌ Pairing Error:", e);
      }
    }

    if (connection === "open") {
      console.log("✅ البوت متصل بواتساب");
    }

    if (connection === "close") {
      const reconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (reconnect) startBot();
    }
  });

  sock.ev.on("group-participants.update", async (update) => {
    if (update.action !== "add") return;

    for (const user of update.participants) {
      await sock.sendMessage(update.id, {
        text:
`👋 مرحبا @${user.split("@")[0]} ❤️

نورت المجموعة 🌟`,
        mentions: [user]
      });
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];

    if (!msg?.message) return;

    const jid = msg.key.remoteJid;
    if (!jid?.endsWith("@g.us")) return;

    const sender = msg.key.participant || jid;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    const command = text.trim().toLowerCase();

    let metadata;

    try {
      metadata = await sock.groupMetadata(jid);
    } catch {
      return;
    }

    const me = metadata.participants.find(
      (p) => p.id === sock.user.id.split(":")[0] + "@s.whatsapp.net"
    );

    const member = metadata.participants.find(
      (p) => p.id === sender
    );

    const isAdmin =
      member?.admin === "admin" ||
      member?.admin === "superadmin";

    const botIsAdmin =
      me?.admin === "admin" ||
      me?.admin === "superadmin";

    // =========================
    // MENU
    // =========================

    if (command === ".menu") {
      await sock.sendMessage(jid, {
        text:
`🤖 *BOT MENU*

👑 الإدارة
.ادمن @عضو
.نزع @عضو
.طرد @عضو

👥 الأعضاء
.tagall
.info @عضو
.groupinfo
.admins

🛡️ الحماية
.antilink on
.antilink off

🖼️ الصور
.sticker

ℹ️ أخرى
.menu
.hello`
      });
      return;
    }

    if (command === ".hello") {
      await sock.sendMessage(jid, {
        text: "👋 سلام! البوت خدام."
      });
      return;
    }

    // =========================
    // GROUP INFO
    // =========================

    if (command === ".groupinfo") {
      await sock.sendMessage(jid, {
        text:
`📊 *معلومات المجموعة*

🏷️ الاسم: ${metadata.subject}
👥 الأعضاء: ${metadata.participants.length}
👑 الأدمن: ${
  metadata.participants.filter(
    p => p.admin
  ).length
}`
      });
      return;
    }

    // =========================
    // ADMINS
    // =========================

    if (command === ".admins") {
      const admins = metadata.participants
        .filter(p => p.admin)
        .map(p => `@${p.id.split("@")[0]}`)
        .join("\n");

      await sock.sendMessage(jid, {
        text: `👑 *أدمن المجموعة:*\n\n${admins}`,
        mentions: metadata.participants
          .filter(p => p.admin)
          .map(p => p.id)
      });

      return;
    }

    // =========================
    // TAG ALL
    // =========================

    if (command === ".tagall") {
      if (!isAdmin) {
        await sock.sendMessage(jid, {
          text: "❌ هاد الأمر غير للأدمن."
        });
        return;
      }

      const mentions = metadata.participants.map(p => p.id);

      const textTag = mentions
        .map(p => `@${p.split("@")[0]}`)
        .join(" ");

      await sock.sendMessage(jid, {
        text: `📢 *تنبيه للجميع*\n\n${textTag}`,
        mentions
      });

      return;
    }

    // =========================
    // ANTILINK
    // =========================

    if (command === ".antilink on") {
      if (!isAdmin) return;

      antiLink.set(jid, true);

      await sock.sendMessage(jid, {
        text: "🔗✅ تم تشغيل منع الروابط."
      });

      return;
    }

    if (command === ".antilink off") {
      if (!isAdmin) return;

      antiLink.set(jid, false);

      await sock.sendMessage(jid, {
        text: "🔗❌ تم إيقاف منع الروابط."
      });

      return;
    }

    // =========================
    // معرفة المنشن
    // =========================

    const mentioned =
      msg.message.extendedTextMessage
        ?.contextInfo
        ?.mentionedJid || [];

    const target = mentioned[0];

    // =========================
    // طرد
    // =========================

    if (command.startsWith(".طرد")) {
      if (!isAdmin) {
        await sock.sendMessage(jid, {
          text: "❌ خاصك تكون Admin."
        });
        return;
      }

      if (!botIsAdmin) {
        await sock.sendMessage(jid, {
          text: "❌ خاصني نكون Admin باش نطرد."
        });
        return;
      }

      if (!target) {
        await sock.sendMessage(jid, {
          text: "❌ منشن العضو: .طرد @عضو"
        });
        return;
      }

      await sock.groupParticipantsUpdate(
        jid,
        [target],
        "remove"
      );

      await sock.sendMessage(jid, {
        text: "🚫 تم طرد العضو."
      });

      return;
    }

    // =========================
    // منح Admin
    // =========================

    if (command.startsWith(".ادمن")) {
      if (!isAdmin || !botIsAdmin) return;

      if (!target) {
        await sock.sendMessage(jid, {
          text: "❌ منشن العضو: .ادمن @عضو"
        });
        return;
      }

      await sock.groupParticipantsUpdate(
        jid,
        [target],
        "promote"
      );

      await sock.sendMessage(jid, {
        text: "👑 تم منح العضو صلاحية Admin."
      });

      return;
    }

    // =========================
    // نزع Admin
    // =========================

    if (command.startsWith(".نزع")) {
      if (!isAdmin || !botIsAdmin) return;

      if (!target) {
        await sock.sendMessage(jid, {
          text: "❌ منشن العضو: .نزع @عضو"
        });
        return;
      }

      await sock.groupParticipantsUpdate(
        jid,
        [target],
        "demote"
      );

      await sock.sendMessage(jid, {
        text: "🔻 تم نزع صلاحية Admin."
      });

      return;
    }

    // =========================
    // INFO
    // =========================

    if (command.startsWith(".info")) {
      const user = target || sender;

      const p = metadata.participants.find(
        x => x.id === user
      );

      await sock.sendMessage(jid, {
        text:
`👤 *معلومات العضو*

📱 الرقم: ${user.split("@")[0]}
👑 الحالة: ${
  p?.admin
    ? "Admin"
    : "عضو"
}`
      });

      return;
    }

    // =========================
    // حذف الروابط
    // =========================

    const link =
      /(https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|t\.me\/)/i;

    if (
      antiLink.get(jid) &&
      link.test(text) &&
      !isAdmin
    ) {
      if (botIsAdmin) {
        try {
          await sock.sendMessage(jid, {
            delete: msg.key
          });

          await sock.sendMessage(jid, {
            text: "🚫 ممنوع إرسال الروابط."
          });
        } catch {}
      }

      return;
    }

    // =========================
    // Anti Spam
    // 5 رسائل خلال 10 ثواني
    // =========================

    if (!isAdmin) {
      const now = Date.now();

      const old = spam.get(sender) || [];

      const recent = old.filter(
        t => now - t < 10000
      );

      recent.push(now);

      spam.set(sender, recent);

      if (recent.length >= 5) {
        if (botIsAdmin) {
          try {
            await sock.groupParticipantsUpdate(
              jid,
              [sender],
              "remove"
            );

            await sock.sendMessage(jid, {
              text: "🚫 تم طرد العضو بسبب Spam."
            });
          } catch {}
        }

        spam.delete(sender);
      }
    }

    // =========================
    // Sticker
    // =========================

    if (command === ".sticker") {
      await sock.sendMessage(jid, {
        text:
"🖼️ أرسل صورة مع الكابشن `.sticker` باش نحولها لـ Sticker."
      });
    }
  });
}

startBot();

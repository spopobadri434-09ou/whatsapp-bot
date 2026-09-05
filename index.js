import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  delay
} from "@whiskeysockets/baileys";
import P from "pino";
const PREFIX = ".";
const BOT_NUMBER = "212644140800"; // 0644140800
const SESSION = "./session";
const logger = P({ level: "silent" });
// ===============================
// 🛡️ SETTINGS
// ===============================
const settings = {
  antiLink: true,
  antiSpam: true,
  antiBadWord: true,
  maxSpamMessages: 6,
  spamTime: 8000,
  maxWarnings: 3,
  badWords: [
    "كلمة1",
    "كلمة2",
    "كلمة3"
  ]
};
// ===============================
// 💾 DATA
// ===============================
const warnings = new Map();
const spam = new Map();
// ===============================
// 🎌 MENU
// ===============================
const MENU = `
╭━━━〔 🎌 SPOPO BOT V2 〕━━━╮
┃
┃ 🎌 ANIME SYSTEM
┃ ├ .menu
┃ ├ .anime
┃ ├ .waifu
┃ └ .quote
┃
┃ 🛡️ GROUP PROTECTION
┃ ├ .antilink on/off
┃ ├ .antispam on/off
┃ ├ .badword on/off
┃ └ .warn @user
┃
┃ 👑 ADMIN
┃ ├ .kick @user
┃ ├ .ban @user
┃ ├ .promote @user
┃ └ .demote @user
┃
┃ 🪙 XP / POINTS
┃ ├ .rank
┃ ├ .level
┃ ├ .points
┃ ├ .daily
┃ ├ .top
┃ └ .shop
┃
┃ 🎵 MEDIA
┃ ├ .song
┃ ├ .image
┃ └ .sticker
┃
┃ 📸 INSTAGRAM
┃ ├ .ig
┃ ├ .iguser
┃ └ .igstats
┃
┃ 😂 FUN
┃ ├ .joke
┃ ├ .love
┃ ├ .ship
┃ └ .rate
┃
┃ 🤖 BOT
┃ ├ .ping
┃ ├ .alive
┃ ├ .info
┃ └ .owner
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
        ⚡ SPOPO BOT ⚡
`;
// ===============================
// 🔧 FUNCTIONS
// ===============================
function getText(message) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    ""
  );
}
function getMention(message) {
  return (
    message.message?.extendedTextMessage
      ?.contextInfo?.mentionedJid?.[0] || null
  );
}
function hasLink(text) {
  return /(https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\/|instagram\.com\/|facebook\.com\/|youtube\.com\/)/i
    .test(text);
}
function hasBadWord(text) {
  const lower = text.toLowerCase();
  return settings.badWords.some(word =>
    lower.includes(word.toLowerCase())
  );
}
// ===============================
// 👑 ADMIN CHECK
// ===============================
async function isAdmin(sock, group, user) {
  try {
    const metadata = await sock.groupMetadata(group);
    const participant =
      metadata.participants.find(p => p.id === user);
    return (
      participant &&
      (
        participant.admin === "admin" ||
        participant.admin === "superadmin"
      )
    );
  } catch {
    return false;
  }
}
async function isBotAdmin(sock, group) {
  try {
    const bot =
      sock.user?.id?.split(":")[0] +
      "@s.whatsapp.net";
    return await isAdmin(sock, group, bot);
  } catch {
    return false;
  }
}
// ===============================
// ⚠️ WARNING SYSTEM
// ===============================
async function warning(sock, group, user, reason) {
  const key = `${group}:${user}`;
  const current =
    (warnings.get(key) || 0) + 1;
  warnings.set(key, current);
  if (
    current >= settings.maxWarnings &&
    await isBotAdmin(sock, group)
  ) {
    try {
      await sock.groupParticipantsUpdate(
        group,
        [user],
        "remove"
      );
      warnings.delete(key);
      await sock.sendMessage(group, {
        text:
          `🚫 @${user.split("@")[0]} تم طردك.\n\n` +
          `📛 السبب: ${reason}\n` +
          `⚠️ وصلت ${settings.maxWarnings}/${settings.maxWarnings} مخالفات.`,
        mentions: [user]
      });
      return;
    } catch (error) {
      console.log("Kick error:", error.message);
    }
  }
  await sock.sendMessage(group, {
    text:
      `⚠️ تحذير لـ @${user.split("@")[0]}\n\n` +
      `📛 السبب: ${reason}\n` +
      `⚠️ المخالفات: ${current}/${settings.maxWarnings}`,
    mentions: [user]
  });
}
// ===============================
// 🚀 START BOT
// ===============================
async function startBot() {
  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(SESSION);
  const sock = makeWASocket({
    auth: state,
    logger,
    browser: [
      "SPOPO BOT",
      "Chrome",
      "1.0.0"
    ],
    markOnlineOnConnect: false,
    syncFullHistory: false
  });
  sock.ev.on(
    "creds.update",
    saveCreds
  );
  // ===============================
  // 🔐 PAIRING CODE
  // ===============================
  if (!state.creds.registered) {
    await delay(3000);
    try {
      const code =
        await sock.requestPairingCode(
          BOT_NUMBER
        );
      console.log("");
      console.log("================================");
      console.log(" 🔐 SPOPO BOT PAIRING CODE");
      console.log("================================");
      console.log("");
      console.log(" CODE:", code);
      console.log("");
      console.log("WhatsApp > Settings");
      console.log("> Linked Devices");
      console.log("> Link a Device");
      console.log("> Link with phone number");
      console.log("");
      console.log("================================");
    } catch (error) {
      console.log(
        "❌ Pairing error:",
        error.message
      );
    }
  }
  // ===============================
  // 🔌 CONNECTION
  // ===============================
  sock.ev.on(
    "connection.update",
    ({ connection, lastDisconnect }) => {
      if (connection === "open") {
        console.log("");
        console.log("✅ SPOPO BOT CONNECTED");
        console.log("🤖 Bot is online");
        console.log("🛡️ Protection active");
        console.log("");
      }
      if (connection === "close") {
        const code =
          lastDisconnect
            ?.error
            ?.output
            ?.statusCode;
        if (
          code !==
          DisconnectReason.loggedOut
        ) {
          console.log(
            "🔄 Reconnecting..."
          );
          setTimeout(
            startBot,
            3000
          );
        } else {
          console.log(
            "❌ WhatsApp logged out."
          );
        }
      }
    }
  );
  // ===============================
  // 💬 MESSAGES
  // ===============================
  sock.ev.on(
    "messages.upsert",
    async ({ messages }) => {
      const msg = messages?.[0];
      if (!msg?.message) return;
      if (msg.key?.fromMe) return;
      const jid =
        msg.key.remoteJid;
      if (!jid) return;
      const sender =
        msg.key.participant ||
        jid;
      const text =
        getText(msg);
      // ===============================
      // 🛡️ GROUP PROTECTION
      // ===============================
      if (
        jid.endsWith("@g.us") &&
        text
      ) {
        const admin =
          await isAdmin(
            sock,
            jid,
            sender
          );
        // Admins محميين
        if (!admin) {
          // 🔗 Anti Link
          if (
            settings.antiLink &&
            hasLink(text)
          ) {
            try {
              await sock.sendMessage(
                jid,
                {
                  delete: msg.key
                }
              );
            } catch {}
            await warning(
              sock,
              jid,
              sender,
              "🔗 إرسال رابط ممنوع"
            );
            return;
          }
          // 🤬 Anti Bad Words
          if (
            settings.antiBadWord &&
            hasBadWord(text)
          ) {
            try {
              await sock.sendMessage(
                jid,
                {
                  delete: msg.key
                }
              );
            } catch {}
            await warning(
              sock,
              jid,
              sender,
              "🤬 كلمة ممنوعة"
            );
            return;
          }
          // 🚫 Anti Spam
          if (settings.antiSpam) {
            const key =
              `${jid}:${sender}`;
            const now =
              Date.now();
            let times =
              spam.get(key) || [];
            times =
              times.filter(
                t =>
                  now - t <
                  settings.spamTime
              );
            times.push(now);
            spam.set(
              key,
              times
            );
            if (
              times.length >=
              settings.maxSpamMessages
            ) {
              spam.set(
                key,
                []
              );
              await warning(
                sock,
                jid,
                sender,
                "🚫 Spam"
              );
              return;
            }
          }
        }
      }
      // ===============================
      // COMMANDS
      // ===============================
      if (
        !text.startsWith(PREFIX)
      ) return;
      const parts =
        text
          .slice(PREFIX.length)
          .trim()
          .split(/\s+/);
      const command =
        (parts.shift() || "")
          .toLowerCase();
      const args =
        parts.join(" ");
      // ===============================
      // 🎌 MENU
      // ===============================
      if (command === "menu") {
        await sock.sendMessage(
          jid,
          {
            text: MENU
          }
        );
        return;
      }
      // ===============================
      // 🏓 PING
      // ===============================
      if (command === "ping") {
        await sock.sendMessage(
          jid,
          {
            text:
              "🏓 PONG!\n\n" +
              "🤖 SPOPO BOT\n" +
              "🟢 Online"
          }
        );
        return;
      }
      // ===============================
      // 🟢 ALIVE
      // ===============================
      if (command === "alive") {
        await sock.sendMessage(
          jid,
          {
            text:
              "🤖 SPOPO BOT V2\n\n" +
              "🟢 ONLINE\n" +
              "🛡️ Protection: ON\n" +
              "⚡ System: Active"
          }
        );
        return;
      }
      // ===============================
      // 👑 OWNER
      // ===============================
      if (command === "owner") {
        await sock.sendMessage(
          jid,
          {
            text:
              "╭━━〔 👑 OWNER 〕━━╮\n" +
              "┃ SPOPO\n" +
              "┃ 📱 0644140800\n" +
              "╰━━━━━━━━━━━━━━╯"
          }
        );
        return;
      }
      // ===============================
      // ℹ️ INFO
      // ===============================
      if (command === "info") {
        await sock.sendMessage(
          jid,
          {
            text:
              "🤖 SPOPO BOT V2\n\n" +
              "🎌 Anime System\n" +
              "🛡️ Anti-Link\n" +
              "🚫 Anti-Spam\n" +
              "🤬 Anti-Words\n" +
              "👑 Admin System\n" +
              "⚡ Baileys"
          }
        );
        return;
      }
      // ===============================
      // ⚙️ PROTECTION SETTINGS
      // ===============================
      if (
        [
          "antilink",
          "antispam",
          "badword"
        ].includes(command)
      ) {
        if (
          !jid.endsWith("@g.us")
        ) {
          await sock.sendMessage(
            jid,
            {
              text:
                "⚠️ هاد الأمر خاص بالمجموعة."
            }
          );
          return;
        }
        if (
          !await isAdmin(
            sock,
            jid,
            sender
          )
        ) {
          await sock.sendMessage(
            jid,
            {
              text:
                "⛔ غير الأدمن يقدر يبدل الحماية."
            }
          );
          return;
        }
        const value =
          args.toLowerCase();
        const enabled =
          value === "on";
        if (
          command ===
          "antilink"
        )
          settings.antiLink =
            enabled;
        if (
          command ===
          "antispam"
        )
          settings.antiSpam =
            enabled;
        if (
          command ===
          "badword"
        )
          settings.antiBadWord =
            enabled;
        await sock.sendMessage(
          jid,
          {
            text:
              `✅ ${command}\n` +
              `الحالة: ${enabled ? "ON 🟢" : "OFF 🔴"}`
          }
        );
        return;
      }
      // ===============================
      // ⚠️ WARN
      // ===============================
      if (command === "warn") {
        if (
          !jid.endsWith("@g.us")
        ) return;
        if (
          !await isAdmin(
            sock,
            jid,
            sender
          )
        ) {
          await sock.sendMessage(
            jid,
            {
              text:
                "⛔ الأمر للأدمن فقط."
            }
          );
          return;
        }
        const target =
          getMention(msg);
        if (!target) {
          await sock.sendMessage(
            jid,
            {
              text:
                "استعمل:\n.warn @user"
            }
          );
          return;
        }
        await warning(
          sock,
          jid,
          target,
          "⚠️ تحذير من الأدمن"
        );
        return;
      }
      // ===============================
      // 👋 GROUP ADMIN COMMANDS
      // ===============================
      if (
        [
          "kick",
          "ban",
          "promote",
          "demote"
        ].includes(command)
      ) {
        if (
          !jid.endsWith("@g.us")
        ) return;
        if (
          !await isAdmin(
            sock,
            jid,
            sender
          )
        ) {
          await sock.sendMessage(
            jid,
            {
              text:
                "⛔ خاص بالأدمن."
            }
          );
          return;
        }
        const target =
          getMention(msg);
        if (!target) {
          await sock.sendMessage(
            jid,
            {
              text:
                `استعمل:\n.${command} @user`
            }
          );
          return;
        }
        if (
          !await isBotAdmin(
            sock,
            jid
          )
        ) {
          await sock.sendMessage(
            jid,
            {
              text:
                "❌ خاص البوت يكون Admin."
            }
          );
          return;
        }
        let action =
          command === "promote"
            ? "promote"
            : command === "demote"
              ? "demote"
              : "remove";
        try {
          await sock.groupParticipantsUpdate(
            jid,
            [target],
            action
          );
          await sock.sendMessage(
            jid,
            {
              text:
                `✅ تم تنفيذ .${command} على @${target.split("@")[0]}`,
              mentions: [target]
            }
          );
        } catch {
          await sock.sendMessage(
            jid,
            {
              text:
                "❌ ما قدرتش ننفذ الأمر."
            }
          );
        }
        return;
      }
      // ===============================
      // 🎲 FUN
      // ===============================
      if (command === "rate") {
        const n =
          Math.floor(
            Math.random() * 101
          );
        await sock.sendMessage(
          jid,
          {
            text:
              `🎯 النسبة ديالك: ${n}%`
          }
        );
        return;
      }
      if (command === "love") {
        const n =
          Math.floor(
            Math.random() * 101
          );
        await sock.sendMessage(
          jid,
          {
            text:
              `❤️ نسبة الحب: ${n}%`
          }
        );
        return;
      }
      if (command === "ship") {
        const target =
          getMention(msg);
        if (!target) {
          await sock.sendMessage(
            jid,
            {
              text:
                "استعمل:\n.ship @user"
            }
          );
          return;
        }
        const n =
          Math.floor(
            Math.random() * 101
          );
        await sock.sendMessage(
          jid,
          {
            text:
              `💘 @${sender.split("@")[0]} ❤️ @${target.split("@")[0]}\n\n` +
              `💕 النسبة: ${n}%`,
            mentions: [
              sender,
              target
            ]
          }
        );
        return;
      }
      // ===============================
      // 🎌 ANIME
      // ===============================
      if (
        command === "anime" ||
        command === "waifu"
      ) {
        await sock.sendMessage(
          jid,
          {
            text:
              "🎌 Anime System\n\n" +
              "🔥 هاد القسم واجد للتطوير.\n" +
              "غادي نزيدو فيه صور/GIF ديال الأنمي فالمرحلة الجاية."
          }
        );
        return;
      }
    }
  );
}
startBot().catch(
  console.error
);

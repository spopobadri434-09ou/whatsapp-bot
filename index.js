import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  delay
} from "@whiskeysockets/baileys";

import P from "pino";

// ===============================
// ⚙️ CONFIG
// ===============================

const PREFIX = ".";
const BOT_NUMBER = "212644140800";
const SESSION = "./session";

// GIF ديال MENU
const MENU_GIF_URL =
  "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif";

const logger = P({
  level: "silent"
});

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
╭━━━〔 🎌 SPOPO BOT 〕━━━╮
┃
┃ 🤖 BOT
┃ ├ .menu
┃ ├ .ping
┃ ├ .alive
┃ ├ .info
┃ └ .owner
┃
┃ 🛡️ PROTECTION
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
┃ 🎌 ANIME
┃ ├ .anime
┃ └ .waifu
┃
┃ 😂 FUN
┃ ├ .rate
┃ ├ .love
┃ └ .ship @user
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
  return /(https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\/|instagram\.com\/|facebook\.com\/|youtube\.com\/)/i.test(
    text
  );
}

function hasBadWord(text) {
  const lower = text.toLowerCase();

  return settings.badWords.some(word =>
    lower.includes(word.toLowerCase())
  );
}

// ===============================
// 👑 ADMIN
// ===============================

async function isAdmin(sock, group, user) {
  try {
    const metadata = await sock.groupMetadata(group);

    const participant =
      metadata.participants.find(
        p => p.id === user
      );

    return Boolean(
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
    const botId =
      sock.user?.id?.split(":")[0] +
      "@s.whatsapp.net";

    return await isAdmin(
      sock,
      group,
      botId
    );
  } catch {
    return false;
  }
}

// ===============================
// ⚠️ WARNING
// ===============================

async function warning(
  sock,
  group,
  user,
  reason
) {
  const key = `${group}:${user}`;

  const current =
    (warnings.get(key) || 0) + 1;

  warnings.set(key, current);

  // وصل 3 warnings = kick
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

      await sock.sendMessage(
        group,
        {
          text:
            `🚫 @${user.split("@")[0]} تم طردك.\n\n` +
            `📛 السبب: ${reason}\n` +
            `⚠️ المخالفات: ${settings.maxWarnings}/${settings.maxWarnings}`,
          mentions: [user]
        }
      );

      return;
    } catch (error) {
      console.log(
        "❌ Kick error:",
        error?.message || error
      );
    }
  }

  await sock.sendMessage(
    group,
    {
      text:
        `⚠️ تحذير لـ @${user.split("@")[0]}\n\n` +
        `📛 السبب: ${reason}\n` +
        `⚠️ المخالفات: ${current}/${settings.maxWarnings}`,
      mentions: [user]
    }
  );
}

// ===============================
// 🚀 START BOT
// ===============================

async function startBot() {
  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(
    SESSION
  );

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

  // حفظ الجلسة
  sock.ev.on(
    "creds.update",
    saveCreds
  );

  // ===============================
  // 🔐 PAIRING CODE FIX
  // ===============================

  if (!state.creds.registered) {
    let pairingStarted = false;

    sock.ev.on(
      "connection.update",
      async ({
        connection,
        qr
      }) => {

        if (pairingStarted) return;

        if (
          connection === "connecting" ||
          qr
        ) {
          pairingStarted = true;

          try {
            console.log(
              "⏳ WhatsApp connecting..."
            );

            await delay(2500);

            const code =
              await sock.requestPairingCode(
                BOT_NUMBER
              );

            console.log("");
            console.log(
              "================================"
            );
            console.log(
              "🔐 SPOPO BOT PAIRING CODE"
            );
            console.log(
              "================================"
            );
            console.log(
              "📱 CODE:",
              code
            );
            console.log("");
            console.log(
              "WhatsApp > Settings"
            );
            console.log(
              "> Linked Devices"
            );
            console.log(
              "> Link a Device"
            );
            console.log(
              "> Link with phone number"
            );
            console.log(
              "================================"
            );

          } catch (error) {

            pairingStarted = false;

            console.log(
              "❌ Pairing error:",
              error?.message || error
            );
          }
        }
      }
    );
  }

  // ===============================
  // 🔌 CONNECTION
  // ===============================

  sock.ev.on(
    "connection.update",
    async ({
      connection,
      lastDisconnect
    }) => {

      if (connection === "open") {
        console.log("");
        console.log(
          "================================"
        );
        console.log(
          "✅ SPOPO BOT CONNECTED"
        );
        console.log(
          "🤖 Bot is online"
        );
        console.log(
          "🛡️ Protection active"
        );
        console.log(
          "================================"
        );
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
    async ({
      messages
    }) => {

      try {

        const msg =
          messages?.[0];

        if (!msg?.message)
          return;

        if (msg.key?.fromMe)
          return;

        const jid =
          msg.key.remoteJid;

        if (!jid)
          return;

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

          // الأدمن محمي
          if (!admin) {

            // 🔗 ANTI LINK
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

            // 🤬 BAD WORD
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

            // 🚫 SPAM
            if (
              settings.antiSpam
            ) {

              const key =
                `${jid}:${sender}`;

              const now =
                Date.now();

              let times =
                spam.get(key) || [];

              times =
                times.filter(
                  time =>
                    now - time <
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
        // COMMAND CHECK
        // ===============================

        if (
          !text.startsWith(PREFIX)
        )
          return;

        const parts =
          text
            .slice(PREFIX.length)
            .trim()
            .split(/\s+/);

        const command =
          (
            parts.shift() || ""
          ).toLowerCase();

        const args =
          parts.join(" ");

        // ===============================
        // 🎌 MENU + GIF
        // ===============================

        if (
          command === "menu"
        ) {

          try {

            await sock.sendMessage(
              jid,
              {
                video: {
                  url: MENU_GIF_URL
                },
                gifPlayback: true,
                caption: MENU
              }
            );

          } catch {

            await sock.sendMessage(
              jid,
              {
                text: MENU
              }
            );
          }

          return;
        }

        // ===============================
        // 🏓 PING
        // ===============================

        if (
          command === "ping"
        ) {

          const start =
            Date.now();

          await sock.sendMessage(
            jid,
            {
              text:
                "🏓 PONG!\n\n" +
                "🤖 SPOPO BOT\n" +
                "🟢 ONLINE\n" +
                `⚡ ${Date.now() - start}ms`
            }
          );

          return;
        }

        // ===============================
        // 🟢 ALIVE
        // ===============================

        if (
          command === "alive"
        ) {

          await sock.sendMessage(
            jid,
            {
              text:
                "🤖 SPOPO BOT V2\n\n" +
                "🟢 ONLINE\n" +
                "🛡️ Protection: ON\n" +
                "⚡ System: ACTIVE"
            }
          );

          return;
        }

        // ===============================
        // 👑 OWNER
        // ===============================

        if (
          command === "owner"
        ) {

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

        if (
          command === "info"
        ) {

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
        // 🛡️ PROTECTION SETTINGS
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

          if (
            value !== "on" &&
            value !== "off"
          ) {

            await sock.sendMessage(
              jid,
              {
                text:
                  `استعمل:\n.${command} on\n.${command} off`
              }
            );

            return;
          }

          const enabled =
            value === "on";

          if (
            command === "antilink"
          )
            settings.antiLink =
              enabled;

          if (
            command === "antispam"
          )
            settings.antiSpam =
              enabled;

          if (
            command === "badword"
          )
            settings.antiBadWord =
              enabled;

          await sock.sendMessage(
            jid,
            {
              text:
                `✅ ${command}\n` +
                `الحالة: ${
                  enabled
                    ? "ON 🟢"
                    : "OFF 🔴"
                }`
            }
          );

          return;
        }

        // ===============================
        // ⚠️ WARN
        // ===============================

        if (
          command === "warn"
        ) {

          if (
            !jid.endsWith("@g.us")
          )
            return;

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
        // 👑 ADMIN COMMANDS
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
          )
            return;

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

          let action;

          if (
            command === "promote"
          )
            action = "promote";

          else if (
            command === "demote"
          )
            action = "demote";

          else
            action = "remove";

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
        // 🎯 RATE
        // ===============================

        if (
          command === "rate"
        ) {

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

        // ===============================
        // ❤️ LOVE
        // ===============================

        if (
          command === "love"
        ) {

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

        // ===============================
        // 💘 SHIP
        // ===============================

        if (
          command === "ship"
        ) {

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
                "🎌 SPOPO ANIME\n\n" +
                "🔥 Anime System Active!\n" +
                "🎬 استعمل .menu باش تشوف القائمة."
            }
          );

          return;
        }

      } catch (error) {

        console.log(
          "❌ Message error:",
          error?.message || error
        );
      }
    }
  );
}

// ===============================
// ▶️ RUN
// ===============================

startBot().catch(
  error => {
    console.error(
      "❌ BOT ERROR:",
      error
    );
  }
);

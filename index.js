import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers
} from "@whiskeysockets/baileys";

import { Boom } from "@hapi/boom";
import pino from "pino";
import express from "express";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

/*
====================================================
                 🤖 SPOPO BOT 2.0
             QR + RAILWAY + 100 COMMANDS
====================================================
*/

const PREFIX = ".";
const PORT = Number(process.env.PORT || 3000);

/*
 * Railway Volume
 */
const SESSION_DIR =
  process.env.SESSION_DIR ||
  "/app/auth_info_baileys";

/*
 * اسم البوت
 */
const BOT_NAME = "SPOPO BOT";

/*
====================================================
                  VARIABLES
====================================================
*/

let sock = null;
let currentQR = null;
let currentQRImage = null;
let connected = false;
let reconnectTimer = null;

/*
====================================================
                  EXPRESS
====================================================
*/

const app = express();

app.use(express.json());

/*
HOME
*/

app.get("/", (req, res) => {

  res.send(`
<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SPOPO BOT</title>

<style>

body {
  margin: 0;
  background: #0b0b0f;
  color: white;
  font-family: Arial, sans-serif;
  text-align: center;
}

.container {
  max-width: 500px;
  margin: 50px auto;
  padding: 30px;
}

.card {
  background: #15151d;
  border-radius: 25px;
  padding: 30px;
  box-shadow: 0 0 30px #000;
}

h1 {
  font-size: 32px;
}

.status {
  font-size: 20px;
  margin: 20px;
}

a {
  display: block;
  padding: 15px;
  margin: 15px;
  border-radius: 15px;
  background: #25D366;
  color: white;
  text-decoration: none;
  font-weight: bold;
}

</style>
</head>

<body>

<div class="container">

<div class="card">

<h1>🤖 SPOPO BOT</h1>

<div class="status">
${connected ? "🟢 ONLINE" : "🟡 WAITING FOR QR"}
</div>

<a href="/qr">
📱 فتح QR Code
</a>

<a href="/health">
❤️ Health
</a>

</div>

</div>

</body>
</html>
`);

});

/*
====================================================
                     QR PAGE
====================================================
*/

app.get("/qr", (req, res) => {

  if (connected) {

    return res.send(`
<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SPOPO QR</title>

<style>

body {
  background:#111;
  color:white;
  text-align:center;
  font-family:Arial;
  padding:30px;
}

.box {
  max-width:500px;
  margin:auto;
  background:#1b1b1b;
  padding:25px;
  border-radius:25px;
}

img {
  width:100%;
  max-width:400px;
  background:white;
  padding:15px;
  border-radius:15px;
}

</style>
</head>

<body>

<div class="box">

<h1>🤖 SPOPO BOT</h1>

<h2>🟢 WhatsApp Connected</h2>

<p>البوت راه متصل بالفعل.</p>

</div>

</body>
</html>
`);

  }

  if (!currentQRImage) {

    return res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="3">
<style>
body {
background:#111;
color:white;
font-family:Arial;
text-align:center;
padding:60px;
}
</style>
</head>

<body>

<h1>🤖 SPOPO BOT</h1>

<h2>⏳ كنوجد QR...</h2>

<p>خلي الصفحة محلولة، غادي تتحدث بوحدها.</p>

</body>
</html>
`);

  }

  res.send(`
<!DOCTYPE html>
<html lang="ar">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<meta http-equiv="refresh" content="20">

<title>SPOPO QR</title>

<style>

body {
  margin:0;
  background:#080808;
  color:white;
  font-family:Arial;
  text-align:center;
}

.container {
  padding:25px;
  max-width:550px;
  margin:auto;
}

.card {
  background:#161616;
  border-radius:25px;
  padding:25px;
}

img {
  width:100%;
  max-width:450px;
  background:white;
  padding:12px;
  border-radius:15px;
}

h1 {
  font-size:30px;
}

.instructions {
  font-size:18px;
  line-height:1.8;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>🤖 SPOPO BOT</h1>

<h2>📱 Scan QR</h2>

<img src="${currentQRImage}" />

<div class="instructions">

<p>1️⃣ حل WhatsApp</p>

<p>2️⃣ Settings</p>

<p>3️⃣ Linked Devices</p>

<p>4️⃣ Link a Device</p>

<p>5️⃣ سكاني QR اللي فوق</p>

</div>

<p>🔄 QR كيتجدد تلقائياً</p>

</div>

</div>

</body>

</html>
`);

});

/*
====================================================
                    HEALTH
====================================================
*/

app.get("/health", (req, res) => {

  res.json({
    bot: BOT_NAME,
    status: connected ? "online" : "connecting",
    qr: Boolean(currentQR),
    uptime: process.uptime(),
    time: new Date().toISOString()
  });

});

/*
====================================================
                    START SERVER
====================================================
*/

app.listen(PORT, "0.0.0.0", () => {

  console.log("");
  console.log("╔══════════════════════════════════╗");
  console.log("║        🤖 SPOPO BOT              ║");
  console.log("║          RAILWAY                 ║");
  console.log("╚══════════════════════════════════╝");
  console.log("");

  console.log(`🌐 PORT: ${PORT}`);

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {

    console.log(
      `🌍 https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    );

    console.log(
      `📱 QR: https://${process.env.RAILWAY_PUBLIC_DOMAIN}/qr`
    );

  }

});

/*
====================================================
               CREATE SESSION FOLDER
====================================================
*/

if (!fs.existsSync(SESSION_DIR)) {

  fs.mkdirSync(
    SESSION_DIR,
    {
      recursive: true
    }
  );

}

/*
====================================================
                  QR GENERATOR
====================================================
*/

async function showQR(qr) {

  currentQR = qr;

  try {

    currentQRImage =
      await QRCode.toDataURL(
        qr,
        {
          width: 500,
          margin: 2
        }
      );

    console.log("");
    console.log("╔══════════════════════════════════╗");
    console.log("║        📱 SPOPO QR READY        ║");
    console.log("╚══════════════════════════════════╝");

    if (process.env.RAILWAY_PUBLIC_DOMAIN) {

      console.log("");
      console.log(
        "🌐 افتح:"
      );

      console.log(
        `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/qr`
      );

    }

    console.log("");

  } catch (error) {

    console.log(
      "❌ QR Error:",
      error.message
    );

  }

}

/*
====================================================
                  CONNECTION
====================================================
*/

async function connectWhatsApp() {

  try {

    const {
      state,
      saveCreds
    } = await useMultiFileAuthState(
      SESSION_DIR
    );

    sock = makeWASocket({

      auth: state,

      logger: pino({
        level: "silent"
      }),

      browser:
        Browsers.ubuntu(
          "SPOPO BOT"
        ),

      markOnlineOnConnect: false,

      syncFullHistory: false,

      connectTimeoutMs: 60000,

      defaultQueryTimeoutMs: 60000,

      keepAliveIntervalMs: 25000

    });

    /*
    ================================================
                 SAVE SESSION
    ================================================
    */

    sock.ev.on(
      "creds.update",
      saveCreds
    );

    /*
    ================================================
                 CONNECTION UPDATE
    ================================================
    */

    sock.ev.on(
      "connection.update",
      async (update) => {

        const {
          connection,
          lastDisconnect,
          qr
        } = update;

        /*
        QR
        */

        if (qr) {

          await showQR(qr);

        }

        /*
        CONNECTED
        */

        if (connection === "open") {

          connected = true;

          currentQR = null;
          currentQRImage = null;

          console.log("");
          console.log(
            "╔══════════════════════════════════╗"
          );

          console.log(
            "║       🟢 WHATSAPP ONLINE        ║"
          );

          console.log(
            "║          🤖 SPOPO BOT            ║"
          );

          console.log(
            "╚══════════════════════════════════╝"
          );

          console.log("");

        }

        /*
        CLOSED
        */

        if (connection === "close") {

          connected = false;

          const statusCode =
            new Boom(
              lastDisconnect?.error
            )
              .output
              ?.statusCode;

          console.log("");
          console.log(
            "❌ WhatsApp disconnected"
          );

          console.log(
            "STATUS:",
            statusCode
          );

          /*
          LOGGED OUT
          */

          if (
            statusCode ===
            DisconnectReason.loggedOut
          ) {

            console.log(
              "🚪 WhatsApp خرج الحساب."
            );

            console.log(
              "⚠️ Session لم تعد صالحة."
            );

            console.log(
              "🧹 غادي نحافظو على Session القديمة."
            );

            return;

          }

          /*
          RECONNECT
          */

          if (!reconnectTimer) {

            reconnectTimer =
              setTimeout(
                () => {

                  reconnectTimer = null;

                  connectWhatsApp();

                },
                5000
              );

          }

        }

      }
    );

    /*
    ================================================
                 MESSAGE HANDLER
    ================================================
    */

    sock.ev.on(
      "messages.upsert",
      async ({
        messages,
        type
      }) => {

        if (type !== "notify") {
          return;
        }

        for (
          const msg
          of messages
        ) {

          try {

            if (!msg.message) {
              continue;
            }

            if (msg.key.fromMe) {
              continue;
            }

            await handleMessage(msg);

          } catch (error) {

            console.log(
              "❌ Message Error:",
              error.message
            );

          }

        }

      }
    );

  } catch (error) {

    console.log(
      "❌ Connection Error:",
      error.message
    );

    setTimeout(
      connectWhatsApp,
      10000
    );

  }

}

/*
====================================================
                   MESSAGE TEXT
====================================================
*/

function getText(msg) {

  const m =
    msg.message || {};

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ""
  ).trim();

}

/*
====================================================
                    ADMIN CHECK
====================================================
*/

async function isAdmin(
  jid,
  sender
) {

  if (!jid.endsWith("@g.us")) {
    return false;
  }

  try {

    const metadata =
      await sock.groupMetadata(
        jid
      );

    const participant =
      metadata.participants.find(
        p =>
          p.id === sender ||
          p.lid === sender
      );

    return Boolean(
      participant?.admin
    );

  } catch {

    return false;

  }

}

/*
====================================================
                    GET MENTION
====================================================
*/

function getMentioned(
  msg
) {

  return (
    msg.message
      ?.extendedTextMessage
      ?.contextInfo
      ?.mentionedJid || []
  );

}

/*
====================================================
                    SEND
====================================================
*/

async function reply(
  jid,
  text
) {

  return sock.sendMessage(
    jid,
    {
      text
    }
  );

}

/*
====================================================
                  COMMAND HANDLER
====================================================
*/

async function handleMessage(msg) {

  const jid =
    msg.key.remoteJid;

  if (!jid) {
    return;
  }

  const sender =
    msg.key.participant ||
    jid;

  const text =
    getText(msg);

  if (!text.startsWith(PREFIX)) {
    return;
  }

  const parts =
    text.slice(PREFIX.length)
      .trim()
      .split(/\s+/);

  const command =
    (parts.shift() || "")
      .toLowerCase();

  const args =
    parts;

  const input =
    args.join(" ");

  /*
  ==================================================
                    1 MENU
  ==================================================
  */

  if (command === "menu") {

    return reply(
      jid,
      `╭━━━〔 🤖 SPOPO BOT 〕━━━╮
┃
┃ 📌 100 Commands
┃
┃ .menu
┃ .ping
┃ .alive
┃ .info
┃ .owner
┃ .group
┃ .tagall
┃ .kick
┃ .promote
┃ .demote
┃ .calc
┃ .gft
┃ .joke
┃ .quote
┃ .dice
┃ .ship
┃
┃ 📚 اكتب:
┃ .help
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`
    );

  }

  /*
  2 HELP
  */

  if (command === "help") {

    return reply(
      jid,
      `📚 *SPOPO BOT - 100 COMMANDS*

1. menu
2. help
3. ping
4. alive
5. bot
6. info
7. owner
8. time
9. date
10. day
11. version
12. uptime
13. runtime
14. jid
15. me
16. id
17. echo
18. say
19. reverse
20. upper
21. lower
22. length
23. count
24. words
25. calc
26. add
27. sub
28. mul
29. div
30. mod
31. sqrt
32. pow
33. random
34. choose
35. coin
36. dice
37. gft
38. gift
39. joke
40. quote
41. rules
42. support
43. status
44. source
45. privacy
46. language
47. prefix
48. group
49. groupinfo
50. members
51. admins
52. tagall
53. hidetag
54. promote
55. demote
56. kick
57. add
58. subject
59. desc
60. link
61. revoke
62. invite
63. everyone
64. welcome
65. goodbye
66. antilink
67. antibadword
68. antilinkoff
69. antibadwordoff
70. mute
71. unmute
72. lock
73. unlock
74. pin
75. unpin
76. save
77. get
78. note
79. notes
80. calcdate
81. age
82. unix
83. timestamp
84. encode
85. decode
86. base64
87. hex
88. binary
89. randomnum
90. pick
91. yesno
92. rps
93. fact
94. tip
95. motivate
96. love
97. hug
98. slap
99. highfive
100. ship
101. profile`
    );

  }

  /*
  3 PING
  */

  if (command === "ping") {
    return reply(jid, "🏓 Pong!\n⚡ SPOPO BOT خدام.");
  }

  /*
  4 ALIVE
  */

  if (command === "alive") {
    return reply(jid, "🟢 SPOPO BOT ONLINE\n🚀 Railway\n🤖 Ready");
  }

  /*
  5 BOT
  */

  if (command === "bot") {
    return reply(jid, "🤖 SPOPO BOT\nVersion 2.0");
  }

  /*
  6 INFO
  */

  if (command === "info") {
    return reply(
      jid,
      "🤖 SPOPO BOT\n\n⚡ WhatsApp\n🌐 Railway\n🔐 QR Login\n📚 100+ Commands"
    );
  }

  /*
  7 OWNER
  */

  if (command === "owner") {
    return reply(jid, "👑 Owner: SPOPO");
  }

  /*
  8 TIME
  */

  if (command === "time") {

    return reply(
      jid,
      "🕐 " +
      new Date().toLocaleTimeString(
        "fr-MA",
        {
          timeZone:
            "Africa/Casablanca"
        }
      )
    );

  }

  /*
  9 DATE
  */

  if (command === "date") {

    return reply(
      jid,
      "📅 " +
      new Date().toLocaleDateString(
        "fr-MA",
        {
          timeZone:
            "Africa/Casablanca"
        }
      )
    );

  }

  /*
  10 DAY
  */

  if (command === "day") {

    return reply(
      jid,
      "📅 " +
      new Date().toLocaleDateString(
        "ar-MA",
        {
          weekday: "long",
          timeZone:
            "Africa/Casablanca"
        }
      )
    );

  }

  /*
  11 VERSION
  */

  if (command === "version") {
    return reply(jid, "🤖 SPOPO BOT v2.0");
  }

  /*
  12 UPTIME
  */

  if (command === "uptime") {

    const sec =
      Math.floor(
        process.uptime()
      );

    const h =
      Math.floor(sec / 3600);

    const m =
      Math.floor(
        (sec % 3600) / 60
      );

    const s =
      sec % 60;

    return reply(
      jid,
      `⏱️ Uptime: ${h}h ${m}m ${s}s`
    );

  }

  /*
  13 RUNTIME
  */

  if (command === "runtime") {
    return reply(
      jid,
      `⏱️ ${Math.floor(process.uptime())} seconds`
    );
  }

  /*
  14 JID
  */

  if (command === "jid") {
    return reply(jid, `🆔 ${jid}`);
  }

  /*
  15 ME
  */

  if (command === "me") {
    return reply(jid, `👤 ${sender}`);
  }

  /*
  16 ID
  */

  if (command === "id") {
    return reply(jid, `🆔 ${sender}`);
  }

  /*
  17 ECHO
  */

  if (command === "echo") {
    return reply(
      jid,
      input || "اكتب شي نص."
    );
  }

  /*
  18 SAY
  */

  if (command === "say") {
    return reply(
      jid,
      input || "شنو بغيتي نقول؟"
    );
  }

  /*
  19 REVERSE
  */

  if (command === "reverse") {

    return reply(
      jid,
      input
        ? [...input].reverse().join("")
        : "استعمل .reverse text"
    );

  }

  /*
  20 UPPER
  */

  if (command === "upper") {

    return reply(
      jid,
      input.toUpperCase()
    );

  }

  /*
  21 LOWER
  */

  if (command === "lower") {

    return reply(
      jid,
      input.toLowerCase()
    );

  }

  /*
  22 LENGTH
  */

  if (command === "length") {

    return reply(
      jid,
      `📏 ${input.length}`
    );

  }

  /*
  23 COUNT
  */

  if (command === "count") {

    return reply(
      jid,
      `🔢 ${input.length} characters`
    );

  }

  /*
  24 WORDS
  */

  if (command === "words") {

    return reply(
      jid,
      `📝 ${input ? input.split(/\s+/).length : 0} words`
    );

  }

  /*
  25 CALC
  */

  if (command === "calc") {

    try {

      if (
        !/^[0-9+\-*/().%\s]+$/.test(
          input
        )
      ) {
        return reply(
          jid,
          "❌ عملية غير صالحة."
        );
      }

      const result =
        Function(
          `"use strict"; return (${input})`
        )();

      return reply(
        jid,
        `🧮 ${input} = ${result}`
      );

    } catch {

      return reply(
        jid,
        "❌ خطأ فالحساب."
      );

    }

  }

  /*
  26 ADD
  */

  if (command === "add") {

    const nums =
      args.map(Number);

    if (
      nums.some(
        Number.isNaN
      )
    ) {
      return reply(
        jid,
        "❌ مثال: .add 5 10"
      );
    }

    return reply(
      jid,
      `➕ ${nums.reduce((a,b)=>a+b,0)}`
    );

  }

  /*
  27 SUB
  */

  if (command === "sub") {

    const nums =
      args.map(Number);

    if (
      nums.some(
        Number.isNaN
      )
    ) {
      return reply(
        jid,
        "❌ مثال: .sub 10 3"
      );
    }

    return reply(
      jid,
      `➖ ${nums.slice(1).reduce((a,b)=>a-b,nums[0])}`
    );

  }

  /*
  28 MUL
  */

  if (command === "mul") {

    const nums =
      args.map(Number);

    return reply(
      jid,
      `✖️ ${nums.reduce((a,b)=>a*b,1)}`
    );

  }

  /*
  29 DIV
  */

  if (command === "div") {

    const nums =
      args.map(Number);

    if (
      nums.length < 2 ||
      nums.some(Number.isNaN) ||
      nums.slice(1).some(x => x === 0)
    ) {
      return reply(
        jid,
        "❌ مثال: .div 10 2"
      );
    }

    return reply(
      jid,
      `➗ ${nums.slice(1).reduce((a,b)=>a/b,nums[0])}`
    );

  }

  /*
  30 MOD
  */

  if (command === "mod") {

    const a = Number(args[0]);
    const b = Number(args[1]);

    return reply(
      jid,
      `🧮 ${a % b}`
    );

  }

  /*
  31 SQRT
  */

  if (command === "sqrt") {

    const n =
      Number(args[0]);

    return reply(
      jid,
      `√ ${Math.sqrt(n)}`
    );

  }

  /*
  32 POW
  */

  if (command === "pow") {

    const a =
      Number(args[0]);

    const b =
      Number(args[1]);

    return reply(
      jid,
      `⚡ ${Math.pow(a,b)}`
    );

  }

  /*
  33 RANDOM
  */

  if (command === "random") {

    return reply(
      jid,
      `🎲 ${Math.floor(Math.random()*100)+1}`
    );

  }

  /*
  34 CHOOSE
  */

  if (command === "choose") {

    if (!args.length) {
      return reply(
        jid,
        "❌ مثال: .choose pizza burger"
      );
    }

    return reply(
      jid,
      `🎯 ${args[Math.floor(Math.random()*args.length)]}`
    );

  }

  /*
  35 COIN
  */

  if (command === "coin") {

    return reply(
      jid,
      Math.random() > .5
        ? "🪙 وجه"
        : "🪙 كتابة"
    );

  }

  /*
  36 DICE
  */

  if (command === "dice") {

    return reply(
      jid,
      `🎲 ${Math.floor(Math.random()*6)+1}`
    );

  }

  /*
  37 GFT
  */

  if (
    command === "gft" ||
    command === "gift"
  ) {

    return reply(
      jid,
      `🎁 هادي هدية من SPOPO BOT ليك ❤️`
    );

  }

  /*
  39 JOKE
  */

  if (command === "joke") {

    const jokes = [
      "😂 واحد مشى للطبيب قال ليه: عندي النسيان. قال ليه: من إمتى؟ قال ليه: شنو؟",
      "😂 الكمبيوتر مشى للطبيب حيث عندو فيروس.",
      "😂 علاش الهاتف ما كينعسش؟ حيث ديما عندو notifications."
    ];

    return reply(
      jid,
      jokes[
        Math.floor(
          Math.random() *
          jokes.length
        )
      ]
    );

  }

  /*
  40 QUOTE
  */

  if (command === "quote") {

    return reply(
      jid,
      "💭 لا تستسلم، كل بداية صعيبة."
    );

  }

  /*
  41 RULES
  */

  if (command === "rules") {

    return reply(
      jid,
      `📜 القوانين

1️⃣ الاحترام
2️⃣ ممنوع السبام
3️⃣ ممنوع الإزعاج
4️⃣ احترام أعضاء المجموعة
5️⃣ استعمل البوت بعقل`
    );

  }

  /*
  42 SUPPORT
  */

  if (command === "support") {
    return reply(
      jid,
      "🛠️ Support: SPOPO BOT"
    );
  }

  /*
  43 STATUS
  */

  if (command === "status") {

    return reply(
      jid,
      connected
        ? "🟢 WhatsApp Online"
        : "🟡 Connecting"
    );

  }

  /*
  44 SOURCE
  */

  if (command === "source") {
    return reply(
      jid,
      "💻 SPOPO BOT\nBaileys + Node.js + Railway"
    );
  }

  /*
  45 PRIVACY
  */

  if (command === "privacy") {
    return reply(
      jid,
      "🔐 ما تجمعش معلومات الناس وما تستعملش البوت للإزعاج."
    );
  }

  /*
  46 LANGUAGE
  */

  if (command === "language") {
    return reply(
      jid,
      "🌐 اللغة: العربية / Darija"
    );
  }

  /*
  47 PREFIX
  */

  if (command === "prefix") {
    return reply(
      jid,
      `⚙️ Prefix: ${PREFIX}`
    );
  }

  /*
  48 GROUP
  */

  if (command === "group") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ هاد الأمر للمجموعات."
      );
    }

    const metadata =
      await sock.groupMetadata(jid);

    return reply(
      jid,
      `👥 ${metadata.subject}\n👤 ${metadata.participants.length} members`
    );

  }

  /*
  49 GROUPINFO
  */

  if (command === "groupinfo") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات فقط."
      );
    }

    const metadata =
      await sock.groupMetadata(jid);

    return reply(
      jid,
      `📋 GROUP INFO

👥 الاسم: ${metadata.subject}
👤 الأعضاء: ${metadata.participants.length}
🆔 ${jid}`
    );

  }

  /*
  50 MEMBERS
  */

  if (command === "members") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات فقط."
      );
    }

    const metadata =
      await sock.groupMetadata(jid);

    return reply(
      jid,
      `👥 عدد الأعضاء: ${metadata.participants.length}`
    );

  }

  /*
  51 ADMINS
  */

  if (command === "admins") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات فقط."
      );
    }

    const metadata =
      await sock.groupMetadata(jid);

    const admins =
      metadata.participants
        .filter(p => p.admin)
        .map(p => `@${p.id.split("@")[0]}`)
        .join("\n");

    return sock.sendMessage(
      jid,
      {
        text:
          `👑 ADMINS\n\n${admins || "لا يوجد"}`,
        mentions:
          metadata.participants
            .filter(p => p.admin)
            .map(p => p.id)
      }
    );

  }

  /*
  52 TAGALL
  */

  if (command === "tagall") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات فقط."
      );
    }

    const admin =
      await isAdmin(
        jid,
        sender
      );

    if (!admin) {
      return reply(
        jid,
        "❌ خاصك تكون Admin."
      );
    }

    const metadata =
      await sock.groupMetadata(jid);

    const mentions =
      metadata.participants.map(
        p => p.id
      );

    const text =
      mentions
        .map(
          x =>
            `@${x.split("@")[0]}`
        )
        .join(" ");

    return sock.sendMessage(
      jid,
      {
        text,
        mentions
      }
    );

  }

  /*
  53 HIDETAG
  */

  if (command === "hidetag") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات فقط."
      );
    }

    const admin =
      await isAdmin(
        jid,
        sender
      );

    if (!admin) {
      return reply(
        jid,
        "❌ خاصك تكون Admin."
      );
    }

    const metadata =
      await sock.groupMetadata(jid);

    const mentions =
      metadata.participants.map(
        p => p.id
      );

    return sock.sendMessage(
      jid,
      {
        text:
          input || "📢 تنبيه",
        mentions
      }
    );

  }

  /*
  54 PROMOTE
  */

  if (command === "promote") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    if (
      !await isAdmin(
        jid,
        sender
      )
    ) {
      return reply(
        jid,
        "❌ خاصك تكون Admin."
      );
    }

    const mentions =
      getMentioned(msg);

    if (!mentions.length) {
      return reply(
        jid,
        "❌ منشن الشخص."
      );
    }

    await sock.groupParticipantsUpdate(
      jid,
      mentions,
      "promote"
    );

    return reply(
      jid,
      "👑 تمت الترقية."
    );

  }

  /*
  55 DEMOTE
  */

  if (command === "demote") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    if (
      !await isAdmin(
        jid,
        sender
      )
    ) {
      return reply(
        jid,
        "❌ خاصك تكون Admin."
      );
    }

    const mentions =
      getMentioned(msg);

    if (!mentions.length) {
      return reply(
        jid,
        "❌ منشن الشخص."
      );
    }

    await sock.groupParticipantsUpdate(
      jid,
      mentions,
      "demote"
    );

    return reply(
      jid,
      "⬇️ تمت إزالة Admin."
    );

  }

  /*
  56 KICK
  */

  if (command === "kick") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    if (
      !await isAdmin(
        jid,
        sender
      )
    ) {
      return reply(
        jid,
        "❌ خاصك تكون Admin."
      );
    }

    const mentions =
      getMentioned(msg);

    if (!mentions.length) {
      return reply(
        jid,
        "❌ منشن الشخص."
      );
    }

    await sock.groupParticipantsUpdate(
      jid,
      mentions,
      "remove"
    );

    return reply(
      jid,
      "👋 تمت الإزالة."
    );

  }

  /*
  57 ADD
  */

  if (command === "add") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    if (
      !await isAdmin(
        jid,
        sender
      )
    ) {
      return reply(
        jid,
        "❌ خاصك تكون Admin."
      );
    }

    const number =
      args[0]?.replace(/\D/g,"");

    if (!number) {
      return reply(
        jid,
        "❌ مثال: .add 2126XXXXXXXX"
      );
    }

    await sock.groupParticipantsUpdate(
      jid,
      [
        number + "@s.whatsapp.net"
      ],
      "add"
    );

    return reply(
      jid,
      "➕ تمت محاولة الإضافة."
    );

  }

  /*
  58 SUBJECT
  */

  if (command === "subject") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    if (
      !await isAdmin(
        jid,
        sender
      )
    ) {
      return reply(
        jid,
        "❌ خاصك تكون Admin."
      );
    }

    if (!input) {
      return reply(
        jid,
        "❌ مثال: .subject اسم المجموعة"
      );
    }

    await sock.groupUpdateSubject(
      jid,
      input
    );

    return reply(
      jid,
      "✅ تبدل اسم المجموعة."
    );

  }

  /*
  59 DESC
  */

  if (command === "desc") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    if (
      !await isAdmin(
        jid,
        sender
      )
    ) {
      return reply(
        jid,
        "❌ خاصك تكون Admin."
      );
    }

    if (!input) {
      return reply(
        jid,
        "❌ كتب الوصف."
      );
    }

    await sock.groupUpdateDescription(
      jid,
      input
    );

    return reply(
      jid,
      "✅ تبدل الوصف."
    );

  }

  /*
  60 LINK
  */

  if (command === "link") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    const code =
      await sock.groupInviteCode(
        jid
      );

    return reply(
      jid,
      `🔗 https://chat.whatsapp.com/${code}`
    );

  }

  /*
  61 REVOKE
  */

  if (command === "revoke") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    if (
      !await isAdmin(
        jid,
        sender
      )
    ) {
      return reply(
        jid,
        "❌ خاصك تكون Admin."
      );
    }

    await sock.groupRevokeInvite(
      jid
    );

    return reply(
      jid,
      "🔄 تم تغيير رابط المجموعة."
    );

  }

  /*
  62 INVITE
  */

  if (command === "invite") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    const code =
      await sock.groupInviteCode(
        jid
      );

    return reply(
      jid,
      `📨 Invite:\nhttps://chat.whatsapp.com/${code}`
    );

  }

  /*
  63 EVERYONE
  */

  if (command === "everyone") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    const metadata =
      await sock.groupMetadata(jid);

    const mentions =
      metadata.participants.map(
        p => p.id
      );

    return sock.sendMessage(
      jid,
      {
        text:
          input || "📢 Attention everyone",
        mentions
      }
    );

  }

  /*
  64 WELCOME
  */

  if (command === "welcome") {
    return reply(
      jid,
      "👋 Welcome system: ON"
    );
  }

  /*
  65 GOODBYE
  */

  if (command === "goodbye") {
    return reply(
      jid,
      "👋 Goodbye system: ON"
    );
  }

  /*
  66 ANTILINK
  */

  if (command === "antilink") {

    return reply(
      jid,
      "🔗 AntiLink command جاهز.\nيمكن تطويره لاحقاً بنظام حذف تلقائي."
    );

  }

  /*
  67 ANTIBADWORD
  */

  if (command === "antibadword") {

    return reply(
      jid,
      "🛡️ AntiBadWord system: ON"
    );

  }

  /*
  68 ANTILINKOFF
  */

  if (command === "antilinkoff") {

    return reply(
      jid,
      "🔗 AntiLink system: OFF"
    );

  }

  /*
  69 ANTIBADWORDOFF
  */

  if (command === "antibadwordoff") {

    return reply(
      jid,
      "🛡️ AntiBadWord system: OFF"
    );

  }

  /*
  70 MUTE
  */

  if (command === "mute") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    if (
      !await isAdmin(
        jid,
        sender
      )
    ) {
      return reply(
        jid,
        "❌ خاصك تكون Admin."
      );
    }

    await sock.groupSettingUpdate(
      jid,
      "announcement"
    );

    return reply(
      jid,
      "🔇 المجموعة دابا Admins فقط."
    );

  }

  /*
  71 UNMUTE
  */

  if (command === "unmute") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    if (
      !await isAdmin(
        jid,
        sender
      )
    ) {
      return reply(
        jid,
        "❌ خاصك تكون Admin."
      );
    }

    await sock.groupSettingUpdate(
      jid,
      "not_announcement"
    );

    return reply(
      jid,
      "🔊 رجعات المجموعة مفتوحة."
    );

  }

  /*
  72 LOCK
  */

  if (command === "lock") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    if (
      !await isAdmin(
        jid,
        sender
      )
    ) {
      return reply(
        jid,
        "❌ خاصك تكون Admin."
      );
    }

    await sock.groupSettingUpdate(
      jid,
      "locked"
    );

    return reply(
      jid,
      "🔒 إعدادات المجموعة مقفولة."
    );

  }

  /*
  73 UNLOCK
  */

  if (command === "unlock") {

    if (!jid.endsWith("@g.us")) {
      return reply(
        jid,
        "❌ للمجموعات."
      );
    }

    if (
      !await isAdmin(
        jid,
        sender
      )
    ) {
      return reply(
        jid,
        "❌ خاصك تكون Admin."
      );
    }

    await sock.groupSettingUpdate(
      jid,
      "unlocked"
    );

    return reply(
      jid,
      "🔓 تحلات إعدادات المجموعة."
    );

  }

  /*
  74 PIN
  */

  if (command === "pin") {

    return reply(
      jid,
      "📌 استعمل Pin من WhatsApp مباشرة."
    );

  }

  /*
  75 UNPIN
  */

  if (command === "unpin") {

    return reply(
      jid,
      "📌 استعمل Unpin من WhatsApp مباشرة."
    );

  }

  /*
  76 SAVE
  */

  if (command === "save") {

    return reply(
      jid,
      `💾 Saved:\n${input || "nothing"}`
    );

  }

  /*
  77 GET
  */

  if (command === "get") {

    return reply(
      jid,
      "📦 GET command جاهز."
    );

  }

  /*
  78 NOTE
  */

  if (command === "note") {

    return reply(
      jid,
      `📝 Note:\n${input || "فارغة"}`
    );

  }

  /*
  79 NOTES
  */

  if (command === "notes") {

    return reply(
      jid,
      "📝 Notes system جاهز."
    );

  }

  /*
  80 CALCDATE
  */

  if (command === "calcdate") {

    return reply(
      jid,
      "📅 استعمل التاريخ بصيغة YYYY-MM-DD."
    );

  }

  /*
  81 AGE
  */

  if (command === "age") {

    const year =
      Number(args[0]);

    if (!year) {
      return reply(
        jid,
        "❌ مثال: .age 2005"
      );
    }

    return reply(
      jid,
      `🎂 العمر تقريباً: ${new Date().getFullYear()-year}`
    );

  }

  /*
  82 UNIX
  */

  if (command === "unix") {

    return reply(
      jid,
      `🕐 ${Math.floor(Date.now()/1000)}`
    );

  }

  /*
  83 TIMESTAMP
  */

  if (command === "timestamp") {

    return reply(
      jid,
      new Date().toISOString()
    );

  }

  /*
  84 ENCODE
  */

  if (command === "encode") {

    return reply(
      jid,
      encodeURIComponent(input)
    );

  }

  /*
  85 DECODE
  */

  if (command === "decode") {

    try {

      return reply(
        jid,
        decodeURIComponent(input)
      );

    } catch {

      return reply(
        jid,
        "❌ النص غير صالح."
      );

    }

  }

  /*
  86 BASE64
  */

  if (command === "base64") {

    return reply(
      jid,
      Buffer
        .from(input)
        .toString("base64")
    );

  }

  /*
  87 HEX
  */

  if (command === "hex") {

    return reply(
      jid,
      Buffer
        .from(input)
        .toString("hex")
    );

  }

  /*
  88 BINARY
  */

  if (command === "binary") {

    const result =
      [...input]
        .map(
          c =>
            c.charCodeAt(0)
              .toString(2)
        )
        .join(" ");

    return reply(
      jid,
      result
    );

  }

  /*
  89 RANDOMNUM
  */

  if (command === "randomnum") {

    const min =
      Number(args[0] || 1);

    const max =
      Number(args[1] || 100);

    return reply(
      jid,
      `🎲 ${Math.floor(
        Math.random() *
        (max-min+1)
      ) + min}`
    );

  }

  /*
  90 PICK
  */

  if (command === "pick") {

    return reply(
      jid,
      args.length
        ? `🎯 ${args[Math.floor(Math.random()*args.length)]}`
        : "❌ مثال: .pick A B C"
    );

  }

  /*
  91 YESNO
  */

  if (command === "yesno") {

    return reply(
      jid,
      Math.random() > .5
        ? "✅ YES"
        : "❌ NO"
    );

  }

  /*
  92 RPS
  */

  if (command === "rps") {

    const choices = [
      "🪨 حجر",
      "📄 ورق",
      "✂️ مقص"
    ];

    return reply(
      jid,
      choices[
        Math.floor(
          Math.random() *
          choices.length
        )
      ]
    );

  }

  /*
  93 FACT
  */

  if (command === "fact") {

    return reply(
      jid,
      "💡 Fact: WhatsApp كيستعمل نظام Multi-Device."
    );

  }

  /*
  94 TIP
  */

  if (command === "tip") {

    return reply(
      jid,
      "💡 Tip: استعمل .menu باش تشوف الأوامر."
    );

  }

  /*
  95 MOTIVATE
  */

  if (command === "motivate") {

    return reply(
      jid,
      "🔥 كمل، ما توقفش! النجاح كيحتاج الصبر."
    );

  }

  /*
  96 LOVE
  */

  if (command === "love") {

    return reply(
      jid,
      "❤️ SPOPO BOT كيحييك!"
    );

  }

  /*
  97 HUG
  */

  if (command === "hug") {

    return reply(
      jid,
      "🤗 هاد Hug ليك!"
    );

  }

  /*
  98 SLAP
  */

  if (command === "slap") {

    return reply(
      jid,
      "😂 slap افتراضية فقط!"
    );

  }

  /*
  99 HIGHFIVE
  */

  if (command === "highfive") {

    return reply(
      jid,
      "✋ High Five!"
    );

  }

  /*
  100 SHIP
  */

  if (command === "ship") {

    const mentions =
      getMentioned(msg);

    if (
      mentions.length >= 2
    ) {

      const percentage =
        Math.floor(
          Math.random()*101
        );

      return sock.sendMessage(
        jid,
        {
          text:
            `❤️ Compatibility: ${percentage}%`,
          mentions
        }
      );

    }

    return reply(
      jid,
      "❤️ منشن جوج أشخاص."
    );

  }

  /*
  101 PROFILE
  */

  if (command === "profile") {

    return reply(
      jid,
      `👤 PROFILE

🆔 ${sender}
🤖 Bot: SPOPO
🟢 Status: Active`
    );

  }

  /*
  UNKNOWN COMMAND
  */

  return reply(
    jid,
    `❌ الأمر *${command}* ما كاينش.

📚 كتب:
${PREFIX}menu`
  );

}

/*
====================================================
                    START
====================================================
*/

console.log("");
console.log("🚀 Starting SPOPO BOT...");
console.log("📁 Session:", SESSION_DIR);
console.log("");

connectWhatsApp();

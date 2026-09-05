const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const P = require("pino");

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("./auth_info_baileys");

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  const phoneNumber = "212644140800";
  let pairingRequested = false;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (
      connection === "connecting" &&
      !state.creds.registered &&
      !pairingRequested
    ) {
      pairingRequested = true;

      try {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const code = await sock.requestPairingCode(phoneNumber);

        console.log("================================");
        console.log("🔑 Pairing Code:", code);
        console.log("================================");
      } catch (error) {
        pairingRequested = false;
        console.log("❌ خطأ في Pairing Code:");
        console.log(error);
      }
    }

    if (connection === "open") {
      console.log("✅ تم اتصال البوت بواتساب!");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("❌ انقطع الاتصال");

      if (shouldReconnect) {
        startBot();
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];

    if (!msg || !msg.message) return;

    console.log("📩 توصل البوت برسالة");
  });
}

startBot();

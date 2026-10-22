const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const fs = require("fs");
const config = require("./config");

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('THE JOSEPH AI is running!');
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

async function startJosephAI() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state,
    browser: ["THE JOSEPH AI", "Chrome", "1.0.0"],
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
        : true;

      console.log("Connection closed. Reconnecting:", shouldReconnect);
      if (shouldReconnect) {
        startJosephAI();
      }
    } else if (connection === "open") {
      console.log("✅ THE JOSEPH AI is connected successfully!");
    }

    // Show pairing code if not registered
    if (!sock.authState.creds.registered) {
      const phoneNumber = config.owner[0];
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phoneNumber);
          console.log("=================================");
          console.log("PAIRING CODE:", code);
          console.log("=================================");
        } catch (e) {
          console.log("Error getting pairing code:", e.message);
        }
      }, 5000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const body = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || "";

    const isCmd = body.startsWith(config.prefix);
    const command = isCmd ? body.slice(config.prefix.length).trim().split(" ")[0].toLowerCase() : "";

    if (command === "menu" || command === "help") {
      const menuText = `
╭═══ *THE JOSEPH AI* ═══⊷
┃❃╭──────────────
┃❃│ Prefix : ${config.prefix}
┃❃│ User : ${msg.pushName || "User"}
┃❃│ Version : ${config.version}
┃❃╰───────────────
╰═════════════════⊷

╭─❏ *MAIN MENU* ❏
│ • .menu
│ • .ping
│ • .alive
╰─────────────────
      `;
      await sock.sendMessage(from, { text: menuText.trim() }, { quoted: msg });
    }

    if (command === "ping") {
      await sock.sendMessage(from, { text: "Pong! 🏓" }, { quoted: msg });
    }

    if (command === "alive") {
      await sock.sendMessage(from, { 
        text: `✅ *${config.botName}* is alive!\nVersion: ${config.version}` 
      }, { quoted: msg });
    }
  });
}

startJosephAI();

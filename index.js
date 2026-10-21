const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('THE JOSEPH AI IS ONLINE'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Web on port '+PORT));


const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const { Boom } = require("@hapi/boom")
const pino = require("pino")
const qrcode = require("qrcode-terminal")
const fs = require("fs")
const config = require("./config")

async function startJosephAI() {
  const { state, saveCreds } = await useMultiFileAuthState("auth")
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: true,
    auth: state,
    browser: ["THE JOSEPH AI", "Chrome", "1.0.0"],
    generateHighQualityLinkPreview: true,
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log("Scan this QR code with your WhatsApp:")
      qrcode.generate(qr, { small: true })
    }

    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
        : true

      console.log("Connection closed. Reconnecting:", shouldReconnect)
      if (shouldReconnect) {
        startJosephAI()
      }
    } else if (connection === "open") {
      console.log("✅ THE JOSEPH AI is connected successfully!")
    }
  })

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const from = msg.key.remoteJid
    const body = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || 
                 msg.message.imageMessage?.caption || ""

    const isCmd = body.startsWith(config.prefix)
    const command = isCmd ? body.slice(config.prefix.length).trim().split(" ")[0].toLowerCase() : ""

    if (isCmd) {
      try {
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

More features coming soon...
          `
          await sock.sendMessage(from, { text: menuText.trim() }, { quoted: msg })
        }

        if (command === "ping") {
          const start = Date.now()
          await sock.sendMessage(from, { text: "Pong! 🏓" }, { quoted: msg })
          const end = Date.now()
          await sock.sendMessage(from, { text: `Response time: ${end - start} ms` }, { quoted: msg })
        }

        if (command === "alive") {
          await sock.sendMessage(from, { 
            text: `✅ *${config.botName}* is alive and running!\nVersion: ${config.version}` 
          }, { quoted: msg })
        }

      } catch (err) {
        console.error(err)
        await sock.sendMessage(from, { text: "An error occurred." }, { quoted: msg })
      }
    }
  })
}

startJosephAI()

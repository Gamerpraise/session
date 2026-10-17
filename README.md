# 🚀 Gamerpraise-Session-Generator

## 📊 Visitor Counter

<p align="center">
  <img src="https://profile-counter.glitch.me/2/count.svg" alt="visitor counter"/>
</p>

---

## 💡 Fork This Project

[![Fork Repo](https://img.shields.io/badge/FORK-REPO-black?style=for-the-badge&logo=github)](https://github.com/2/Gamerpraise/session)

Generate session IDs for WhatsApp bots using [`@whiskeysockets/baileys`](https://github.com/whiskeysockets/baileys), with secure **MEGA** cloud storage and a fast web QR login.

> ⚠️ This is the **same code** used on my live site:  
> 🔗 [Session Generator Website](https://praise-pair.onrender.com/)  
> 💬 Don't ask for more — just **fork**, **star**, **edit** ,and **deploy**!

---

## 🧩 Features

- 🔐 Generates sessions for **any Baileys bot**
- ☁️ Stores sessions securely with **MEGA**
- 📱 Web-based **QR Pairing & Pair Pairing**
- 🚀 One-click deploy to:
  - Heroku
  - Render
  - Koyeb
  - Self-hosting platforms

---

## 📦 Deploy Now

| Platform | Deploy |
|---------|--------|
| 🟣 Heroku | [![Deploy to Heroku](https://img.shields.io/badge/DEPLOY-HEROKU-purple?style=for-the-badge&logo=heroku)](https://dashboard.heroku.com/new?template=https://github.com/Gamerpraise/session) |
| 🔵 Render | [![Deploy to Render](https://img.shields.io/badge/DEPLOY-RENDER-blue?style=for-the-badge&logo=render)](https://dashboard.render.com/) |
| ⚫ Koyeb | [![Deploy to Koyeb](https://img.shields.io/badge/DEPLOY-KOYEB-black?style=for-the-badge&logo=koyeb)](https://app.koyeb.com/) |

---

## 🧪 Example Output

[![👉 Try it here:](https://img.shields.io/badge/click-here-black?style=for-the-badge&logo=git)](https://new-session-2ag9.onrender.com/)


---

## 👑 Owner

<p align="center">
  <a href="https://github.com/Gamerpraise">
    <img src="https://github.com/Gamerpraise.png" width="200" height="200" alt="Gamerpraise "/>
  </a>
</p>

📬 [`Contact on WhatsApp`](https://wa.me/2349121243622)

---



---

## 🔧 v1.1 changes

- Pair code / QR linking fixed (current WhatsApp version floor + `postinstall` patch for the platform rejection). If you still see `405` in the logs, set `WA_VERSION` (see `.env.example`).
- After linking, the user gets 3 separate WhatsApp messages: `creds.json`, the session as plain text (long-press → Copy), then the notice/guide.
- The website shows the session with a **Copy Session** button as soon as linking finishes.
- Session text = `SESSION_PREFIX` + base64(`creds.json`). Leave the prefix empty for plain base64.
- The socket is now closed after delivery so it doesn't kick the user's bot off (conflict).
- Security: removed `express.static(__dirname)` (it exposed source files, `mega.js` and session folders), blocked path tricks in `?number=`, per-IP rate limit, Mega credentials moved to env vars.

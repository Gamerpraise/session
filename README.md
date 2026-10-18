# 🔗 Gamerpraise Session

A WhatsApp **session generator** for Baileys bots. People enter their number (or scan a QR), link the device, and get their session:

- shown on the website with a **Copy session** button (and a `creds.json` download)
- sent to their WhatsApp as 3 messages: `creds.json`, the session as plain text (press & hold → Copy), and a notice with your links

Everything lives in the **root** of the repo — no folders.

```
index.js        server + routes
whatsapp.js     linking with WhatsApp (pair code / QR) and sending the session
store.js        jobs, rate limit, sessions counter
index.html      the website (all CSS + JS inside)
patch.js        runs after install (WhatsApp compatibility fix)
package.json    render.yaml   .env.example   .gitignore   LICENSE
```

---

## 🚀 Deploy on Render

Your repo can stay **private** — Render connects to private repos through GitHub.

1. Upload all these files to the **root** of a new GitHub repo (the files themselves, not a folder containing them).
2. Go to **render.com → New → Web Service** and connect that repo.
3. Fill in:

   | Setting | Value |
   |---|---|
   | Runtime / Language | **Node** |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance type | Free works (see notes below) |
   | Health Check Path | `/health` (optional) |

4. Open **Environment** and add `NODE_VERSION` = `20` (the bot libraries need Node 20+).
5. Press **Create Web Service**. When the log says `Session generator running`, open your `https://….onrender.com` link. 🎉

> Prefer one click? Use **New → Blueprint** — `render.yaml` already has these settings.

### Optional settings (Render → Environment)

| Name | Default | What it does |
|---|---|---|
| `SITE_NAME` | Gamerpraise Session | Name shown on the site |
| `YOUTUBE_URL` | youtube.com/@gamerpraise-mods | YouTube link |
| `GITHUB_URL` | github.com/Gamerpraise | GitHub link |
| `CHANNEL_URL` | your WhatsApp channel | WhatsApp channel link |
| `PREFIX_OPTIONS` | `Gideon~,Praise~` | Extra choices in the "Session format" dropdown (comma separated) |
| `GUIDE_VIDEO_URL` | your YouTube | Link in the WhatsApp message |
| `COUNTER_FILE` | `./counter.json` | Where the sessions counter is saved |
| `MAX_ACTIVE_SESSIONS` | 40 | Max people linking at the same moment |
| `WA_VERSION` | auto | Force a WhatsApp version if you ever see 405 errors, e.g. `2.3000.1044015310` |
| `SKIP_BAILEYS_PATCH` | – | Set to `1` to skip the compatibility patch in `patch.js` |

Changing the links = change the variable on Render and restart. No code edits needed.

### Good to know about Render
- **Free instances sleep** after ~15 minutes without visitors, so the first visit can take up to a minute to load. While someone is linking, the page keeps the server awake.
- **The sessions counter resets** on every redeploy/restart on the free plan (no persistent disk). Add a paid Render Disk and set `COUNTER_FILE=/data/counter.json` if you want it permanent.
- **Free instances share IPs**, and WhatsApp may occasionally refuse pair codes from busy hosts. If codes stop working, try again later, use the QR tab, or move to a paid instance.
- Temporary login files are kept in the system temp folder and deleted right after each session.

---

## 💻 Run it on your own PC

```bash
npm install
npm start        # opens on http://localhost:8000
```
Requires Node.js 20+.

---

## 🔒 Privacy & safety (already built in)
- The session is given to the page **once**, then the server forgets it.
- The connection is closed (not logged out) after delivery so it never fights the user's bot.
- Per-IP rate limit, random job ids, and the server only serves `index.html` — your source files can't be downloaded.
- Never put real sessions or a `.env` file in the repo (the `.gitignore` already skips them).

## 🧯 Troubleshooting

| Problem | Fix |
|---|---|
| Pair code never arrives / says "could not connect (405)" | Check the Render logs for `status 405`. Redeploy with **Clear build cache & deploy** (re-runs `patch.js`), or set `WA_VERSION` |
| Build fails on `npm install` | Make sure `NODE_VERSION=20` is set |
| "Server is busy" | Raise `MAX_ACTIVE_SESSIONS` or upgrade the instance |
| Site is slow on first open | Free instance was asleep – wait a moment |

Made by **Gpraise** · MIT License

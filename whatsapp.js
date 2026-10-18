// Everything that talks to WhatsApp: pair code / QR linking, building the session text, sending it to the user.
import fs from 'fs';
import os from 'os';
import path from 'path';
import pino from 'pino';
import * as B from '@whiskeysockets/baileys';
import { createJob, updateJob, bumpTotal } from './store.js';

// works with both Baileys 6.x and 7.x export styles
const get = (name) => B[name] ?? B.default?.[name];
const makeWASocket = B.makeWASocket ?? (typeof B.default === 'function' ? B.default : B.default?.default);
const {
    useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion,
    Browsers, DisconnectReason, jidNormalizedUser, BufferJSON, delay
} = Object.fromEntries(
    ['useMultiFileAuthState', 'makeCacheableSignalKeyStore', 'fetchLatestBaileysVersion', 'Browsers', 'DisconnectReason', 'jidNormalizedUser', 'BufferJSON', 'delay']
        .map(n => [n, get(n)])
);

const logger = pino({ level: 'silent' });
const TMP_ROOT = path.join(os.tmpdir(), 'gamerpraise-session'); // temp login folders live outside the project
const LINK_TIMEOUT = 5 * 60 * 1000;
const MAX_ACTIVE = Number(process.env.MAX_ACTIVE_SESSIONS || 40);
let active = 0;

export class HttpError extends Error {
    constructor(message, status = 503) { super(message); this.status = status; }
}

export function resetTmp() {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
    fs.mkdirSync(TMP_ROOT, { recursive: true });
}
const removeDir = (dir) => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } };

/* ---------------- WhatsApp web version ---------------- */
// WhatsApp rejects old client versions (405). Never go below this floor; use the fetched one only if newer.
const VERSION_FLOOR = [2, 3000, 1044015310];
const isNewer = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
let cached = null, cachedAt = 0;

async function getWaVersion() {
    if (process.env.WA_VERSION) return process.env.WA_VERSION.split('.').map(Number);
    if (cached && Date.now() - cachedAt < 3600_000) return cached;
    let version = VERSION_FLOOR;
    try {
        const res = await fetchLatestBaileysVersion();
        if (Array.isArray(res?.version) && isNewer(res.version, version)) version = res.version;
    } catch { /* offline - use floor */ }
    cached = version; cachedAt = Date.now();
    return version;
}

/* ---------------- links + messages ---------------- */
const YOUTUBE = process.env.YOUTUBE_URL || 'https://youtube.com/@gamerpraise-mods';
const GITHUB = process.env.GITHUB_URL || 'https://github.com/Gamerpraise/';
const CHANNEL = process.env.CHANNEL_URL || 'https://whatsapp.com/channel/0029VbBRPc3CMY0IePiiU808';
const GUIDE = process.env.GUIDE_VIDEO_URL || YOUTUBE;

// Only a short, safe prefix is accepted from the website.
export const cleanPrefix = (v) => (typeof v === 'string' && /^[A-Za-z0-9_~:.\-]{0,20}$/.test(v) ? v : '');

async function send(sock, jid, content, label) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await sock.sendMessage(jid, content);
            return true;
        } catch (e) {
            console.error(`⚠️ ${label} failed (try ${attempt}):`, e?.message || e);
            await delay(1500 * attempt);
        }
    }
    return false;
}

async function deliver(sock, jid, dir, state, prefix) {
    await delay(3000); // let Baileys flush the final creds to disk

    let raw;
    try { raw = fs.readFileSync(path.join(dir, 'creds.json')); }
    catch { raw = Buffer.from(JSON.stringify(state.creds, BufferJSON.replacer)); }
    const session = prefix + raw.toString('base64');

    // 1) creds.json file  2) the session as PLAIN text alone (long-press → Copy)  3) notice + links
    await send(sock, jid, { document: raw, mimetype: 'application/json', fileName: 'creds.json' }, 'creds.json');
    await delay(800);
    await send(sock, jid, { text: session }, 'session text');
    await delay(800);
    await send(sock, jid, {
        text:
`⚠️ Never share this session with anybody.

👆 Press and hold the long message above → Copy, then paste it in your bot's SESSION_ID (or upload creds.json to the bot's session folder).

📺 YouTube: ${GUIDE}
💻 GitHub: ${GITHUB}
📢 Channel: ${CHANNEL}

— Gamerpraise Session`
    }, 'notice');

    return session;
}

/* ---------------- one linking attempt ---------------- */
/**
 * Starts a linking attempt.
 *  - phoneNumber → pair-code mode, resolves with { id, code }
 *  - no number   → QR mode, resolves with { id, qr }  (newer QRs are stored on the job)
 * Rejects with HttpError when linking cannot start.
 */
export function startSession({ phoneNumber = null, prefix = '' }) {
    return new Promise((resolve, reject) => {
        const id = createJob();
        const tag = id.slice(0, 6);
        const dir = path.join(TMP_ROOT, id); // random hex – never user input
        let sock = null, finished = false, delivering = false, pairRequested = false, restarts = 0, settled = false;

        const settle = (fn, value) => { if (!settled) { settled = true; fn(value); } };

        if (active >= MAX_ACTIVE) {
            updateJob(id, { status: 'error', error: 'Server is busy. Please try again in a minute.' });
            return reject(new HttpError('Server is busy. Please try again in a minute.', 503));
        }
        active++;
        fs.mkdirSync(dir, { recursive: true });

        const finish = () => {
            if (finished) return;
            finished = true; active--;
            clearTimeout(ttl);
            try { sock?.ev.removeAllListeners('connection.update'); sock?.ev.removeAllListeners('creds.update'); } catch { /* ignore */ }
            // Close (never log out!) so we don't fight the user's bot for the same session.
            try { sock?.end(undefined); } catch { /* ignore */ }
            setTimeout(() => removeDir(dir), 3000);
        };
        const fail = (message, status = 503) => {
            if (finished) return;
            updateJob(id, { status: 'error', error: message });
            settle(reject, new HttpError(message, status));
            finish();
        };
        const ttl = setTimeout(() => {
            if (finished) return;
            updateJob(id, { status: 'expired', error: 'Timed out. Please start again.' });
            settle(reject, new HttpError('Timed out. Please start again.', 408));
            finish();
        }, LINK_TIMEOUT);

        async function start() {
            if (finished) return;
            try {
                const { state, saveCreds } = await useMultiFileAuthState(dir);
                const version = await getWaVersion();

                sock = makeWASocket({
                    version, logger,
                    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
                    printQRInTerminal: false,
                    browser: Browsers.macOS('Chrome'),
                    markOnlineOnConnect: false,
                    syncFullHistory: false,
                    generateHighQualityLinkPreview: false,
                    defaultQueryTimeoutMs: 60000,
                    connectTimeoutMs: 60000,
                    keepAliveIntervalMs: 30000
                });

                sock.ev.on('creds.update', async () => {
                    if (finished) return;
                    try { await saveCreds(); } catch (e) { console.error(`[${tag}] saveCreds:`, e.message); }
                });

                sock.ev.on('connection.update', async (update) => {
                    const { connection, lastDisconnect, qr } = update;

                    if (qr && !phoneNumber) {
                        try {
                            const QRCode = (await import('qrcode')).default;
                            const dataUrl = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'M', margin: 1, width: 360 });
                            updateJob(id, { qr: dataUrl }); // WhatsApp rotates the QR every ~20s
                            settle(resolve, { id, qr: dataUrl });
                        } catch (e) { fail('Could not draw the QR code.', 500); }
                    }

                    if (connection === 'open' && !delivering) {
                        delivering = true;
                        console.log(`[${tag}] ✅ linked`);
                        try {
                            const me = jidNormalizedUser(sock.user?.id || state.creds.me?.id);
                            const number = '+' + me.split('@')[0].split(':')[0];
                            updateJob(id, { status: 'linked', number });
                            const session = await deliver(sock, me, dir, state, prefix);
                            updateJob(id, { status: 'ready', session });
                            bumpTotal();
                            console.log(`[${tag}] 🎉 delivered`);
                        } catch (e) {
                            console.error(`[${tag}] deliver error:`, e);
                            return fail('Linked, but the session could not be read. Please try again.');
                        }
                        setTimeout(finish, 5000);
                        return;
                    }

                    if (connection === 'close') {
                        if (finished || delivering) return;
                        const code = lastDisconnect?.error?.output?.statusCode;
                        console.log(`[${tag}] closed – status ${code ?? 'unknown'}: ${lastDisconnect?.error?.message || ''}`);

                        if (code === DisconnectReason.loggedOut) return fail('WhatsApp rejected the link. Please try again.', 401);

                        const paired = !!(state.creds.registered || state.creds.me);
                        // 515 = "restart required": WhatsApp always does this right after a successful link
                        if ((code === DisconnectReason.restartRequired || paired) && restarts < 5) {
                            restarts++;
                            try { sock.ev.removeAllListeners('connection.update'); sock.ev.removeAllListeners('creds.update'); } catch { /* ignore */ }
                            return setTimeout(start, 1000);
                        }
                        fail(`Could not connect to WhatsApp (status ${code ?? 'unknown'}). Please try again.`);
                    }
                });

                if (phoneNumber && !pairRequested && !state.creds.registered && !state.creds.me) {
                    pairRequested = true;
                    await delay(3000);
                    let code;
                    for (let i = 1; i <= 2 && !code; i++) {
                        try { code = await sock.requestPairingCode(phoneNumber); }
                        catch (e) { console.error(`[${tag}] pairing code (try ${i}):`, e?.message || e); await delay(2000); }
                    }
                    if (!code) return fail('Could not get a pair code. Check your number and try again.');
                    settle(resolve, { id, code: code.match(/.{1,4}/g)?.join('-') || code });
                }
            } catch (err) {
                console.error(`[${tag}] init error:`, err);
                fail('Service unavailable. Please try again.');
            }
        }
        start();
    });
}

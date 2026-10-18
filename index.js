import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { rateLimit, readJob, getTotal } from './store.js';
import { startSession, resetTmp, cleanPrefix, HttpError } from './whatsapp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8000;
const app = express();

EventEmitter.defaultMaxListeners = 500;
app.disable('x-powered-by');
app.set('trust proxy', 1); // hosts like Render / Koyeb / Railway sit behind a proxy

resetTmp(); // clear half-finished logins from a previous run

// security headers
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
    });
    next();
});

// Only these routes exist – project files are never served.
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/health', (req, res) => res.send('ok'));

const api = express.Router();
api.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

api.get('/config', (req, res) => {
    const prefixes = (process.env.PREFIX_OPTIONS ?? 'Gideon~,Praise~').split(',').map(s => s.trim()).filter(Boolean).map(cleanPrefix).filter(Boolean);
    res.send({
        siteName: process.env.SITE_NAME || 'Gamerpraise Session',
        links: {
            youtube: process.env.YOUTUBE_URL || 'https://youtube.com/@gamerpraise-mods',
            github: process.env.GITHUB_URL || 'https://github.com/Gamerpraise/',
            channel: process.env.CHANNEL_URL || 'https://whatsapp.com/channel/0029VbBRPc3CMY0IePiiU808'
        },
        prefixes,
        total: getTotal()
    });
});

api.get('/total', (req, res) => res.send({ total: getTotal() }));

const fail = (res, e) => {
    const status = e instanceof HttpError ? e.status : 500;
    res.status(status).send({ error: e.message || 'Something went wrong. Please try again.' });
};

api.get('/pair', rateLimit(8), async (req, res) => {
    const number = String(req.query.number || '').replace(/\D/g, '');
    if (!number) return res.status(400).send({ error: 'Please enter your WhatsApp number.' });
    if (number.startsWith('0') || number.length < 8 || number.length > 15) {
        return res.status(400).send({ error: 'Use your full international number without + or spaces, and without a leading 0 (example: 2348012345678).' });
    }
    try {
        res.send(await startSession({ phoneNumber: number, prefix: cleanPrefix(req.query.prefix) }));
    } catch (e) { fail(res, e); }
});

api.get('/qr', rateLimit(8), async (req, res) => {
    try {
        res.send(await startSession({ prefix: cleanPrefix(req.query.prefix) }));
    } catch (e) { fail(res, e); }
});

api.get('/status', (req, res) => {
    const id = String(req.query.id || '');
    if (!/^[a-f0-9]{32}$/.test(id)) return res.status(400).send({ status: 'error', error: 'Bad request.' });
    const job = readJob(id);
    if (!job) return res.status(404).send({ status: 'unknown', error: 'This request has expired. Please start again.' });
    res.send({ status: job.status, qr: job.qr, session: job.session, number: job.number, error: job.error });
});

app.use('/api', api);
app.use((req, res) => res.status(404).send('Not found'));

// Baileys throws harmless network errors now and then – log them, don't crash.
process.on('unhandledRejection', (e) => console.log('Unhandled rejection:', e?.message || e));
process.on('uncaughtException', (e) => console.log('Uncaught exception:', e?.message || e));

app.listen(PORT, () => console.log(`✅ Session generator running on http://localhost:${PORT}`));

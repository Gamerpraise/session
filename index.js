import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import { EventEmitter } from 'events';

import pairRouter from './pair.js';
import qrRouter from './qr.js';
import statusRouter from './status.js';
import { resetSessionsRoot } from './lib/runner.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8000;

EventEmitter.defaultMaxListeners = 500;
app.set('trust proxy', 1); // Render / Heroku / Koyeb sit behind a proxy (needed for per-IP rate limiting)

// wipe any half-finished sessions left over from a previous run
resetSessionsRoot();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// NOTE: we deliberately do NOT use express.static(__dirname) any more.
// That served every file in the project (source code, mega.js credentials, session folders).
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'pair.html')));

app.use('/pair', pairRouter);
app.use('/qr', qrRouter);
app.use('/status', statusRouter);

// Baileys throws a lot of harmless network errors – log them, don't crash.
const IGNORED = [
    'conflict', 'not-authorized', 'Socket connection timeout', 'rate-overlimit',
    'Connection Closed', 'Timed Out', 'Value not found', 'Stream Errored',
    'statusCode: 515', 'statusCode: 503'
];
process.on('uncaughtException', (err) => {
    const e = String(err);
    if (IGNORED.some(s => e.includes(s))) return;
    console.log('Caught exception:', err);
});
process.on('unhandledRejection', (reason) => {
    const e = String(reason);
    if (IGNORED.some(s => e.includes(s))) return;
    console.log('Unhandled rejection:', reason);
});

app.listen(PORT, () => {
    console.log(`YouTube: @gamerpraise-mods\nGitHub: @Gamerpraise\n\nServer running on http://localhost:${PORT}`);
});

export default app;

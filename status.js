import express from 'express';
import { readJob, getTotal } from './lib/session.js';

const router = express.Router();

// The page polls this to learn when the link succeeded and to receive the session text.
router.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const id = String(req.query.id || '');
    if (!/^[a-f0-9]{32}$/.test(id)) return res.status(400).send({ status: 'error', error: 'Bad id' });

    const job = readJob(id);
    if (!job) return res.status(404).send({ status: 'unknown', error: 'This request has expired. Please generate a new one.' });

    res.send({ status: job.status, qr: job.qr, session: job.session, number: job.number, error: job.error });
});

// public counter for the page
router.get('/total', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.send({ total: getTotal() });
});

export default router;

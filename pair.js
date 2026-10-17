import express from 'express';
import pn from 'awesome-phonenumber';
import { createJob, rateLimit, cleanPrefix } from './lib/session.js';
import { runSession } from './lib/runner.js';

const router = express.Router();

router.get('/', rateLimit(8), (req, res) => {
    const digits = String(req.query.number || '').replace(/[^0-9]/g, '');
    if (!digits) {
        return res.status(400).send({ code: 'Please enter your WhatsApp number.' });
    }

    const phone = pn('+' + digits);
    if (!phone.isValid()) {
        return res.status(400).send({
            code: 'Invalid phone number. Enter your full international number (e.g. 15551234567 for US, 447911123456 for UK) without + or spaces.'
        });
    }
    const num = phone.getNumber('e164').replace('+', '');

    const id = createJob();
    let responded = false;

    runSession({
        id,
        phoneNumber: num,
        prefix: cleanPrefix(req.query.prefix),
        onPairCode: (code) => {
            if (responded) return;
            responded = true;
            res.send({ code, id, number: '+' + num });
        },
        onFail: (message, status) => {
            if (responded) return;
            responded = true;
            res.status(status).send({ code: message });
        }
    });
});

export default router;

import express from 'express';
import QRCode from 'qrcode';
import { createJob, updateJob, rateLimit, cleanPrefix } from './lib/session.js';
import { runSession } from './lib/runner.js';

const router = express.Router();

router.get('/', rateLimit(8), (req, res) => {
    const id = createJob();
    let responded = false;

    runSession({
        id,
        prefix: cleanPrefix(req.query.prefix),
        onQr: async (qr) => {
            try {
                const qrDataURL = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'M', margin: 1 });
                // WhatsApp rotates the QR every ~20s – keep the newest one for the page to pick up
                updateJob(id, { qr: qrDataURL });
                if (!responded) {
                    responded = true;
                    res.send({
                        id,
                        qr: qrDataURL,
                        message: 'QR Code Generated! Scan it with your WhatsApp app.',
                        instructions: [
                            '1. Open WhatsApp on your phone',
                            '2. Go to Settings > Linked Devices',
                            '3. Tap "Link a Device"',
                            '4. Scan the QR code above'
                        ]
                    });
                }
            } catch (e) {
                console.error('QR render error:', e);
                if (!responded) {
                    responded = true;
                    res.status(500).send({ code: 'Failed to generate QR code' });
                }
            }
        },
        onFail: (message, status) => {
            if (responded) return;
            responded = true;
            res.status(status).send({ code: message });
        }
    });
});

export default router;

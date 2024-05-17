import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import * as keymaster  from './keymaster-sdk.js';

const app = express();
const port = 3000;

app.use(morgan('dev'));
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'auth-client/build')));

app.get('/api/version', async (req, res) => {
    try {
        res.json(1);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

app.get('/api/challenge', async (req, res) => {
    try {
        const challenge = await keymaster.createChallenge();
        res.json(challenge);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

app.post('/api/authenticate', async (req, res) => {
    try {
        const { response, challenge } = req.body;
        const verify = await keymaster.verifyResponse(response, challenge);
        res.json({ authenticated: verify.match });
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

app.use((req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'auth-client/build', 'index.html'));
    } else {
        console.warn(`Warning: Unhandled API endpoint - ${req.method} ${req.originalUrl}`);
        res.status(404).json({ message: 'Endpoint not found' });
    }
});

process.on('uncaughtException', (error) => {
    console.error('Unhandled exception caught', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

app.listen(port, () => {
    console.log(`auth-demo listening at http://localhost:${port}`);
});

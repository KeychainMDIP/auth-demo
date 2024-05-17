import express from 'express';
import morgan from 'morgan';

const app = express();
const v1router = express.Router();
const port = 3000;

app.use(morgan('dev'));
app.use(express.json());
app.use('/api/v1', v1router);

v1router.get('/version', async (req, res) => {
    try {
        res.json(1);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

process.on('uncaughtException', (error) => {
    //console.error('Unhandled exception caught');
    console.error('Unhandled exception caught', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    //console.error('Unhandled rejection caught');
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});

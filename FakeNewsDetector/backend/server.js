import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import verifyRouter from './routes/verify.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGINS === '*' ? true : process.env.CORS_ORIGINS?.split(',') }));
app.use(express.json({ limit: '50kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/verify', verifyRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Internal server error' });
});

const port = process.env.PORT;
app.listen(port, '0.0.0.0', () => console.log(`FakeNewsDetector API listening on ${port}`));

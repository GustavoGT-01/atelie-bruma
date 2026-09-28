import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';

import { assertAuthSecret, sessionMiddleware } from './lib/auth.js';
import authRouter from './routes/auth.js';
import catalogosRouter from './routes/catalogos.js';
import demandasRouter from './routes/demandas.js';
import tiposRouter from './routes/tipos.js';
import produtosRouter from './routes/produtos.js';
import modulacoesRouter from './routes/modulacoes.js';
import usuariosRouter from './routes/usuarios.js';
import fluxoOpcoesRouter from './routes/fluxo-opcoes.js';
import fluxoPadraoRouter from './routes/fluxo-padrao.js';
import preferenciasRouter from './routes/preferencias.js';
import dashboardRouter from './routes/dashboard.js';
import importXlsxRouter from './routes/import-xlsx.js';
import exportXlsxRouter from './routes/export-xlsx.js';
import backupsRouter from './routes/backups.js';
import painelRouter from './routes/painel.js';

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(sessionMiddleware);

app.use('/api', authRouter);
app.use('/api', catalogosRouter);
app.use('/api', demandasRouter);
app.use('/api', tiposRouter);
app.use('/api', produtosRouter);
app.use('/api', modulacoesRouter);
app.use('/api', usuariosRouter);
app.use('/api', fluxoOpcoesRouter);
app.use('/api', fluxoPadraoRouter);
app.use('/api', preferenciasRouter);
app.use('/api', dashboardRouter);
app.use('/api', importXlsxRouter);
app.use('/api', exportXlsxRouter);
app.use('/api', backupsRouter);
app.use('/api', painelRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

assertAuthSecret();

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`API Piu Mobile em http://localhost:${port}`);
});

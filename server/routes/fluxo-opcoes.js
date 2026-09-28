import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireSession, requireEditor } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';

const router = Router();

router.get(
  '/fluxo-opcoes',
  requireSession,
  asyncRoute(async (_req, res) => {
    const opcoes = await prisma.fluxoOpcao.findMany({ orderBy: { ordem: 'asc' } });
    res.json(opcoes);
  })
);

router.post('/fluxo-opcoes', requireEditor(), async (req, res) => {
  const body = req.body || {};
  const codigo = String(body.codigo || '')
    .trim()
    .toUpperCase();
  const nome = String(body.nome || '').trim();
  if (!codigo || !nome) {
    res.status(400).json({ error: 'Código e nome obrigatórios' });
    return;
  }
  try {
    const opcao = await prisma.fluxoOpcao.create({
      data: {
        codigo,
        nome,
        tempoEstimadoMin: Number(body.tempoEstimadoMin || 30),
        ordem: Number(body.ordem || 0),
        ativo: true,
      },
    });
    res.status(201).json(opcao);
  } catch {
    res.status(400).json({ error: 'Código já existe ou dados inválidos' });
  }
});

router.patch(
  '/fluxo-opcoes',
  requireEditor(),
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    if (!body.id) {
      res.status(400).json({ error: 'id obrigatório' });
      return;
    }
    const opcao = await prisma.fluxoOpcao.update({
      where: { id: body.id },
      data: {
        ...(body.nome !== undefined ? { nome: String(body.nome) } : {}),
        ...(body.codigo !== undefined
          ? { codigo: String(body.codigo).trim().toUpperCase() }
          : {}),
        ...(body.tempoEstimadoMin !== undefined
          ? { tempoEstimadoMin: Number(body.tempoEstimadoMin) }
          : {}),
        ...(body.ativo !== undefined ? { ativo: Boolean(body.ativo) } : {}),
        ...(body.ordem !== undefined ? { ordem: Number(body.ordem) } : {}),
      },
    });
    res.json(opcao);
  })
);

router.delete(
  '/fluxo-opcoes',
  requireEditor(),
  asyncRoute(async (req, res) => {
    const id = req.query.id;
    if (!id) {
      res.status(400).json({ error: 'id obrigatório' });
      return;
    }
    const n = await prisma.demandaOpcao.count({ where: { opcaoId: String(id) } });
    if (n > 0) {
      await prisma.fluxoOpcao.update({
        where: { id: String(id) },
        data: { ativo: false },
      });
      res.json({ ok: true, soft: true });
      return;
    }
    await prisma.fluxoOpcao.delete({ where: { id: String(id) } });
    res.json({ ok: true });
  })
);

export default router;

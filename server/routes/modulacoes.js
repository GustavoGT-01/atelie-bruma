import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireEditor } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';

const router = Router();

router.post(
  '/modulacoes',
  requireEditor(),
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const modulacao = await prisma.modulacao.create({
      data: { nome: String(body.nome).trim().toUpperCase() },
    });
    res.status(201).json(modulacao);
  })
);

router.patch(
  '/modulacoes/:id',
  requireEditor(),
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const modulacao = await prisma.modulacao.update({
      where: { id: req.params.id },
      data: {
        ...(body.nome !== undefined
          ? { nome: String(body.nome).trim().toUpperCase() }
          : {}),
        ...(body.ativo !== undefined ? { ativo: Boolean(body.ativo) } : {}),
      },
    });
    res.json(modulacao);
  })
);

router.delete(
  '/modulacoes/:id',
  requireEditor(),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const n = await prisma.demanda.count({ where: { modulacaoId: id } });
    if (n > 0) {
      await prisma.modulacao.update({ where: { id }, data: { ativo: false } });
      res.json({ ok: true, soft: true });
      return;
    }
    await prisma.modulacao.delete({ where: { id } });
    res.json({ ok: true });
  })
);

export default router;

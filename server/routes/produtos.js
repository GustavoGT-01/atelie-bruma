import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireEditor } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';

const router = Router();

router.post(
  '/produtos',
  requireEditor(),
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const produto = await prisma.produto.create({
      data: { nome: String(body.nome).trim().toUpperCase() },
    });
    res.status(201).json(produto);
  })
);

router.patch(
  '/produtos/:id',
  requireEditor(),
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const produto = await prisma.produto.update({
      where: { id: req.params.id },
      data: {
        ...(body.nome !== undefined
          ? { nome: String(body.nome).trim().toUpperCase() }
          : {}),
        ...(body.ativo !== undefined ? { ativo: Boolean(body.ativo) } : {}),
      },
    });
    res.json(produto);
  })
);

router.delete(
  '/produtos/:id',
  requireEditor(),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const n = await prisma.demanda.count({ where: { produtoId: id } });
    if (n > 0) {
      await prisma.produto.update({ where: { id }, data: { ativo: false } });
      res.json({ ok: true, soft: true });
      return;
    }
    await prisma.produto.delete({ where: { id } });
    res.json({ ok: true });
  })
);

export default router;

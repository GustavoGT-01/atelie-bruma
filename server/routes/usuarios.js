import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { hashPassword, requireSession, requireEditor } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';
import {
  mergePreferencias,
  parsePreferencias,
  serializePreferencias,
} from '../lib/preferencias.js';
import { normalizePaineisIds } from '../lib/paineis.js';

const router = Router();

router.get(
  '/usuarios',
  requireSession,
  asyncRoute(async (_req, res) => {
    const users = await prisma.usuario.findMany({
      orderBy: { nome: 'asc' },
      include: {
        tiposAtividade: { select: { tipoAtividadeId: true } },
      },
    });
    res.json(
      users.map((u) => {
        const prefs = parsePreferencias(u.preferenciasJson);
        return {
          id: u.id,
          nome: u.nome,
          login: u.login,
          papel: u.papel,
          ativo: u.ativo,
          tipoAtividadeIds: u.tiposAtividade.map((t) => t.tipoAtividadeId),
          paineisVisiveis: prefs.paineisVisiveis || [],
        };
      })
    );
  })
);

router.post(
  '/usuarios',
  requireEditor(),
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const paineis = normalizePaineisIds(body.paineisVisiveis);
    const prefs = paineis.length
      ? serializePreferencias({ paineisVisiveis: paineis })
      : '{}';

    const user = await prisma.usuario.create({
      data: {
        nome: String(body.nome),
        login: String(body.login || '')
          .trim()
          .toUpperCase(),
        senhaHash: await hashPassword(String(body.senha || '123456')),
        papel: body.papel || 'EXECUTOR',
        preferenciasJson: prefs,
      },
    });

    if (Array.isArray(body.tipoAtividadeIds)) {
      const ids = [
        ...new Set(body.tipoAtividadeIds.map((x) => String(x || '').trim()).filter(Boolean)),
      ];
      if (ids.length) {
        await prisma.usuarioTipoAtividade.createMany({
          data: ids.map((tipoAtividadeId) => ({
            usuarioId: user.id,
            tipoAtividadeId,
          })),
        });
        for (const tipoAtividadeId of ids) {
          await prisma.tipoAtividade.updateMany({
            where: { id: tipoAtividadeId, executorPadraoId: null },
            data: { executorPadraoId: user.id },
          });
        }
      }
    }

    res.status(201).json({
      id: user.id,
      nome: user.nome,
      login: user.login,
      papel: user.papel,
      ativo: user.ativo,
      tipoAtividadeIds: Array.isArray(body.tipoAtividadeIds) ? body.tipoAtividadeIds : [],
      paineisVisiveis: paineis,
    });
  })
);

router.patch(
  '/usuarios/:id',
  requireEditor(),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};

    const data = {};
    if (body.nome !== undefined) data.nome = String(body.nome);
    if (body.login !== undefined) {
      data.login = String(body.login || '')
        .trim()
        .toUpperCase();
    }
    if (body.papel !== undefined) data.papel = String(body.papel);
    if (body.ativo !== undefined) data.ativo = Boolean(body.ativo);
    if (body.senha) data.senhaHash = await hashPassword(String(body.senha));

    if (Array.isArray(body.paineisVisiveis)) {
      const atualUser = await prisma.usuario.findUnique({
        where: { id },
        select: { preferenciasJson: true },
      });
      const atual = parsePreferencias(atualUser?.preferenciasJson);
      const paineis = normalizePaineisIds(body.paineisVisiveis);
      const next = mergePreferencias(atual, { paineisVisiveis: paineis });
      data.preferenciasJson = serializePreferencias(next);
    }

    const user = await prisma.usuario.update({ where: { id }, data });

    if (Array.isArray(body.tipoAtividadeIds)) {
      const ids = [
        ...new Set(body.tipoAtividadeIds.map((x) => String(x || '').trim()).filter(Boolean)),
      ];
      await prisma.usuarioTipoAtividade.deleteMany({ where: { usuarioId: id } });
      if (ids.length) {
        await prisma.usuarioTipoAtividade.createMany({
          data: ids.map((tipoAtividadeId) => ({
            usuarioId: id,
            tipoAtividadeId,
          })),
        });
        for (const tipoAtividadeId of ids) {
          await prisma.tipoAtividade.updateMany({
            where: { id: tipoAtividadeId, executorPadraoId: null },
            data: { executorPadraoId: id },
          });
        }
      }
    }

    const links = await prisma.usuarioTipoAtividade.findMany({
      where: { usuarioId: id },
      select: { tipoAtividadeId: true },
    });
    const prefs = parsePreferencias(user.preferenciasJson);

    res.json({
      id: user.id,
      nome: user.nome,
      login: user.login,
      papel: user.papel,
      ativo: user.ativo,
      tipoAtividadeIds: links.map((l) => l.tipoAtividadeId),
      paineisVisiveis: prefs.paineisVisiveis || [],
    });
  })
);

router.delete(
  '/usuarios/:id',
  requireEditor(),
  asyncRoute(async (req, res) => {
    const { id } = req.params;

    if (req.session.id === id) {
      res.status(400).json({ error: 'Não é possível excluir o usuário logado' });
      return;
    }

    await prisma.demanda.updateMany({
      where: { executorId: id },
      data: { executorId: null },
    });
    await prisma.tipoAtividade.updateMany({
      where: { executorPadraoId: id },
      data: { executorPadraoId: null },
    });
    await prisma.usuarioTipoAtividade.deleteMany({ where: { usuarioId: id } });
    await prisma.notificacao.deleteMany({ where: { usuarioId: id } });
    await prisma.apontamento.deleteMany({ where: { usuarioId: id } });
    await prisma.usuario.delete({ where: { id } });

    res.json({ ok: true });
  })
);

export default router;

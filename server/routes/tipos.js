import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireEditor } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';
import { atualizarMediaTempoAtividade } from '../lib/workflow.js';
import { serializePreRequisitos } from '../lib/fluxo-etapas.js';
import {
  normalizeCorHex,
  CORES_PADRAO,
  COR_ATIVIDADE_FALLBACK,
} from '../lib/fluxo-padrao.js';
import {
  aplicarFluxoPadrao,
  salvarDiagramaAtualComoPadrao,
} from '../lib/seed-fluxo-cadeia.js';

const router = Router();

async function syncSucessores(tipoId, sucessorIds) {
  const ids = [...new Set(sucessorIds.filter((id) => id && id !== tipoId))];
  await prisma.tipoSucessor.deleteMany({ where: { origemId: tipoId } });
  if (!ids.length) return;
  await prisma.tipoSucessor.createMany({
    data: ids.map((destinoId, ordem) => ({
      origemId: tipoId,
      destinoId,
      ordem,
    })),
  });
}

async function resolvePreRequisitos(body, obrigatorio) {
  if (Array.isArray(body.preRequisitos)) {
    return serializePreRequisitos(body.preRequisitos.map(String));
  }
  if (Array.isArray(body.preRequisitoIds)) {
    const ids = body.preRequisitoIds.filter(Boolean);
    if (!ids.length) return serializePreRequisitos([]);
    const tipos = await prisma.tipoAtividade.findMany({
      where: { id: { in: ids } },
      select: { nome: true },
    });
    return serializePreRequisitos(tipos.map((t) => t.nome));
  }
  return obrigatorio ? serializePreRequisitos([]) : undefined;
}

router.post('/tipos', requireEditor('Sem permissao'), async (req, res) => {
  const body = req.body || {};
  const nome = String(body.nome || '')
    .trim()
    .toUpperCase();
  if (!nome) {
    res.status(400).json({ error: 'Nome obrigatorio' });
    return;
  }

  try {
    const existente = await prisma.tipoAtividade.findUnique({ where: { nome } });
    const preRequisitos = await resolvePreRequisitos(body, true);
    const cor = normalizeCorHex(body.cor, CORES_PADRAO[nome] || COR_ATIVIDADE_FALLBACK);

    const tipo = existente
      ? await prisma.tipoAtividade.update({
          where: { id: existente.id },
          data: {
            ordemPadrao: Number(body.ordemPadrao || existente.ordemPadrao || 0),
            tempoEstimadoMin: Number(
              body.tempoEstimadoMin || existente.tempoEstimadoMin || 60
            ),
            temOpcoesListagem: Boolean(body.temOpcoesListagem),
            executorPadraoId: body.executorPadraoId
              ? String(body.executorPadraoId)
              : null,
            preRequisitos,
            cor,
            ativo: true,
          },
        })
      : await prisma.tipoAtividade.create({
          data: {
            nome,
            ordemPadrao: Number(body.ordemPadrao || 0),
            tempoEstimadoMin: Number(body.tempoEstimadoMin || 60),
            temOpcoesListagem: Boolean(body.temOpcoesListagem),
            executorPadraoId: body.executorPadraoId
              ? String(body.executorPadraoId)
              : null,
            preRequisitos,
            cor,
          },
        });

    if (Array.isArray(body.sucessorIds)) {
      await syncSucessores(tipo.id, body.sucessorIds);
    }

    const full = await prisma.tipoAtividade.findUnique({
      where: { id: tipo.id },
      include: {
        sucessores: { include: { destino: true }, orderBy: { ordem: 'asc' } },
      },
    });
    res.status(existente ? 200 : 201).json({ ...full, updated: Boolean(existente) });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: 'Falha ao salvar atividade. Verifique o nome e tente de novo.' });
  }
});

router.patch(
  '/tipos/:id',
  requireEditor(),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};

    if (body.restaurarFluxoPadrao) {
      await aplicarFluxoPadrao(prisma);
      res.json({ ok: true });
      return;
    }

    if (body.salvarFluxoPadraoAtual) {
      const snap = await salvarDiagramaAtualComoPadrao(prisma);
      res.json({ ok: true, padrao: snap });
      return;
    }

    if (body.recalcularMedia) {
      const updated = await atualizarMediaTempoAtividade(id);
      res.json(updated || { id });
      return;
    }

    const preRequisitos = await resolvePreRequisitos(body, false);

    await prisma.tipoAtividade.update({
      where: { id },
      data: {
        ...(body.nome !== undefined
          ? { nome: String(body.nome).trim().toUpperCase() }
          : {}),
        ...(body.ordemPadrao !== undefined
          ? { ordemPadrao: Number(body.ordemPadrao) }
          : {}),
        ...(body.tempoEstimadoMin !== undefined
          ? { tempoEstimadoMin: Number(body.tempoEstimadoMin) }
          : {}),
        ...(body.ativo !== undefined ? { ativo: Boolean(body.ativo) } : {}),
        ...(body.temOpcoesListagem !== undefined
          ? { temOpcoesListagem: Boolean(body.temOpcoesListagem) }
          : {}),
        ...(body.executorPadraoId !== undefined
          ? {
              executorPadraoId: body.executorPadraoId
                ? String(body.executorPadraoId)
                : null,
            }
          : {}),
        ...(body.cor !== undefined
          ? {
              cor: normalizeCorHex(
                body.cor,
                CORES_PADRAO[String(body.nome || '').toUpperCase().trim()] ||
                  COR_ATIVIDADE_FALLBACK
              ),
            }
          : {}),
        ...(preRequisitos !== undefined ? { preRequisitos } : {}),
      },
    });

    if (Array.isArray(body.sucessorIds)) {
      await syncSucessores(id, body.sucessorIds);
    }

    const full = await prisma.tipoAtividade.findUnique({
      where: { id },
      include: {
        sucessores: { include: { destino: true }, orderBy: { ordem: 'asc' } },
      },
    });
    res.json(full);
  })
);

router.delete(
  '/tipos/:id',
  requireEditor(),
  asyncRoute(async (req, res) => {
    const { id } = req.params;

    const n = await prisma.demanda.count({ where: { tipoAtividadeId: id } });
    if (n > 0) {
      await prisma.tipoAtividade.update({ where: { id }, data: { ativo: false } });
      res.json({ ok: true, soft: true });
      return;
    }
    await prisma.tipoAtividade.delete({ where: { id } });
    res.json({ ok: true });
  })
);

export default router;

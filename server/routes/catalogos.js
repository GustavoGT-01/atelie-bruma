import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireSession } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';
import { recalcularTodasMedias } from '../lib/workflow.js';
import { parsePreRequisitos } from '../lib/fluxo-etapas.js';
import { corAtividade } from '../lib/fluxo-padrao.js';

const router = Router();

const sucessorInclude = {
  sucessores: {
    orderBy: { ordem: 'asc' },
    include: {
      destino: {
        select: {
          id: true,
          nome: true,
          temOpcoesListagem: true,
          ativo: true,
          tempoEstimadoMin: true,
          cor: true,
        },
      },
    },
  },
};

router.get(
  '/catalogos',
  requireSession,
  asyncRoute(async (req, res) => {
    // Só recalcula médias quando pedido (?medias=1) — Cadastros precisa de refresh rápido
    if (req.query.medias === '1') {
      await recalcularTodasMedias();
    }

    const [usuarios, produtos, modulacoes, tipos, fluxoOpcoes] = await Promise.all([
      prisma.usuario.findMany({
        where: { ativo: true },
        select: {
          id: true,
          nome: true,
          login: true,
          papel: true,
          tiposAtividade: {
            select: { tipoAtividadeId: true },
          },
        },
        orderBy: { nome: 'asc' },
      }),
      prisma.produto.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
      }),
      prisma.modulacao.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
      }),
      prisma.tipoAtividade.findMany({
        where: { ativo: true },
        orderBy: [{ ordemPadrao: 'asc' }, { nome: 'asc' }],
        include: {
          ...sucessorInclude,
          executorPadrao: { select: { id: true, nome: true } },
        },
      }),
      prisma.fluxoOpcao.findMany({
        where: { ativo: true },
        orderBy: { ordem: 'asc' },
      }),
    ]);

    const byNome = Object.fromEntries(tipos.map((t) => [t.nome.toUpperCase(), t]));

    const tiposComStats = await Promise.all(
      tipos.map(async (t) => {
        const concluidas = await prisma.demanda.count({
          where: { tipoAtividadeId: t.id, status: 'CONCLUIDA' },
        });
        const preNomes = parsePreRequisitos(t.preRequisitos);
        return {
          id: t.id,
          nome: t.nome,
          ordemPadrao: t.ordemPadrao,
          tempoEstimadoMin: t.tempoEstimadoMin,
          ativo: t.ativo,
          temOpcoesListagem: t.temOpcoesListagem,
          cor: corAtividade(t.nome, t.cor),
          executorPadraoId: t.executorPadraoId,
          executorPadrao: t.executorPadrao,
          preRequisitos: preNomes,
          preRequisitoIds: preNomes.map((n) => byNome[n]?.id).filter(Boolean),
          concluidas,
          sucessores: t.sucessores
            .filter((s) => s.destino.ativo)
            .map((s) => ({
              id: s.destino.id,
              nome: s.destino.nome,
              temOpcoesListagem: s.destino.temOpcoesListagem,
              tempoEstimadoMin: s.destino.tempoEstimadoMin,
              cor: corAtividade(s.destino.nome, s.destino.cor),
              ordem: s.ordem,
            })),
        };
      })
    );

    res.json({
      usuarios: usuarios.map((u) => ({
        id: u.id,
        nome: u.nome,
        login: u.login,
        papel: u.papel,
        tipoAtividadeIds: u.tiposAtividade.map((t) => t.tipoAtividadeId),
      })),
      produtos,
      modulacoes,
      tipos: tiposComStats,
      fluxoOpcoes,
    });
  })
);

export default router;

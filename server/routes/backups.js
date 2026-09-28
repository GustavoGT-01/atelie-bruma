import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';

const router = Router();
const somenteAdmin = requireAdmin('Somente administrador');

/**
 * Backup do lote e do catálogo. Substitui o localStorage do protótipo.
 * Usuários ficam de fora: restaurar não pode apagar quem está logado.
 */
async function montarSnapshot() {
  const [
    demandas,
    dependencias,
    apontamentos,
    demandaOpcoes,
    tipos,
    tipoSucessores,
    produtos,
    modulacoes,
    fluxoOpcoes,
  ] = await Promise.all([
    prisma.demanda.findMany(),
    prisma.dependencia.findMany(),
    prisma.apontamento.findMany(),
    prisma.demandaOpcao.findMany(),
    prisma.tipoAtividade.findMany(),
    prisma.tipoSucessor.findMany(),
    prisma.produto.findMany(),
    prisma.modulacao.findMany(),
    prisma.fluxoOpcao.findMany(),
  ]);

  return {
    demandas,
    dependencias,
    apontamentos,
    demandaOpcoes,
    tipos,
    tipoSucessores,
    produtos,
    modulacoes,
    fluxoOpcoes,
  };
}

const resumo = (backup) => ({
  id: backup.id,
  criadoEm: backup.criadoEm.toISOString(),
  demandasCount: backup.demandasCount,
  tiposCount: backup.tiposCount,
});

router.get(
  '/backups',
  somenteAdmin,
  asyncRoute(async (_req, res) => {
    const lista = await prisma.backup.findMany({
      orderBy: { criadoEm: 'desc' },
      select: { id: true, criadoEm: true, demandasCount: true, tiposCount: true },
    });
    res.json(lista.map(resumo));
  })
);

router.post(
  '/backups',
  somenteAdmin,
  asyncRoute(async (req, res) => {
    const snapshot = await montarSnapshot();
    const backup = await prisma.backup.create({
      data: {
        dadosJson: JSON.stringify(snapshot),
        demandasCount: snapshot.demandas.length,
        tiposCount: snapshot.tipos.length,
        criadoPorId: req.session.id,
      },
      select: { id: true, criadoEm: true, demandasCount: true, tiposCount: true },
    });
    res.status(201).json(resumo(backup));
  })
);

router.post(
  '/backups/:id/restaurar',
  somenteAdmin,
  asyncRoute(async (req, res) => {
    const backup = await prisma.backup.findUnique({ where: { id: req.params.id } });
    if (!backup) {
      res.status(404).json({ error: 'Backup não encontrado' });
      return;
    }
    const dados = JSON.parse(backup.dadosJson);
    const usuarios = await prisma.usuario.findMany({ select: { id: true } });
    const idsUsuario = new Set(usuarios.map((u) => u.id));
    const usuarioValido = (id) => (id && idsUsuario.has(id) ? id : null);

    await prisma.$transaction(
      async (tx) => {
        await tx.apontamento.deleteMany();
        await tx.dependencia.deleteMany();
        await tx.demandaOpcao.deleteMany();
        await tx.notificacao.deleteMany();
        await tx.demanda.deleteMany();

        for (const p of dados.produtos || []) {
          await tx.produto.upsert({
            where: { id: p.id },
            update: { nome: p.nome, ativo: p.ativo },
            create: { id: p.id, nome: p.nome, ativo: p.ativo },
          });
        }
        for (const m of dados.modulacoes || []) {
          await tx.modulacao.upsert({
            where: { id: m.id },
            update: { nome: m.nome, ativo: m.ativo },
            create: { id: m.id, nome: m.nome, ativo: m.ativo },
          });
        }
        for (const o of dados.fluxoOpcoes || []) {
          await tx.fluxoOpcao.upsert({
            where: { id: o.id },
            update: {
              codigo: o.codigo,
              nome: o.nome,
              tempoEstimadoMin: o.tempoEstimadoMin,
              ativo: o.ativo,
              ordem: o.ordem,
            },
            create: {
              id: o.id,
              codigo: o.codigo,
              nome: o.nome,
              tempoEstimadoMin: o.tempoEstimadoMin,
              ativo: o.ativo,
              ordem: o.ordem,
            },
          });
        }
        for (const t of dados.tipos || []) {
          const dadosTipo = {
            nome: t.nome,
            ordemPadrao: t.ordemPadrao,
            tempoEstimadoMin: t.tempoEstimadoMin,
            ativo: t.ativo,
            temOpcoesListagem: t.temOpcoesListagem,
            preRequisitos: t.preRequisitos,
            cor: t.cor,
            executorPadraoId: usuarioValido(t.executorPadraoId),
          };
          await tx.tipoAtividade.upsert({
            where: { id: t.id },
            update: dadosTipo,
            create: { id: t.id, ...dadosTipo },
          });
        }
        await tx.tipoSucessor.deleteMany();
        for (const s of dados.tipoSucessores || []) {
          await tx.tipoSucessor.create({
            data: {
              id: s.id,
              origemId: s.origemId,
              destinoId: s.destinoId,
              ordem: s.ordem,
            },
          });
        }

        // Insere sem raizId para não depender da ordem das linhas
        for (const d of dados.demandas || []) {
          await tx.demanda.create({
            data: {
              id: d.id,
              codigo: d.codigo,
              especificacao: d.especificacao,
              observacoes: d.observacoes,
              prioridade: d.prioridade,
              status: d.status,
              conferida: d.conferida,
              dataSolicitacao: d.dataSolicitacao,
              dataConclusao: d.dataConclusao,
              tempoEstimadoMin: d.tempoEstimadoMin,
              progressoPct: d.progressoPct,
              etapasSelecionadas: d.etapasSelecionadas,
              executoresPorEtapa: d.executoresPorEtapa,
              createdAt: d.createdAt,
              criadoPorId: usuarioValido(d.criadoPorId),
              executorId: usuarioValido(d.executorId),
              produtoId: d.produtoId,
              modulacaoId: d.modulacaoId,
              tipoAtividadeId: d.tipoAtividadeId,
            },
          });
        }
        for (const d of dados.demandas || []) {
          if (!d.raizId) continue;
          await tx.demanda.update({
            where: { id: d.id },
            data: { raizId: d.raizId },
          });
        }
        for (const dep of dados.dependencias || []) {
          await tx.dependencia.create({
            data: {
              id: dep.id,
              liberada: dep.liberada,
              liberadaEm: dep.liberadaEm,
              origemId: dep.origemId,
              destinoId: dep.destinoId,
              createdAt: dep.createdAt,
            },
          });
        }
        for (const op of dados.demandaOpcoes || []) {
          await tx.demandaOpcao.create({
            data: {
              id: op.id,
              demandaId: op.demandaId,
              opcaoId: op.opcaoId,
              status: op.status,
            },
          });
        }
        for (const a of dados.apontamentos || []) {
          if (!usuarioValido(a.usuarioId)) continue;
          await tx.apontamento.create({
            data: {
              id: a.id,
              demandaId: a.demandaId,
              demandaOpcaoId: a.demandaOpcaoId,
              usuarioId: a.usuarioId,
              dataHoraInicio: a.dataHoraInicio,
              dataHoraFim: a.dataHoraFim,
              tempoTotalSegundos: a.tempoTotalSegundos,
              motivoParada: a.motivoParada,
              ativo: a.ativo,
              createdAt: a.createdAt,
            },
          });
        }
      },
      { timeout: 60000 }
    );

    res.json({ ok: true });
  })
);

router.delete(
  '/backups/:id',
  somenteAdmin,
  asyncRoute(async (req, res) => {
    await prisma.backup.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

export default router;

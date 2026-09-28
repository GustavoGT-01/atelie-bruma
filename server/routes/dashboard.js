import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireSession } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';
import { startOfDay } from '../lib/format.js';
import { demandaParaExecutarWhere } from '../lib/permissoes.js';
import { resolveAdminUi } from '../lib/modo-ui.js';

const router = Router();

function alertaResumo(demanda) {
  return {
    id: demanda.id,
    codigo: demanda.codigo,
    atividade: demanda.tipoAtividade?.nome || '',
    produto: demanda.produto?.nome || '',
    executor: demanda.executor?.nome || '',
    status: demanda.status,
  };
}

function painelDoLote(lista) {
  const hoje = startOfDay(new Date());
  const limite = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const emAndamento = lista.filter((item) => item.status === 'EM_ANDAMENTO').length;
  const pausadas = lista.filter((item) => item.status === 'PAUSADO').length;
  const liberadas = lista.filter((item) => item.status === 'LIBERADA').length;
  const concluidas = lista.filter((item) => item.status === 'CONCLUIDA').length;
  const concluidasHoje = lista.filter((item) => (
    item.status === 'CONCLUIDA' && item.dataConclusao && new Date(item.dataConclusao) >= hoje
  )).length;
  const total = lista.length;
  const porNome = new Map();
  for (const item of lista) {
    const nome = item.tipoAtividade?.nome || 'Sem tipo';
    if (!porNome.has(nome)) {
      porNome.set(nome, { emAndamento: 0, concluidas: 0, atrasadas: 0, paradas: 0 });
    }
    const linha = porNome.get(nome);
    if (item.status === 'EM_ANDAMENTO') linha.emAndamento += 1;
    if (item.status === 'CONCLUIDA') linha.concluidas += 1;
    if (item.status === 'PAUSADO') linha.paradas += 1;
    if (item.status === 'LIBERADA' || item.status === 'PENDENTE') linha.atrasadas += 1;
  }
  const porExecutor = new Map();
  for (const item of lista) {
    if (item.status !== 'CONCLUIDA' || !item.executor?.nome) continue;
    porExecutor.set(item.executor.nome, (porExecutor.get(item.executor.nome) || 0) + 1);
  }
  const maxConc = Math.max(1, ...porExecutor.values());
  const eficiencia = [...porExecutor.entries()]
    .map(([nome, qtd]) => ({
      nome,
      concluidas: qtd,
      pct: Math.round((qtd / maxConc) * 100),
    }))
    .sort((a, b) => b.concluidas - a.concluidas)
    .slice(0, 6);
  const alertas = lista
    .filter((item) => (
      item.status === 'PAUSADO'
      || (item.status === 'EM_ANDAMENTO' && item.prioridade <= 1)
      || (
        ['LIBERADA', 'EM_ANDAMENTO', 'PAUSADO'].includes(item.status)
        && item.dataSolicitacao
        && new Date(item.dataSolicitacao) < limite
      )
    ))
    .sort((a, b) => (a.prioridade ?? 99) - (b.prioridade ?? 99))
    .slice(0, 8)
    .map(alertaResumo);

  return {
    kpis: {
      emAndamento,
      eficiencia: total === 0 ? 0 : Math.round((concluidas / total) * 100),
      concluidasHoje,
      concluidas,
      gargalos: pausadas + liberadas,
      pausadas,
      liberadas,
      total,
    },
    porAtividade: [...porNome.entries()].map(([nome, valor]) => ({ nome, ...valor })),
    eficiencia,
    alertas,
  };
}

router.get(
  '/dashboard',
  requireSession,
  asyncRoute(async (req, res) => {
    const { adminUi } = await resolveAdminUi(req.session);
    if (!adminUi) {
      const lista = await prisma.demanda.findMany({
        where: demandaParaExecutarWhere(req.session.id),
        include: { produto: true, tipoAtividade: true, executor: true },
      });
      res.json(painelDoLote(lista));
      return;
    }
    const hoje = startOfDay(new Date());

    const [
      emAndamento,
      pausadas,
      liberadas,
      concluidasHoje,
      concluidas,
      total,
      porAtividade,
      porExecutor,
      alertas,
    ] = await Promise.all([
      prisma.demanda.count({ where: { status: 'EM_ANDAMENTO' } }),
      prisma.demanda.count({ where: { status: 'PAUSADO' } }),
      prisma.demanda.count({ where: { status: 'LIBERADA' } }),
      prisma.demanda.count({
        where: { status: 'CONCLUIDA', dataConclusao: { gte: hoje } },
      }),
      prisma.demanda.count({ where: { status: 'CONCLUIDA' } }),
      prisma.demanda.count(),
      prisma.demanda.groupBy({
        by: ['tipoAtividadeId', 'status'],
        _count: true,
      }),
      prisma.demanda.groupBy({
        by: ['executorId'],
        where: { status: 'CONCLUIDA' },
        _count: true,
      }),
      prisma.demanda.findMany({
        where: {
          OR: [
            { status: 'PAUSADO' },
            { status: 'EM_ANDAMENTO', prioridade: { lte: 1 } },
            {
              status: { in: ['LIBERADA', 'EM_ANDAMENTO', 'PAUSADO'] },
              dataSolicitacao: {
                lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          ],
        },
        include: {
          produto: true,
          modulacao: true,
          tipoAtividade: true,
          executor: true,
        },
        take: 8,
        orderBy: { prioridade: 'asc' },
      }),
    ]);

    const tipos = await prisma.tipoAtividade.findMany();
    const tipoMap = Object.fromEntries(tipos.map((t) => [t.id, t.nome]));

    const statusAgg = {};

    for (const row of porAtividade) {
      const nome = row.tipoAtividadeId
        ? tipoMap[row.tipoAtividadeId] || 'Sem tipo'
        : 'Sem tipo';
      if (!statusAgg[nome]) {
        statusAgg[nome] = {
          emAndamento: 0,
          concluidas: 0,
          atrasadas: 0,
          paradas: 0,
        };
      }
      if (row.status === 'EM_ANDAMENTO') statusAgg[nome].emAndamento += row._count;
      if (row.status === 'CONCLUIDA') statusAgg[nome].concluidas += row._count;
      if (row.status === 'PAUSADO') statusAgg[nome].paradas += row._count;
      if (row.status === 'LIBERADA' || row.status === 'PENDENTE')
        statusAgg[nome].atrasadas += row._count;
    }

    const users = await prisma.usuario.findMany({
      where: { papel: { in: ['EXECUTOR', 'PLANEJAMENTO', 'ADMIN'] } },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.nome]));

    const maxConc = Math.max(1, ...porExecutor.map((e) => e._count));
    const eficiencia = porExecutor
      .filter((e) => e.executorId)
      .map((e) => ({
        nome: userMap[e.executorId] || '—',
        concluidas: e._count,
        pct: Math.round((e._count / maxConc) * 100),
      }))
      .sort((a, b) => b.concluidas - a.concluidas)
      .slice(0, 6);

    const eficienciaGeral = total === 0 ? 0 : Math.round((concluidas / total) * 100);

    res.json({
      kpis: {
        emAndamento,
        eficiencia: eficienciaGeral,
        concluidasHoje,
        concluidas,
        gargalos: pausadas + liberadas,
        pausadas,
        liberadas,
        total,
      },
      porAtividade: Object.entries(statusAgg).map(([nome, v]) => ({ nome, ...v })),
      eficiencia,
      alertas: alertas.map(alertaResumo),
    });
  })
);

export default router;

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireSession, requireAdmin } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';
import {
  demandaInclude,
  nextCodigo,
  criarPlanoAguardando,
  aprovarDemandaPendente,
  concluirComoFinalizada,
  iniciarAtividade,
  pausarAtividade,
  finalizarAtividade,
  finalizarOpcaoListagem,
} from '../lib/workflow.js';
import {
  normalizeTipoNome,
  parseExecutoresPorEtapa,
  serializeEtapasSelecionadas,
  serializeExecutoresPorEtapa,
} from '../lib/fluxo-etapas.js';
import { demandaSearchWhere } from '../lib/search.js';
import { parseDateOnly } from '../lib/format.js';
import {
  isAdmin,
  demandaParaExecutarWhere,
  STATUS_PENDENTE_APROVACAO,
  STATUS_REJEITADA,
} from '../lib/permissoes.js';
import { resolveAdminUi } from '../lib/modo-ui.js';

const router = Router();

router.get(
  '/demandas',
  requireSession,
  asyncRoute(async (req, res) => {
    const statusQuery = req.query.status;
    const statusParams = (Array.isArray(statusQuery) ? statusQuery : [statusQuery])
      .filter(Boolean)
      .flatMap((s) => String(s).split(','))
      .filter(Boolean);
    const executorIdParam = req.query.executorId ? String(req.query.executorId) : null;
    const produtoId = req.query.produtoId ? String(req.query.produtoId) : null;
    const q = req.query.q ? String(req.query.q) : null;
    const search = q ? demandaSearchWhere(q) : undefined;
    let statusList = statusParams;
    if (statusList.includes('AGUARDANDO') && !statusList.includes('PENDENTE')) {
      statusList = [...statusList, 'PENDENTE'];
    }

    // Concluídas ocultas por padrão (todos os papéis)
    const statusFilter =
      statusList.length > 0
        ? { status: { in: statusList } }
        : { status: { notIn: ['CONCLUIDA', STATUS_REJEITADA] } };

    const { adminUi } = await resolveAdminUi(req.session);
    // Modo executor (mesmo admin): so as suas. Admin UI: todas.
    const executorFilter = !adminUi
      ? demandaParaExecutarWhere(req.session.id)
      : executorIdParam
        ? { executorId: executorIdParam }
        : undefined;

    const demandas = await prisma.demanda.findMany({
      where: {
        AND: [
          ...(statusFilter ? [statusFilter] : []),
          ...(executorFilter ? [executorFilter] : []),
          ...(produtoId ? [{ produtoId }] : []),
          ...(search ? [search] : []),
        ],
      },
      include: demandaInclude,
      orderBy: [{ prioridade: 'asc' }, { dataSolicitacao: 'desc' }],
    });

    res.json(demandas);
  })
);

router.post(
  '/demandas',
  requireSession,
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const codigo = body.codigo || (await nextCodigo());
    const admin = isAdmin(req.session.papel);

    let produtoId = body.produtoId || null;
    const produtoNome = String(body.produtoNome || '').trim();
    if (produtoNome) {
      const nome = produtoNome.toUpperCase();
      const produto = await prisma.produto.upsert({
        where: { nome },
        update: { ativo: true },
        create: { nome },
      });
      produtoId = produto.id;
    }

    let modulacaoId = body.modulacaoId || null;
    const modulacaoNome = String(body.modulacaoNome || '').trim();
    if (modulacaoNome) {
      const nome = modulacaoNome.toUpperCase();
      const modulacao = await prisma.modulacao.upsert({
        where: { nome },
        update: { ativo: true },
        create: { nome },
      });
      modulacaoId = modulacao.id;
    }

    let tipoNome = '';
    let temOpcoesListagem = false;
    if (body.tipoAtividadeId) {
      const tipo = await prisma.tipoAtividade.findUnique({
        where: { id: body.tipoAtividadeId },
        select: { nome: true, temOpcoesListagem: true },
      });
      tipoNome = (tipo?.nome || '').toUpperCase().trim();
      temOpcoesListagem = Boolean(tipo?.temOpcoesListagem);
    }
    const raizEListagem = tipoNome === 'LISTAGEM' || temOpcoesListagem;

    const executoresMap =
      body.executoresPorEtapa && typeof body.executoresPorEtapa === 'object'
        ? body.executoresPorEtapa
        : {};

    const statusInicial = admin
      ? String(body.status || 'LIBERADA')
      : STATUS_PENDENTE_APROVACAO;

    const demanda = await prisma.demanda.create({
      data: {
        codigo,
        especificacao: String(body.especificacao || ''),
        observacoes: String(body.observacoes || ''),
        prioridade: Number(body.prioridade || 3),
        status: statusInicial,
        conferida: Boolean(body.conferida),
        dataSolicitacao: body.dataSolicitacao
          ? parseDateOnly(String(body.dataSolicitacao)) || new Date()
          : new Date(),
        tempoEstimadoMin: Number(body.tempoEstimadoMin || 60),
        criadoPorId: req.session.id,
        executorId: body.executorId || null,
        produtoId,
        modulacaoId,
        tipoAtividadeId: body.tipoAtividadeId || null,
        etapasSelecionadas: serializeEtapasSelecionadas(
          Array.isArray(body.etapasSelecionadas) ? body.etapasSelecionadas : []
        ),
        executoresPorEtapa: serializeExecutoresPorEtapa(executoresMap),
      },
    });

    // Raiz da árvore = ela mesma
    await prisma.demanda.update({
      where: { id: demanda.id },
      data: { raizId: demanda.id },
    });

    const opcaoIds = Array.isArray(body.opcaoIds) ? body.opcaoIds.filter(Boolean) : [];

    if (opcaoIds.length) {
      const opcoes = await prisma.fluxoOpcao.findMany({
        where: { id: { in: opcaoIds }, ativo: true },
        orderBy: { ordem: 'asc' },
      });
      if (opcoes.length) {
        // Opcoes ficam na raiz para copiar a filha LISTAGEM; texto A–L so na propria Listagem
        await prisma.demandaOpcao.createMany({
          data: opcoes.map((o) => ({ demandaId: demanda.id, opcaoId: o.id })),
        });
        const lista = opcoes.map((o) => `${o.codigo}) ${o.nome}`).join('\n');
        const soma = opcoes.reduce((a, o) => a + o.tempoEstimadoMin, 0);
        const especBase = String(body.especificacao || '').trim();
        const etapas = Array.isArray(body.etapasSelecionadas)
          ? body.etapasSelecionadas.filter(Boolean)
          : [];
        await prisma.demanda.update({
          where: { id: demanda.id },
          data: {
            ...(raizEListagem
              ? {
                  especificacao: especBase
                    ? `${especBase}\n\nProcessos aplicados (LISTAGEM):\n${lista}`
                    : `Processos aplicados (LISTAGEM):\n${lista}`,
                  tempoEstimadoMin: soma,
                }
              : {}),
            observacoes: [
              String(body.observacoes || '').trim(),
              raizEListagem
                ? `Tempo LISTAGEM estimado (soma opções): ${soma} min`
                : etapas.some((e) => String(e).toUpperCase() === 'LISTAGEM')
                  ? `Opções LISTAGEM reservadas para etapa filha (${soma} min)`
                  : null,
              etapas.length ? `Etapas do fluxo: ${etapas.join(', ')}` : null,
              !admin ? 'Aguardando aprovação do administrador' : null,
            ]
              .filter(Boolean)
              .join(' | '),
          },
        });
      }
    } else if (
      Array.isArray(body.etapasSelecionadas) &&
      body.etapasSelecionadas.length
    ) {
      const etapas = body.etapasSelecionadas.filter(Boolean);
      await prisma.demanda.update({
        where: { id: demanda.id },
        data: {
          observacoes: [
            String(body.observacoes || '').trim(),
            `Etapas do fluxo: ${etapas.join(', ')}`,
            !admin ? 'Aguardando aprovação do administrador' : null,
          ]
            .filter(Boolean)
            .join(' | '),
        },
      });
    } else if (!admin) {
      await prisma.demanda.update({
        where: { id: demanda.id },
        data: {
          observacoes: [
            String(body.observacoes || '').trim(),
            'Aguardando aprovação do administrador',
          ]
            .filter(Boolean)
            .join(' | '),
        },
      });
    }

    if (body.dependeDeId) {
      await prisma.dependencia.create({
        data: {
          origemId: body.dependeDeId,
          destinoId: demanda.id,
          liberada: false,
        },
      });
      if (admin) {
        await prisma.demanda.update({
          where: { id: demanda.id },
          data: { status: 'AGUARDANDO' },
        });
      }
    } else if (
      admin &&
      Array.isArray(body.etapasSelecionadas) &&
      body.etapasSelecionadas.length
    ) {
      await criarPlanoAguardando(demanda.id);
    }

    const full = await prisma.demanda.findUnique({
      where: { id: demanda.id },
      include: demandaInclude,
    });

    res.status(201).json(full);
  })
);

router.patch(
  '/demandas/lote',
  requireAdmin('Somente administrador pode editar em lote'),
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const updates = Array.isArray(body.updates) ? body.updates : [];
    if (!updates.length) {
      res.status(400).json({ error: 'Nenhuma alteração' });
      return;
    }

    let ok = 0;
    const erros = [];

    for (const item of updates) {
      if (!item?.id) continue;
      try {
        let produtoId;
        const produtoNome = String(item.produtoNome || '').trim();
        if (produtoNome) {
          const nome = produtoNome.toUpperCase();
          const produto = await prisma.produto.upsert({
            where: { nome },
            update: { ativo: true },
            create: { nome },
          });
          produtoId = produto.id;
        } else if (item.produtoNome === '') {
          produtoId = null;
        }

        let modulacaoId;
        if (item.modulacaoId !== undefined) {
          modulacaoId = item.modulacaoId || null;
        }
        const modulacaoNome = String(item.modulacaoNome || '').trim();
        if (modulacaoNome) {
          const nome = modulacaoNome.toUpperCase();
          const modulacao = await prisma.modulacao.upsert({
            where: { nome },
            update: { ativo: true },
            create: { nome },
          });
          modulacaoId = modulacao.id;
        }

        let executoresPorEtapaUpdate;
        if (item.executorId !== undefined || item.tipoAtividadeId !== undefined) {
          const atual = await prisma.demanda.findUnique({
            where: { id: item.id },
            include: { tipoAtividade: { select: { nome: true } } },
          });
          if (!atual) throw new Error('Não encontrada');
          const tipoId =
            item.tipoAtividadeId !== undefined
              ? item.tipoAtividadeId || null
              : atual.tipoAtividadeId;
          let tipoNome = normalizeTipoNome(atual.tipoAtividade?.nome);
          if (tipoId && tipoId !== atual.tipoAtividadeId) {
            const tipo = await prisma.tipoAtividade.findUnique({
              where: { id: tipoId },
              select: { nome: true },
            });
            tipoNome = normalizeTipoNome(tipo?.nome);
          }
          if (item.executorId !== undefined && tipoNome) {
            const map = parseExecutoresPorEtapa(atual.executoresPorEtapa);
            const novo = item.executorId ? String(item.executorId) : null;
            if (novo) map[tipoNome] = novo;
            else delete map[tipoNome];
            executoresPorEtapaUpdate = serializeExecutoresPorEtapa(map);
          }
        }

        const statusNovo =
          item.status !== undefined ? String(item.status).trim() : undefined;
        const marcarConcluida = statusNovo === 'CONCLUIDA';

        // Demais campos (sem status se for concluir — workflow cuida)
        await prisma.demanda.update({
          where: { id: item.id },
          data: {
            ...(item.especificacao !== undefined
              ? { especificacao: String(item.especificacao) }
              : {}),
            ...(item.prioridade !== undefined
              ? { prioridade: Number(item.prioridade) }
              : {}),
            ...(!marcarConcluida && statusNovo !== undefined
              ? { status: statusNovo }
              : {}),
            ...(item.executorId !== undefined
              ? { executorId: item.executorId || null }
              : {}),
            ...(item.tipoAtividadeId !== undefined
              ? { tipoAtividadeId: item.tipoAtividadeId || null }
              : {}),
            ...(produtoId !== undefined ? { produtoId } : {}),
            ...(modulacaoId !== undefined ? { modulacaoId } : {}),
            ...(item.dataSolicitacao !== undefined
              ? {
                  dataSolicitacao: item.dataSolicitacao
                    ? parseDateOnly(String(item.dataSolicitacao))
                    : null,
                }
              : {}),
            ...(executoresPorEtapaUpdate !== undefined
              ? { executoresPorEtapa: executoresPorEtapaUpdate }
              : {}),
          },
        });

        // CONCLUIDA na planilha = Finalizar (libera proxima demanda)
        if (marcarConcluida) {
          await concluirComoFinalizada(item.id, { conferida: true });
        }

        ok += 1;
      } catch (e) {
        erros.push({
          id: item.id,
          error: e instanceof Error ? e.message : 'Erro',
        });
      }
    }

    res.json({ ok, erros, total: updates.length });
  })
);

router.get(
  '/demandas/:id',
  requireSession,
  asyncRoute(async (req, res) => {
    const demanda = await prisma.demanda.findUnique({
      where: { id: req.params.id },
      include: demandaInclude,
    });
    if (!demanda) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(demanda);
  })
);

router.patch(
  '/demandas/:id',
  requireAdmin('Somente administrador pode alterar ou excluir demandas'),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};

    if (body.aprovar === true) {
      try {
        const full = await aprovarDemandaPendente(id);
        res.json(full);
      } catch (e) {
        res
          .status(400)
          .json({ error: e instanceof Error ? e.message : 'Erro ao aprovar' });
      }
      return;
    }

    if (body.rejeitar === true) {
      const atual = await prisma.demanda.findUnique({ where: { id } });
      if (!atual) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      if (atual.status !== STATUS_PENDENTE_APROVACAO) {
        res.status(400).json({ error: 'Demanda não está aguardando aprovação' });
        return;
      }
      const demanda = await prisma.demanda.update({
        where: { id },
        data: { status: STATUS_REJEITADA },
        include: demandaInclude,
      });
      res.json(demanda);
      return;
    }

    let produtoId;
    if (body.produtoId !== undefined) {
      produtoId = body.produtoId || null;
    }
    const produtoNome = String(body.produtoNome || '').trim();
    if (produtoNome) {
      const nome = produtoNome.toUpperCase();
      const produto = await prisma.produto.upsert({
        where: { nome },
        update: { ativo: true },
        create: { nome },
      });
      produtoId = produto.id;
    }

    let modulacaoId;
    if (body.modulacaoId !== undefined) {
      modulacaoId = body.modulacaoId || null;
    }
    const modulacaoNome = String(body.modulacaoNome || '').trim();
    if (modulacaoNome) {
      const nome = modulacaoNome.toUpperCase();
      const modulacao = await prisma.modulacao.upsert({
        where: { nome },
        update: { ativo: true },
        create: { nome },
      });
      modulacaoId = modulacao.id;
    }

    // Troca de executor: atualiza esta demanda + propaga na arvore (mesma raiz/etapa)
    // para sair do cronograma do usuario antigo.
    let executoresPorEtapaUpdate;
    let propagaExecutor = null;

    if (body.executorId !== undefined) {
      const atual = await prisma.demanda.findUnique({
        where: { id },
        include: { tipoAtividade: { select: { nome: true } } },
      });
      if (!atual) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const tipoId =
        body.tipoAtividadeId !== undefined
          ? body.tipoAtividadeId || null
          : atual.tipoAtividadeId;
      let tipoNome = normalizeTipoNome(atual.tipoAtividade?.nome);
      if (tipoId && tipoId !== atual.tipoAtividadeId) {
        const tipo = await prisma.tipoAtividade.findUnique({
          where: { id: tipoId },
          select: { nome: true },
        });
        tipoNome = normalizeTipoNome(tipo?.nome);
      }
      const map = parseExecutoresPorEtapa(atual.executoresPorEtapa);
      const novoExecutorId = body.executorId ? String(body.executorId) : null;
      if (tipoNome) {
        if (novoExecutorId) map[tipoNome] = novoExecutorId;
        else delete map[tipoNome];
      }
      executoresPorEtapaUpdate = serializeExecutoresPorEtapa(map);
      propagaExecutor = {
        raizId: atual.raizId || atual.id,
        tipoAtividadeId: tipoId,
        tipoNome,
        novoExecutorId,
        mapaSerializado: executoresPorEtapaUpdate,
      };
    }

    const statusNovo =
      body.status !== undefined ? String(body.status).trim() : undefined;
    const marcarConcluida = statusNovo === 'CONCLUIDA';

    const demanda = await prisma.demanda.update({
      where: { id },
      data: {
        ...(body.especificacao !== undefined
          ? { especificacao: String(body.especificacao) }
          : {}),
        ...(body.observacoes !== undefined
          ? { observacoes: String(body.observacoes) }
          : {}),
        ...(body.prioridade !== undefined
          ? { prioridade: Number(body.prioridade) }
          : {}),
        ...(!marcarConcluida && statusNovo !== undefined ? { status: statusNovo } : {}),
        ...(body.conferida !== undefined ? { conferida: Boolean(body.conferida) } : {}),
        ...(body.executorId !== undefined
          ? { executorId: body.executorId || null }
          : {}),
        ...(executoresPorEtapaUpdate !== undefined
          ? { executoresPorEtapa: executoresPorEtapaUpdate }
          : {}),
        ...(produtoId !== undefined ? { produtoId } : {}),
        ...(modulacaoId !== undefined ? { modulacaoId } : {}),
        ...(body.tipoAtividadeId !== undefined
          ? { tipoAtividadeId: body.tipoAtividadeId || null }
          : {}),
        ...(body.tempoEstimadoMin !== undefined
          ? { tempoEstimadoMin: Number(body.tempoEstimadoMin) }
          : {}),
        ...(body.progressoPct !== undefined && !marcarConcluida
          ? { progressoPct: Number(body.progressoPct) }
          : {}),
        ...(body.dataConclusao !== undefined && !marcarConcluida
          ? {
              dataConclusao: body.dataConclusao
                ? parseDateOnly(String(body.dataConclusao))
                : null,
            }
          : {}),
        ...(body.dataSolicitacao !== undefined
          ? {
              dataSolicitacao: body.dataSolicitacao
                ? parseDateOnly(String(body.dataSolicitacao))
                : null,
            }
          : {}),
      },
      include: demandaInclude,
    });

    // CONCLUIDA via edicao = Finalizar (libera sucessores)
    let resposta = demanda;
    if (marcarConcluida) {
      const { demanda: full } = await concluirComoFinalizada(id, {
        conferida: body.conferida !== undefined ? Boolean(body.conferida) : true,
        progressoPct: body.progressoPct !== undefined ? Number(body.progressoPct) : 100,
      });
      resposta = full;
    }

    if (propagaExecutor) {
      const { raizId, tipoAtividadeId, tipoNome, novoExecutorId, mapaSerializado } =
        propagaExecutor;
      const arvore = await prisma.demanda.findMany({
        where: {
          OR: [{ id: raizId }, { raizId }],
          status: { notIn: ['CONCLUIDA', STATUS_REJEITADA] },
          NOT: { id },
        },
        select: {
          id: true,
          executorId: true,
          tipoAtividadeId: true,
          executoresPorEtapa: true,
          tipoAtividade: { select: { nome: true } },
        },
      });

      for (const irma of arvore) {
        const map = parseExecutoresPorEtapa(irma.executoresPorEtapa);
        if (tipoNome) {
          if (novoExecutorId) map[tipoNome] = novoExecutorId;
          else delete map[tipoNome];
        }
        const mesmoTipo =
          (tipoAtividadeId && irma.tipoAtividadeId === tipoAtividadeId) ||
          (tipoNome && normalizeTipoNome(irma.tipoAtividade?.nome) === tipoNome);
        await prisma.demanda.update({
          where: { id: irma.id },
          data: {
            executoresPorEtapa: serializeExecutoresPorEtapa(map) || mapaSerializado,
            ...(mesmoTipo ? { executorId: novoExecutorId } : {}),
          },
        });
      }
    }

    res.json(resposta);
  })
);

router.delete(
  '/demandas/:id',
  requireAdmin('Somente administrador pode alterar ou excluir demandas'),
  asyncRoute(async (req, res) => {
    await prisma.demanda.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

router.post(
  '/demandas/:id/acao',
  requireSession,
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    const action = String(body.action || '');
    const demandaOpcaoId = body.demandaOpcaoId ? String(body.demandaOpcaoId) : null;

    if (action === 'iniciar') {
      const d = await iniciarAtividade(id, req.session.id, { demandaOpcaoId });
      res.json(d);
      return;
    }
    if (action === 'pausar') {
      const d = await pausarAtividade(id, String(body.motivo || 'OUTRO'), {
        demandaOpcaoId,
      });
      res.json(d);
      return;
    }
    if (action === 'finalizarOpcao') {
      if (!demandaOpcaoId) {
        res.status(400).json({ error: 'demandaOpcaoId obrigatório' });
        return;
      }
      const result = await finalizarOpcaoListagem(id, demandaOpcaoId);
      res.json({
        ...result.demanda,
        todasConcluidas: result.todasConcluidas,
        concluidas: result.concluidas,
        total: result.total,
        opcao: result.opcao,
      });
      return;
    }
    // "Zerar cronômetro" existe só no painel do destino: apaga os apontamentos
    // da demanda, já que o tempo é derivado deles.
    if (action === 'zerar') {
      await prisma.apontamento.deleteMany({ where: { demandaId: id } });
      const d = await prisma.demanda.findUnique({
        where: { id },
        include: demandaInclude,
      });
      if (!d) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json(d);
      return;
    }
    if (action === 'finalizar') {
      const result = await finalizarAtividade(id, {
        progressoPct: body.progressoPct,
        conferida: body.conferida,
      });
      res.json({ ...result.demanda, geradas: result.geradas });
      return;
    }
    res.status(400).json({ error: 'Ação inválida' });
  })
);

export default router;

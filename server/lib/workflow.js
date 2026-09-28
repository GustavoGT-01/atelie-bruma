import { prisma } from './prisma.js';
import {
  parseEtapasSelecionadas,
  etapaMarcada,
  parseExecutoresPorEtapa,
  preRequisitosCadastro,
  cadastroNoPlano,
  parsePreRequisitos,
} from './fluxo-etapas.js';

export {
  parseEtapasSelecionadas,
  serializeEtapasSelecionadas,
  parseExecutoresPorEtapa,
  serializeExecutoresPorEtapa,
} from './fluxo-etapas.js';

/** CADASTRO so pelo gate; demais so se houver ligacao TipoSucessor origem→destino. */
async function podeLiberarViaSucessor(origemTipo, destinoTipo) {
  const o = origemTipo.toUpperCase().trim();
  const d = destinoTipo.toUpperCase().trim();
  if (!o || !d) return false;
  if (d === 'CADASTRO') return false;
  const origem = await prisma.tipoAtividade.findFirst({
    where: { nome: o, ativo: true },
    select: { id: true },
  });
  const destino = await prisma.tipoAtividade.findFirst({
    where: { nome: d, ativo: true },
    select: { id: true },
  });
  if (!origem || !destino) return false;
  const link = await prisma.tipoSucessor.findFirst({
    where: { origemId: origem.id, destinoId: destino.id },
  });
  return Boolean(link);
}

async function sucessoresDoTipo(tipoNome) {
  const tipo = await prisma.tipoAtividade.findFirst({
    where: { nome: tipoNome, ativo: true },
    include: {
      sucessores: {
        orderBy: { ordem: 'asc' },
        include: { destino: true },
      },
    },
  });
  if (!tipo) return [];
  return tipo.sucessores
    .filter((s) => s.destino.ativo)
    .map((s) => ({
      nome: s.destino.nome.toUpperCase().trim(),
      temOpcoesListagem: s.destino.temOpcoesListagem,
    }));
}

export async function nextCodigo() {
  const last = await prisma.demanda.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { codigo: true },
  });
  const n = last?.codigo?.match(/DEM-(\d+)/)?.[1];
  const next = (n ? parseInt(n, 10) : 0) + 1;
  return `DEM-${String(next).padStart(5, '0')}`;
}

export async function tempoEfetivoSegundos(demandaId, demandaOpcaoId) {
  const rows = await prisma.apontamento.findMany({
    where: {
      demandaId,
      ...(demandaOpcaoId ? { demandaOpcaoId } : {}),
    },
  });
  let total = 0;
  const now = Date.now();
  for (const a of rows) {
    if (a.dataHoraFim) total += a.tempoTotalSegundos;
    else if (a.ativo) {
      total += Math.floor((now - a.dataHoraInicio.getTime()) / 1000);
    }
  }
  return total;
}

async function fecharApontamentosAbertos(demandaId, opts) {
  const abertos = await prisma.apontamento.findMany({
    where: {
      demandaId,
      ativo: true,
      dataHoraFim: null,
      ...(opts?.demandaOpcaoId ? { demandaOpcaoId: opts.demandaOpcaoId } : {}),
    },
  });
  const fim = new Date();
  for (const aberto of abertos) {
    const secs = Math.floor((fim.getTime() - aberto.dataHoraInicio.getTime()) / 1000);
    await prisma.apontamento.update({
      where: { id: aberto.id },
      data: {
        dataHoraFim: fim,
        tempoTotalSegundos: secs,
        ativo: false,
        ...(opts?.motivo ? { motivoParada: opts.motivo } : {}),
      },
    });
  }
  return abertos.length;
}

export async function iniciarAtividade(demandaId, usuarioId, opts) {
  const demandaOpcaoId = opts?.demandaOpcaoId || null;
  const demanda = await prisma.demanda.findUnique({
    where: { id: demandaId },
    include: { opcoes: true, tipoAtividade: true },
  });
  if (!demanda) throw new Error('Demanda não encontrada');
  if (demanda.status === 'CONCLUIDA') throw new Error('Demanda já concluída');
  if (demanda.status === 'PENDENTE_APROVACAO') {
    throw new Error('Demanda aguardando aprovação do administrador');
  }
  if (demanda.status === 'REJEITADA') {
    throw new Error('Demanda rejeitada — não pode ser iniciada');
  }
  if (demanda.status === 'AGUARDANDO' || demanda.status === 'PENDENTE') {
    throw new Error('Demanda ainda aguardando liberação da etapa anterior');
  }
  if (
    demanda.status !== 'LIBERADA' &&
    demanda.status !== 'PAUSADO' &&
    demanda.status !== 'EM_ANDAMENTO'
  ) {
    throw new Error('Demanda não está liberada para início');
  }

  const tipoNome = (demanda.tipoAtividade?.nome || '').toUpperCase().trim();
  const eListagem =
    tipoNome === 'LISTAGEM' || Boolean(demanda.tipoAtividade?.temOpcoesListagem);
  const temOpcoes = eListagem && (demanda.opcoes || []).length > 0;
  if (temOpcoes && !demandaOpcaoId) {
    throw new Error('Selecione o subprocesso (A–L) para iniciar');
  }
  if (demandaOpcaoId) {
    if (!eListagem) {
      throw new Error('Subprocessos A–L só se aplicam à atividade Listagem');
    }
    const link = await prisma.demandaOpcao.findFirst({
      where: { id: demandaOpcaoId, demandaId },
    });
    if (!link) throw new Error('Subprocesso não pertence a esta demanda');
    if (link.status === 'CONCLUIDA') {
      throw new Error('Subprocesso já concluído');
    }
  }

  // Fecha qualquer timer aberto da demanda (um por vez)
  await fecharApontamentosAbertos(demandaId);

  await prisma.apontamento.create({
    data: {
      demandaId,
      usuarioId,
      dataHoraInicio: new Date(),
      ativo: true,
      demandaOpcaoId: eListagem ? demandaOpcaoId : null,
    },
  });

  if (eListagem && demandaOpcaoId) {
    await prisma.demandaOpcao.update({
      where: { id: demandaOpcaoId },
      data: { status: 'EM_ANDAMENTO' },
    });
  }

  return prisma.demanda.update({
    where: { id: demandaId },
    data: {
      status: 'EM_ANDAMENTO',
      executorId: usuarioId,
    },
    include: demandaInclude,
  });
}

/** Aprova demanda criada por nao-admin: libera plano / status de trabalho. */
export async function aprovarDemandaPendente(demandaId) {
  const demanda = await prisma.demanda.findUnique({
    where: { id: demandaId },
    include: { depsComoDestino: true },
  });
  if (!demanda) throw new Error('Demanda não encontrada');
  if (demanda.status !== 'PENDENTE_APROVACAO') {
    throw new Error('Demanda não está aguardando aprovação');
  }

  const etapas = parseEtapasSelecionadas(demanda.etapasSelecionadas);

  if (demanda.depsComoDestino.length > 0) {
    await prisma.demanda.update({
      where: { id: demandaId },
      data: { status: 'AGUARDANDO' },
    });
  } else if (etapas.length > 0) {
    await prisma.demanda.update({
      where: { id: demandaId },
      data: { status: 'LIBERADA' },
    });
    await criarPlanoAguardando(demandaId);
  } else {
    await prisma.demanda.update({
      where: { id: demandaId },
      data: { status: 'LIBERADA' },
    });
  }

  return prisma.demanda.findUnique({
    where: { id: demandaId },
    include: demandaInclude,
  });
}

export async function pausarAtividade(demandaId, motivo, opts) {
  const demandaOpcaoId = opts?.demandaOpcaoId || null;
  const aberto = await prisma.apontamento.findFirst({
    where: {
      demandaId,
      ativo: true,
      dataHoraFim: null,
      ...(demandaOpcaoId ? { demandaOpcaoId } : {}),
    },
    orderBy: { dataHoraInicio: 'desc' },
  });
  if (!aberto) throw new Error('Nenhuma atividade em andamento');

  await fecharApontamentosAbertos(demandaId, {
    demandaOpcaoId: aberto.demandaOpcaoId,
    motivo,
  });

  if (aberto.demandaOpcaoId) {
    await prisma.demandaOpcao.update({
      where: { id: aberto.demandaOpcaoId },
      data: { status: 'PAUSADO' },
    });
  }

  return prisma.demanda.update({
    where: { id: demandaId },
    data: { status: 'PAUSADO' },
    include: demandaInclude,
  });
}

/**
 * Finaliza um subprocesso LISTAGEM (A-L).
 * Quando todos estiverem CONCLUIDA, a demanda pode ser finalizada.
 */
export async function finalizarOpcaoListagem(demandaId, demandaOpcaoId) {
  const demandaTipo = await prisma.demanda.findUnique({
    where: { id: demandaId },
    include: { tipoAtividade: true },
  });
  if (!demandaTipo) throw new Error('Demanda não encontrada');
  const tipoNome = (demandaTipo.tipoAtividade?.nome || '').toUpperCase().trim();
  const eListagem =
    tipoNome === 'LISTAGEM' || Boolean(demandaTipo.tipoAtividade?.temOpcoesListagem);
  if (!eListagem) {
    throw new Error('Subprocessos A–L só se aplicam à atividade Listagem');
  }

  const link = await prisma.demandaOpcao.findFirst({
    where: { id: demandaOpcaoId, demandaId },
    include: { opcao: true },
  });
  if (!link) throw new Error('Subprocesso não encontrado');
  if (link.status === 'CONCLUIDA') {
    throw new Error('Subprocesso já concluído');
  }

  await fecharApontamentosAbertos(demandaId, { demandaOpcaoId });

  await prisma.demandaOpcao.update({
    where: { id: demandaOpcaoId },
    data: { status: 'CONCLUIDA' },
  });

  await atualizarMediaTempoOpcao(link.opcaoId);

  const opcoes = await prisma.demandaOpcao.findMany({ where: { demandaId } });
  const concluidas = opcoes.filter((o) => o.status === 'CONCLUIDA').length;
  const progressoPct =
    opcoes.length > 0 ? Math.round((concluidas / opcoes.length) * 100) : 0;

  const todasConcluidas =
    opcoes.length > 0 && opcoes.every((o) => o.status === 'CONCLUIDA');

  // Atualiza progresso; se ainda houver etapas, deixa EM_ANDAMENTO/PAUSADO
  const demanda = await prisma.demanda.update({
    where: { id: demandaId },
    data: { progressoPct },
    include: demandaInclude,
  });

  return {
    demanda,
    opcao: link.opcao,
    todasConcluidas,
    concluidas,
    total: opcoes.length,
  };
}

async function ensureTipo(nome) {
  return prisma.tipoAtividade.upsert({
    where: { nome },
    update: { ativo: true },
    create: { nome, tempoEstimadoMin: 60 },
  });
}

async function resolverExecutor(tipoNome, executoresPorEtapa, tipoId) {
  const t = tipoNome.toUpperCase().trim();
  if (executoresPorEtapa[t]) return executoresPorEtapa[t];
  if (tipoId) {
    const tipo = await prisma.tipoAtividade.findUnique({
      where: { id: tipoId },
      select: { executorPadraoId: true },
    });
    if (tipo?.executorPadraoId) return tipo.executorPadraoId;
  }
  const tipo = await prisma.tipoAtividade.findFirst({
    where: { nome: t, ativo: true },
    select: { executorPadraoId: true },
  });
  return tipo?.executorPadraoId || null;
}

/** Cria demanda filha. AGUARDANDO até origem concluir; LIBERADA se origem já CONCLUIDA. */
export async function criarDemandaFilha(opts) {
  const origem = await prisma.demanda.findUnique({
    where: { id: opts.origemId },
    include: {
      produto: true,
      tipoAtividade: true,
      opcoes: { include: { opcao: true } },
    },
  });
  if (!origem) throw new Error('Demanda origem não encontrada');

  const tipo = await ensureTipo(opts.tipoNome);
  const raizId = opts.raizId ?? origem.raizId ?? origem.id;
  const executores = parseExecutoresPorEtapa(origem.executoresPorEtapa);
  const executorId = await resolverExecutor(opts.tipoNome, executores, tipo.id);

  const liberar = opts.liberarAgora === true || origem.status === 'CONCLUIDA';

  // Já existe filha deste tipo a partir desta origem?
  const existente = await prisma.dependencia.findFirst({
    where: {
      origemId: origem.id,
      destino: { tipoAtividadeId: tipo.id },
    },
    include: { destino: true },
  });
  if (existente) {
    if (
      liberar &&
      (existente.destino.status === 'AGUARDANDO' ||
        existente.destino.status === 'PENDENTE')
    ) {
      await tentarLiberarDestino(existente.destinoId, origem.codigo);
      return prisma.demanda.findUniqueOrThrow({
        where: { id: existente.destinoId },
      });
    }
    return existente.destino;
  }

  const naArvore = await prisma.demanda.findFirst({
    where: {
      OR: [{ id: raizId }, { raizId }],
      tipoAtividadeId: tipo.id,
    },
  });
  if (naArvore) {
    // Garante vinculo + liberacao se origem ja concluiu e demais deps ok
    const dep = await prisma.dependencia.findFirst({
      where: { origemId: origem.id, destinoId: naArvore.id },
    });
    if (!dep) {
      await prisma.dependencia.create({
        data: {
          origemId: origem.id,
          destinoId: naArvore.id,
          liberada: liberar,
          liberadaEm: liberar ? new Date() : null,
        },
      });
    } else if (liberar && !dep.liberada) {
      await prisma.dependencia.update({
        where: { id: dep.id },
        data: { liberada: true, liberadaEm: new Date() },
      });
    }
    if (liberar && (naArvore.status === 'AGUARDANDO' || naArvore.status === 'PENDENTE')) {
      await tentarLiberarDestino(naArvore.id, origem.codigo);
      return prisma.demanda.findUniqueOrThrow({ where: { id: naArvore.id } });
    }
    return naArvore;
  }

  let tempo = opts.tempoEstimadoMin ?? tipo.tempoEstimadoMin;

  // Especificacao da solicitacao pai (raiz) — mesma em todos os filhos
  let especRaiz = (origem.especificacao || '').trim();
  if (raizId && raizId !== origem.id) {
    const raizDemanda = await prisma.demanda.findUnique({
      where: { id: raizId },
      select: { especificacao: true },
    });
    if (raizDemanda?.especificacao?.trim()) {
      especRaiz = raizDemanda.especificacao.trim();
    }
  }
  const espec =
    especRaiz ||
    (opts.especificacao || '').trim() ||
    `${opts.tipoNome} — gerada a partir de ${origem.codigo}` +
      (origem.produto ? ` (${origem.produto.nome})` : '');

  if (opts.copiarOpcoes && origem.opcoes.length) {
    tempo = origem.opcoes.reduce((acc, o) => acc + o.opcao.tempoEstimadoMin, 0);
    if (tempo <= 0) tempo = tipo.tempoEstimadoMin;
  }

  const codigo = await nextCodigo();
  const filha = await prisma.demanda.create({
    data: {
      codigo,
      especificacao: espec,
      observacoes: liberar
        ? `Gerada automaticamente por ${origem.codigo}`
        : `Aguardando conclusão de ${origem.codigo}`,
      prioridade: origem.prioridade,
      status: liberar ? 'LIBERADA' : 'AGUARDANDO',
      dataSolicitacao: origem.dataSolicitacao || new Date(),
      tempoEstimadoMin: tempo,
      produtoId: origem.produtoId,
      modulacaoId: origem.modulacaoId,
      tipoAtividadeId: tipo.id,
      etapasSelecionadas: origem.etapasSelecionadas || '[]',
      executoresPorEtapa: origem.executoresPorEtapa || '{}',
      raizId,
      executorId,
    },
  });

  await prisma.dependencia.create({
    data: {
      origemId: origem.id,
      destinoId: filha.id,
      liberada: liberar,
      liberadaEm: liberar ? new Date() : null,
    },
  });

  if (opts.copiarOpcoes && origem.opcoes.length) {
    await prisma.demandaOpcao.createMany({
      data: origem.opcoes.map((o) => ({
        demandaId: filha.id,
        opcaoId: o.opcaoId,
      })),
    });
  }

  if (liberar && executorId) {
    await prisma.notificacao.create({
      data: {
        usuarioId: executorId,
        demandaId: filha.id,
        mensagem: `Demanda ${filha.codigo} (${opts.tipoNome}) liberada após ${origem.codigo}`,
      },
    });
  }

  return filha;
}

async function liberarDemanda(demandaId, origemCodigo) {
  const d = await prisma.demanda.update({
    where: { id: demandaId },
    data: { status: 'LIBERADA' },
  });
  await prisma.dependencia.updateMany({
    where: { destinoId: demandaId, liberada: false },
    data: { liberada: true, liberadaEm: new Date() },
  });
  if (d.executorId) {
    await prisma.notificacao.create({
      data: {
        usuarioId: d.executorId,
        demandaId: d.id,
        mensagem: `Demanda ${d.codigo} liberada apos conclusao de ${origemCodigo}`,
      },
    });
  }
  return d;
}

function aliasesTipo(nome) {
  const n = nome.toUpperCase().trim();
  if (n === 'RECORTES') return ['RECORTES', 'RECORTE'];
  if (n === 'TABELA') return ['TABELA', 'TABELA DE PRECO', 'TABELA DE PREÇO'];
  return [n];
}

async function preRequisitosConfiguradosDoTipo(tipoNome) {
  const tipo = await prisma.tipoAtividade.findFirst({
    where: { nome: tipoNome.toUpperCase().trim(), ativo: true },
    select: { preRequisitos: true },
  });
  return parsePreRequisitos(tipo?.preRequisitos);
}

/**
 * Libera destino so se TODAS as dependencias de entrada tiverem origem CONCLUIDA
 * e os pre-requisitos de tipo (ex. CADASTRO) estiverem ok.
 * CADASTRO nunca libera por esta via — so pelo avaliarGateCadastro.
 */
async function tentarLiberarDestino(destinoId, origemCodigo, opts) {
  const destino = await prisma.demanda.findUnique({
    where: { id: destinoId },
    include: {
      tipoAtividade: true,
      depsComoDestino: { include: { origem: true } },
    },
  });
  if (!destino) return null;
  if (destino.status !== 'AGUARDANDO' && destino.status !== 'PENDENTE') {
    return null;
  }

  const tipoNome = (destino.tipoAtividade?.nome || '').toUpperCase().trim();
  if (tipoNome === 'CADASTRO' && !opts?.forcarCadastro) {
    return null;
  }

  const depsPendentes = destino.depsComoDestino.filter(
    (d) => d.origem.status !== 'CONCLUIDA'
  );
  if (depsPendentes.length > 0) return null;

  if (tipoNome && tipoNome !== 'CADASTRO') {
    const pre = await preRequisitosConfiguradosDoTipo(tipoNome);
    if (pre.length) {
      const raizId = destino.raizId || destino.id;
      const arvore = await prisma.demanda.findMany({
        where: { OR: [{ id: raizId }, { raizId }] },
        include: { tipoAtividade: true },
      });
      const ok = pre.every((req) => {
        const aliases = aliasesTipo(req);
        return arvore.some(
          (d) =>
            d.status === 'CONCLUIDA' &&
            aliases.includes((d.tipoAtividade?.nome || '').toUpperCase().trim())
        );
      });
      if (!ok) return null;
    }
  }

  return liberarDemanda(destinoId, origemCodigo);
}

/**
 * Cria o plano ticado como AGUARDANDO no momento da criação da raiz.
 * Liberado etapa a etapa quando a anterior concluir.
 */
export async function criarPlanoAguardando(raizId) {
  const raiz = await prisma.demanda.findUnique({
    where: { id: raizId },
    include: {
      produto: true,
      tipoAtividade: true,
      opcoes: { include: { opcao: true } },
    },
  });
  if (!raiz) return [];

  const etapas = parseEtapasSelecionadas(raiz.etapasSelecionadas);
  if (!etapas.length) return [];

  const criadas = [];
  const byTipo = new Map(); // tipoNome -> demandaId
  byTipo.set((raiz.tipoAtividade?.nome || '').toUpperCase().trim(), raiz.id);

  const add = async (tipoNome, origemId, extra) => {
    if (!etapaMarcada(etapas, tipoNome) && tipoNome !== 'ENCAIXE') return null;
    if (
      tipoNome === 'ENCAIXE' &&
      !etapaMarcada(etapas, 'ENCAIXE') &&
      !etapaMarcada(etapas, 'MODELAGEM')
    )
      return null;
    if (
      tipoNome === 'CADASTRO' ||
      ['CONFERENCIA', 'TABELA', 'FICHA TECNICA'].includes(tipoNome)
    ) {
      // So cria se a etapa estiver marcada no plano
      if (!etapaMarcada(etapas, tipoNome)) return null;
    }

    const f = await criarDemandaFilha({
      origemId,
      tipoNome,
      raizId,
      liberarAgora: false,
      copiarOpcoes: extra?.copiarOpcoes,
    });
    byTipo.set(tipoNome, f.id);
    if (!criadas.some((c) => c.codigo === f.codigo)) {
      criadas.push({ codigo: f.codigo, tipo: tipoNome });
    }
    return f;
  };

  // Cadeia do diagrama: cria etapas marcadas na ordem do fluxograma
  // (ex. Comercial → 3D → Recortes/Listagem/Modelagem → …)
  const raizTipo = (raiz.tipoAtividade?.nome || '').toUpperCase().trim();
  let progresso = true;
  let guard = 0;
  while (progresso && guard < 40) {
    progresso = false;
    guard += 1;
    const snapshot = [...byTipo.entries()];
    for (const [tipoAtual, origemId] of snapshot) {
      const filhos = await sucessoresDoTipo(tipoAtual);
      for (const f of filhos) {
        const nome = f.nome.toUpperCase().trim();
        if (byTipo.has(nome)) continue;
        if (nome === 'CADASTRO') continue; // gate separado
        if (['CONFERENCIA', 'TABELA', 'FICHA TECNICA'].includes(nome)) {
          // So via cadeia pos-cadastro
          continue;
        }
        const marcada =
          etapaMarcada(etapas, nome) ||
          (nome === 'ENCAIXE' && etapaMarcada(etapas, 'MODELAGEM'));
        if (!marcada) continue;
        await add(nome, origemId, {
          copiarOpcoes: Boolean(f.temOpcoesListagem) || nome === 'LISTAGEM',
        });
        progresso = true;
      }
    }
  }

  // Pos-gate: Cadastro aguarda pre-requisitos — cria AGUARDANDO;
  // liga Dependencia a cada pre-req (LISTAGEM/RECORTES/ENCAIXE), nao a raiz.
  // So libera via avaliarGateCadastro quando todos pre-reqs concluidos.

  if (etapaMarcada(etapas, 'CADASTRO') || raizTipo === 'CADASTRO') {
    const cadTipo = await ensureTipo('CADASTRO');
    const preCfg = parsePreRequisitos(
      (
        await prisma.tipoAtividade.findUnique({
          where: { id: cadTipo.id },
          select: { preRequisitos: true },
        })
      )?.preRequisitos
    );
    const requisitos = preRequisitosCadastro(etapas, preCfg);

    let cadId = byTipo.get('CADASTRO');
    if (raizTipo === 'CADASTRO') {
      cadId = raiz.id;
      byTipo.set('CADASTRO', raiz.id);
    } else if (!cadId) {
      const origemCadastro = requisitos.map((r) => byTipo.get(r)).find(Boolean) || raiz.id;

      const cad = await criarDemandaFilha({
        origemId: origemCadastro,
        tipoNome: 'CADASTRO',
        raizId,
        liberarAgora: false,
      });
      cadId = cad.id;
      byTipo.set('CADASTRO', cad.id);
      criadas.push({ codigo: cad.codigo, tipo: 'CADASTRO' });
    }

    // Garante Dependencia de cada pre-req -> CADASTRO
    for (const reqNome of requisitos) {
      const origemId = byTipo.get(reqNome);
      if (!origemId || !cadId) continue;
      const ja = await prisma.dependencia.findFirst({
        where: { origemId, destinoId: cadId },
      });
      if (!ja) {
        await prisma.dependencia.create({
          data: {
            origemId,
            destinoId: cadId,
            liberada: false,
          },
        });
      }
    }

    let prev = cadId;
    for (const nome of ['CONFERENCIA', 'TABELA', 'FICHA TECNICA']) {
      // So cria o que estiver marcado no plano
      if (!etapaMarcada(etapas, nome)) continue;
      if (byTipo.has(nome)) {
        prev = byTipo.get(nome);
        continue;
      }
      const f = await criarDemandaFilha({
        origemId: prev,
        tipoNome: nome,
        raizId,
        liberarAgora: false,
      });
      byTipo.set(nome, f.id);
      criadas.push({ codigo: f.codigo, tipo: nome });
      prev = f.id;
    }
  }

  // Raiz CONFERENCIA: gera TABELA → FICHA se marcadas
  if (raizTipo === 'CONFERENCIA') {
    byTipo.set('CONFERENCIA', raiz.id);
    let prev = raiz.id;
    for (const nome of ['TABELA', 'FICHA TECNICA']) {
      if (!etapaMarcada(etapas, nome)) continue;
      if (byTipo.has(nome)) {
        prev = byTipo.get(nome);
        continue;
      }
      const f = await criarDemandaFilha({
        origemId: prev,
        tipoNome: nome,
        raizId,
        liberarAgora: false,
      });
      byTipo.set(nome, f.id);
      criadas.push({ codigo: f.codigo, tipo: nome });
      prev = f.id;
    }
  }

  // Raiz TABELA: gera FICHA se marcada
  if (
    (raizTipo === 'TABELA' || raizTipo === 'TABELA DE PREÇO') &&
    etapaMarcada(etapas, 'FICHA TECNICA') &&
    !byTipo.has('FICHA TECNICA')
  ) {
    const f = await criarDemandaFilha({
      origemId: raiz.id,
      tipoNome: 'FICHA TECNICA',
      raizId,
      liberarAgora: false,
    });
    byTipo.set('FICHA TECNICA', f.id);
    criadas.push({ codigo: f.codigo, tipo: 'FICHA TECNICA' });
  }

  return criadas;
}

/**
 * Avalia gate do CADASTRO: todos os pré-requisitos ticados no plano
 * (RECORTES / ENCAIXE / LISTAGEM) devem estar CONCLUIDA na árvore.
 */
export async function avaliarGateCadastro(demandaId) {
  const demanda = await prisma.demanda.findUnique({
    where: { id: demandaId },
    include: { tipoAtividade: true, produto: true },
  });
  if (!demanda) return null;

  const raizId = demanda.raizId || demanda.id;
  const raiz = await prisma.demanda.findUnique({ where: { id: raizId } });
  if (!raiz) return null;

  const plano = parseEtapasSelecionadas(
    raiz.etapasSelecionadas || demanda.etapasSelecionadas
  );
  if (!cadastroNoPlano(plano)) return null;

  const preCfg = await preRequisitosConfiguradosDoTipo('CADASTRO');
  const requisitos = preRequisitosCadastro(plano, preCfg);
  // Sem pre-requisitos no plano: se a propria demanda concluida for LISTAGEM
  // (entrada direta), ainda assim libera Cadastro.
  const tipoAtual = (demanda.tipoAtividade?.nome || '').toUpperCase().trim();
  const reqEfetivos =
    requisitos.length > 0 ? requisitos : tipoAtual === 'LISTAGEM' ? ['LISTAGEM'] : [];
  if (!reqEfetivos.length) return null;

  const arvore = await prisma.demanda.findMany({
    where: { OR: [{ id: raizId }, { raizId }] },
    include: { tipoAtividade: true },
  });

  const tipoConcluido = (nome) => {
    const aliases = aliasesTipo(nome);
    return arvore.some(
      (d) =>
        d.status === 'CONCLUIDA' &&
        aliases.includes((d.tipoAtividade?.nome || '').toUpperCase().trim())
    );
  };

  if (!reqEfetivos.every((r) => tipoConcluido(r))) return null;

  if (
    arvore.some((d) => (d.tipoAtividade?.nome || '').toUpperCase().trim() === 'CADASTRO')
  ) {
    const cad = arvore.find(
      (d) => (d.tipoAtividade?.nome || '').toUpperCase().trim() === 'CADASTRO'
    );
    if (cad && (cad.status === 'AGUARDANDO' || cad.status === 'PENDENTE')) {
      await liberarDemanda(cad.id, demanda.codigo);
      return { codigo: cad.codigo, tipo: 'CADASTRO' };
    }
    return null;
  }

  const filha = await criarDemandaFilha({
    origemId: demanda.id,
    tipoNome: 'CADASTRO',
    raizId,
    liberarAgora: true,
  });

  return { codigo: filha.codigo, tipo: 'CADASTRO' };
}

/**
 * Gera filhas conforme sucessores diretos + etapas ticadas.
 * CADASTRO não é gerado aqui — só via avaliarGateCadastro.
 */
export async function gerarDemandasEncadeadas(demandaId) {
  const demanda = await prisma.demanda.findUnique({
    where: { id: demandaId },
    include: {
      tipoAtividade: true,
      produto: true,
      opcoes: { include: { opcao: true } },
    },
  });
  if (!demanda?.tipoAtividade) return [];

  const tipo = demanda.tipoAtividade.nome.toUpperCase().trim();
  const etapas = parseEtapasSelecionadas(demanda.etapasSelecionadas);
  const temOpcoesAJ = demanda.opcoes.length > 0;
  const criadas = [];
  const raizId = demanda.raizId || demanda.id;

  const push = async (tipoNome, extra) => {
    if (tipoNome === 'CADASTRO') return; // só via gate
    const f = await criarDemandaFilha({
      origemId: demanda.id,
      tipoNome,
      tempoEstimadoMin: extra?.tempo,
      copiarOpcoes: extra?.copiarOpcoes,
      raizId,
      liberarAgora: true,
    });
    if (!criadas.some((c) => c.codigo === f.codigo && c.tipo === tipoNome)) {
      criadas.push({ codigo: f.codigo, tipo: tipoNome });
    }
  };

  const processar = async (destino) => {
    const t = destino.nome.toUpperCase().trim();
    if (t === 'CADASTRO') return;

    // Bloqueia liberacao sem ligacao no diagrama (TipoSucessor)
    if (!(await podeLiberarViaSucessor(tipo, t))) return;

    const deve =
      destino.temOpcoesListagem || t === 'LISTAGEM'
        ? temOpcoesAJ || etapaMarcada(etapas, t)
        : etapaMarcada(etapas, t);

    const tNorm = t === 'TABELA DE PREÇO' || t === 'TABELA DE PRECO' ? 'TABELA' : t;
    const cadeiaLinear = [
      'CONFERENCIA',
      'TABELA',
      'FICHA TECNICA',
      'TABELA DE PRECO',
      'TABELA DE PREÇO',
    ];
    const deveLinear = cadeiaLinear.includes(t) && etapaMarcada(etapas, tNorm);

    if (!deve && !deveLinear) {
      return;
    }

    if (destino.temOpcoesListagem || t === 'LISTAGEM') {
      await push(t, { copiarOpcoes: demanda.opcoes.length > 0 });
      return;
    }

    await push(t === 'TABELA DE PREÇO' || t === 'TABELA DE PRECO' ? 'TABELA' : t);
  };

  const filhos = await sucessoresDoTipo(tipo);
  for (const f of filhos) await processar(f);

  // Gate Cadastro
  const gate = await avaliarGateCadastro(demandaId);
  if (gate) criadas.push(gate);

  return criadas;
}

/** Libera dependencias/sucessores + gera encadeadas (pos CONCLUIDA). */
export async function liberarAposConclusao(demandaId) {
  const demanda = await prisma.demanda.findUnique({
    where: { id: demandaId },
    include: demandaInclude,
  });
  if (!demanda || demanda.status !== 'CONCLUIDA') {
    return { geradas: [] };
  }

  const deps = await prisma.dependencia.findMany({
    where: { origemId: demandaId, liberada: false },
    include: {
      destino: { include: { executor: true, tipoAtividade: true } },
    },
  });

  const origemTipo = (demanda.tipoAtividade?.nome || '').toUpperCase().trim();

  for (const dep of deps) {
    const destTipo = (dep.destino.tipoAtividade?.nome || '').toUpperCase().trim();

    await prisma.dependencia.update({
      where: { id: dep.id },
      data: { liberada: true, liberadaEm: new Date() },
    });

    if (destTipo === 'CADASTRO') continue;
    if (!(await podeLiberarViaSucessor(origemTipo, destTipo))) continue;

    await tentarLiberarDestino(dep.destinoId, demanda.codigo);
  }

  const geradas = await gerarDemandasEncadeadas(demandaId);

  if (demanda.tipoAtividadeId) {
    await atualizarMediaTempoAtividade(demanda.tipoAtividadeId);
  }

  const tipoNome = origemTipo;
  const eListagem =
    tipoNome === 'LISTAGEM' || Boolean(demanda.tipoAtividade?.temOpcoesListagem);
  if (eListagem) {
    for (const o of demanda.opcoes || []) {
      await atualizarMediaTempoOpcao(o.opcaoId);
    }
  }

  return { geradas };
}

export async function finalizarAtividade(demandaId, opts) {
  const atual = await prisma.demanda.findUnique({
    where: { id: demandaId },
    include: { opcoes: true, tipoAtividade: true },
  });
  if (!atual) throw new Error('Demanda não encontrada');
  if (atual.status === 'CONCLUIDA') throw new Error('Demanda já concluída');

  const tipoNome = (atual.tipoAtividade?.nome || '').toUpperCase().trim();
  const eListagem =
    tipoNome === 'LISTAGEM' || Boolean(atual.tipoAtividade?.temOpcoesListagem);

  // So LISTAGEM exige todos A–L concluidos; demais atividades finalizam direto
  if (!opts?.forcarAdmin && eListagem && (atual.opcoes || []).length > 0) {
    const pendentes = atual.opcoes.filter((o) => o.status !== 'CONCLUIDA');
    if (pendentes.length > 0) {
      throw new Error(
        `Finalize todos os subprocessos da Listagem antes (${pendentes.length} pendente(s))`
      );
    }
  }

  await fecharApontamentosAbertos(demandaId);

  await prisma.demanda.update({
    where: { id: demandaId },
    data: {
      status: 'CONCLUIDA',
      dataConclusao: new Date(),
      progressoPct: opts?.progressoPct ?? 100,
      conferida: opts?.conferida ?? false,
    },
  });

  const { geradas } = await liberarAposConclusao(demandaId);

  const full = await prisma.demanda.findUnique({
    where: { id: demandaId },
    include: demandaInclude,
  });

  return { demanda: full, geradas };
}

/**
 * CONCLUIDA na planilha/admin = mesmo efeito de Finalizar no painel.
 * Se ja estava CONCLUIDA sem liberar sucessores, repara liberando agora.
 */
export async function concluirComoFinalizada(demandaId, opts) {
  const atual = await prisma.demanda.findUnique({
    where: { id: demandaId },
    select: { status: true },
  });
  if (!atual) throw new Error('Demanda não encontrada');

  if (atual.status === 'CONCLUIDA') {
    const { geradas } = await liberarAposConclusao(demandaId);
    const full = await prisma.demanda.findUnique({
      where: { id: demandaId },
      include: demandaInclude,
    });
    return { demanda: full, geradas, jaConcluida: true };
  }

  return {
    ...(await finalizarAtividade(demandaId, {
      progressoPct: opts?.progressoPct ?? 100,
      conferida: opts?.conferida ?? true,
      forcarAdmin: true,
    })),
    jaConcluida: false,
  };
}

/**
 * Media historica do subprocesso LISTAGEM (A-L) → FluxoOpcao.tempoEstimadoMin
 */
export async function atualizarMediaTempoOpcao(opcaoId) {
  const links = await prisma.demandaOpcao.findMany({
    where: { opcaoId, status: 'CONCLUIDA' },
    include: { apontamentos: true },
  });

  const minutos = [];
  for (const link of links) {
    const secs = link.apontamentos.reduce((acc, a) => acc + (a.tempoTotalSegundos || 0), 0);
    if (secs > 0) minutos.push(Math.max(1, Math.round(secs / 60)));
  }
  if (!minutos.length) return null;

  const media = Math.max(
    1,
    Math.round(minutos.reduce((a, b) => a + b, 0) / minutos.length)
  );
  await prisma.fluxoOpcao.update({
    where: { id: opcaoId },
    data: { tempoEstimadoMin: media },
  });
  return media;
}

/** Recalcula tempo estimado do tipo pela média real das demandas concluídas. */
export async function atualizarMediaTempoAtividade(tipoAtividadeId) {
  const concluidas = await prisma.demanda.findMany({
    where: { tipoAtividadeId, status: 'CONCLUIDA' },
    include: { apontamentos: true },
  });

  const minutos = [];
  for (const d of concluidas) {
    const apontados = d.apontamentos.reduce(
      (acc, a) => acc + (a.tempoTotalSegundos || 0),
      0
    );
    if (apontados > 0) {
      minutos.push(Math.max(1, Math.round(apontados / 60)));
      continue;
    }
    if (d.dataSolicitacao && d.dataConclusao) {
      const diffMs = d.dataConclusao.getTime() - d.dataSolicitacao.getTime();
      if (diffMs > 0) {
        const mins = Math.round(diffMs / 60000);
        if (mins > 0 && mins <= 480) minutos.push(mins);
        else if (mins > 480) minutos.push(Math.min(480, Math.round(mins / 8)));
      }
    }
  }

  if (!minutos.length) return null;

  const media = Math.max(
    1,
    Math.round(minutos.reduce((a, b) => a + b, 0) / minutos.length)
  );

  return prisma.tipoAtividade.update({
    where: { id: tipoAtividadeId },
    data: { tempoEstimadoMin: media },
  });
}

export async function recalcularTodasMedias() {
  const tipos = await prisma.tipoAtividade.findMany({ select: { id: true } });
  for (const t of tipos) {
    await atualizarMediaTempoAtividade(t.id);
  }
}

export const demandaInclude = {
  executor: true,
  produto: true,
  modulacao: true,
  tipoAtividade: true,
  depsComoOrigem: {
    include: { destino: { include: { tipoAtividade: true } } },
  },
  depsComoDestino: {
    include: { origem: { include: { tipoAtividade: true } } },
  },
  apontamentos: {
    orderBy: { dataHoraInicio: 'desc' },
    include: { demandaOpcao: { include: { opcao: true } } },
  },
  opcoes: {
    include: { opcao: true },
    orderBy: { opcao: { ordem: 'asc' } },
  },
};

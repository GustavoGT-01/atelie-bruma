import {
  TIPOS_CADEIA,
  snapshotFabrica,
  parseFluxoPadraoJson,
  serializeFluxoPadrao,
  CORES_PADRAO,
  COR_ATIVIDADE_FALLBACK,
} from './fluxo-padrao.js';
import { serializePreRequisitos, parsePreRequisitos } from './fluxo-etapas.js';

const COM_OPCOES_LISTAGEM = ['LISTAGEM'];

const OPCOES = [
  { codigo: 'A', nome: 'Lista madeira', ordem: 1 },
  { codigo: 'B', nome: 'Lista espuma', ordem: 2 },
  { codigo: 'C', nome: 'Lista embalagem madeira', ordem: 3 },
  { codigo: 'D', nome: 'Lista laminacao', ordem: 4 },
  { codigo: 'E', nome: 'Lista metalurgica', ordem: 5 },
  { codigo: 'F', nome: 'Lista almofada', ordem: 6 },
  { codigo: 'G', nome: 'Lista percinta', ordem: 7 },
  { codigo: 'H', nome: 'Custo estrutura', ordem: 8 },
  { codigo: 'I', nome: 'Custo laminacao', ordem: 9 },
  { codigo: 'J', nome: 'Custo metalurgica', ordem: 10 },
  { codigo: 'K', nome: 'Custo embalagem madeira', ordem: 11 },
  { codigo: 'L', nome: 'Custo acabado', ordem: 12 },
];

const RENOMEAR = [
  ['RECORTE', 'RECORTES'],
  ['TABELA DE PRECO', 'TABELA'],
  ['TABELA DE PREÇO', 'TABELA'],
];

const DESATIVAR = ['CUSTO'];

/** Le o snapshot salvo; se nao houver, usa fabrica. */
export async function carregarFluxoPadrao(client) {
  try {
    const cfg = await client.configApp.findUnique({ where: { id: 'app' } });
    const snap = parseFluxoPadraoJson(cfg?.fluxoPadraoJson);
    if (snap && snap.links.length) return snap;
  } catch {
    // tabela ainda nao migrada
  }
  return snapshotFabrica();
}

/** Captura diagramas + pre-requisitos atuais e grava como padrao. */
export async function salvarDiagramaAtualComoPadrao(client) {
  const tipos = await client.tipoAtividade.findMany({
    where: { ativo: true },
    include: {
      sucessores: {
        orderBy: { ordem: 'asc' },
        include: { destino: true },
      },
    },
    orderBy: [{ ordemPadrao: 'asc' }, { nome: 'asc' }],
  });

  const links = [];
  const preRequisitos = {};

  for (const t of tipos) {
    const destinos = t.sucessores
      .filter((s) => s.destino.ativo)
      .map((s) => s.destino.nome.toUpperCase().trim());
    if (destinos.length) {
      links.push([t.nome.toUpperCase().trim(), destinos]);
    }
    const pre = parsePreRequisitos(t.preRequisitos);
    if (pre.length) {
      preRequisitos[t.nome.toUpperCase().trim()] = pre;
    }
  }

  const snap = {
    links,
    preRequisitos,
    atualizadoEm: new Date().toISOString(),
  };

  await client.configApp.upsert({
    where: { id: 'app' },
    update: {
      fluxoPadraoJson: serializeFluxoPadrao(snap),
      atualizadoEm: new Date(),
    },
    create: {
      id: 'app',
      fluxoPadraoJson: serializeFluxoPadrao(snap),
      atualizadoEm: new Date(),
    },
  });

  return snap;
}

/** Aplica um snapshot (ou o padrao salvo / fabrica) nas ligacoes. */
export async function aplicarFluxoPadrao(client, snap) {
  const fluxo = snap || (await carregarFluxoPadrao(client));

  for (const [antigo, novo] of RENOMEAR) {
    const a = await client.tipoAtividade.findUnique({ where: { nome: antigo } });
    const n = await client.tipoAtividade.findUnique({ where: { nome: novo } });
    if (a && !n) {
      await client.tipoAtividade.update({
        where: { id: a.id },
        data: { nome: novo },
      });
    } else if (a && n) {
      await client.demanda.updateMany({
        where: { tipoAtividadeId: a.id },
        data: { tipoAtividadeId: n.id },
      });
      await client.tipoSucessor.deleteMany({
        where: { OR: [{ origemId: a.id }, { destinoId: a.id }] },
      });
      await client.tipoAtividade.delete({ where: { id: a.id } });
    }
  }

  for (const nome of DESATIVAR) {
    await client.tipoAtividade.updateMany({
      where: { nome },
      data: { ativo: false },
    });
  }

  // Garante tipos da cadeia de fabrica existem; nao apaga tipos extras do usuario
  for (let i = 0; i < TIPOS_CADEIA.length; i++) {
    const nome = TIPOS_CADEIA[i];
    const pre = fluxo.preRequisitos[nome] || [];
    const cor = CORES_PADRAO[nome] || COR_ATIVIDADE_FALLBACK;
    await client.tipoAtividade.upsert({
      where: { nome },
      update: {
        ativo: true,
        ordemPadrao: i + 1,
        temOpcoesListagem: COM_OPCOES_LISTAGEM.includes(nome),
        ...(fluxo.preRequisitos[nome] !== undefined
          ? { preRequisitos: serializePreRequisitos(pre) }
          : {}),
        // So preenche cor se ainda estiver no fallback cinza
      },
      create: {
        nome,
        ordemPadrao: i + 1,
        tempoEstimadoMin: 60,
        temOpcoesListagem: COM_OPCOES_LISTAGEM.includes(nome),
        preRequisitos: serializePreRequisitos(pre),
        cor,
      },
    });
    await client.tipoAtividade.updateMany({
      where: { nome, cor: COR_ATIVIDADE_FALLBACK },
      data: { cor },
    });
  }

  // Aplica pre-requisitos de tipos que estao no snapshot (incluindo extras)
  for (const [nome, pre] of Object.entries(fluxo.preRequisitos)) {
    await client.tipoAtividade.updateMany({
      where: { nome },
      data: { preRequisitos: serializePreRequisitos(pre) },
    });
  }

  const tipos = await client.tipoAtividade.findMany();
  const byNome = Object.fromEntries(tipos.map((t) => [t.nome, t]));

  // Limpa sucessores de todas as origens que aparecem no snapshot + cadeia
  const origensLimpar = new Set([...TIPOS_CADEIA, ...fluxo.links.map(([o]) => o)]);
  for (const nome of origensLimpar) {
    const origem = byNome[nome];
    if (!origem) continue;
    await client.tipoSucessor.deleteMany({ where: { origemId: origem.id } });
  }

  for (const [origemNome, destinos] of fluxo.links) {
    const origem = byNome[origemNome];
    if (!origem) continue;
    for (let i = 0; i < destinos.length; i++) {
      const destino = byNome[destinos[i]];
      if (!destino) continue;
      await client.tipoSucessor.create({
        data: {
          origemId: origem.id,
          destinoId: destino.id,
          ordem: i,
        },
      });
    }
  }

  const codigosNovos = OPCOES.map((o) => o.codigo);
  await client.fluxoOpcao.updateMany({
    where: { codigo: { notIn: codigosNovos } },
    data: { ativo: false },
  });

  for (const o of OPCOES) {
    await client.fluxoOpcao.upsert({
      where: { codigo: o.codigo },
      update: { nome: o.nome, ordem: o.ordem, ativo: true },
      create: {
        codigo: o.codigo,
        nome: o.nome,
        ordem: o.ordem,
        tempoEstimadoMin: 30,
      },
    });
  }

  return fluxo;
}

/** Compat: seed inicial / restaurar usa padrao salvo ou fabrica. */
export async function seedFluxoCadeia(client) {
  return aplicarFluxoPadrao(client);
}

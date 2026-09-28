import { get, post, patch, remover, ApiError } from './client.js';

const PAPEL_PARA_UI = { ADMIN: 'Admin', PLANEJAMENTO: 'Planejador', EXECUTOR: 'Executor' };
const PAPEL_PARA_API = { Admin: 'ADMIN', Planejador: 'PLANEJAMENTO', Executor: 'EXECUTOR' };

const PAINEL_PARA_TELA = {
  visao: 'dashboard',
  demandas: 'demandas',
  painel: 'executor',
  fluxo: 'fluxo',
  fila: 'cronograma',
  admin: 'cadastros',
  relatorios: 'relatorios',
};
const TELA_PARA_PAINEL = Object.fromEntries(
  Object.entries(PAINEL_PARA_TELA).map(([painel, tela]) => [tela, painel])
);

function paraTelas(paineis) {
  return (paineis || []).map((id) => PAINEL_PARA_TELA[id]).filter(Boolean);
}

function paraPaineis(telas) {
  return (telas || []).map((id) => TELA_PARA_PAINEL[id]).filter(Boolean);
}

function subprocessosPorAtividade(tipos, fluxoOpcoes) {
  const lista = fluxoOpcoes.map((opcao) => ({
    id: opcao.id,
    codigo: opcao.codigo,
    nome: opcao.nome,
    minutos: opcao.tempoEstimadoMin,
    ordem: opcao.ordem,
  }));
  const mapa = {};
  for (const tipo of tipos) {
    if (tipo.temOpcoesListagem) mapa[tipo.id] = lista;
  }
  return mapa;
}

function montarAtividades(tipos, usuariosPorId) {
  return tipos.map((tipo) => ({
    id: tipo.id,
    nome: tipo.nome,
    ordem: tipo.ordemPadrao,
    minutos: tipo.tempoEstimadoMin,
    colaboradorPadrao:
      tipo.executorPadrao?.nome || usuariosPorId.get(tipo.executorPadraoId)?.nome || '',
    usaSubprocessos: Boolean(tipo.temOpcoesListagem),
    cor: tipo.cor,
    proximas: (tipo.sucessores || []).map((s) => s.id),
  }));
}

/** Monta o catálogo no formato que as telas já consomem. */
export async function carregarCatalogo() {
  const [catalogos, usuarios] = await Promise.all([get('/catalogos'), get('/usuarios')]);

  const usuariosPorId = new Map(usuarios.map((u) => [u.id, u]));
  const atividades = montarAtividades(catalogos.tipos, usuariosPorId);

  let diagramDefault = atividades.map((item) => ({
    id: item.id,
    ordem: item.ordem,
    proximas: [...item.proximas],
  }));

  try {
    const fluxo = await get('/fluxo-padrao');
    const porNome = new Map(catalogos.tipos.map((t) => [t.nome.toUpperCase().trim(), t.id]));
    const proximasSalvas = new Map(
      (fluxo.padrao?.links || []).map(([origem, destinos]) => [
        String(origem).toUpperCase().trim(),
        destinos.map((d) => porNome.get(String(d).toUpperCase().trim())).filter(Boolean),
      ])
    );
    diagramDefault = atividades.map((item) => ({
      id: item.id,
      ordem: item.ordem,
      proximas: proximasSalvas.get(item.nome.toUpperCase().trim()) || [],
    }));
  } catch (erro) {
    // Executor não lê o fluxo padrão; o diagrama atual serve de referência.
    if (!(erro instanceof ApiError) || erro.status !== 403) throw erro;
  }

  return {
    atividades,
    subprocessos: subprocessosPorAtividade(catalogos.tipos, catalogos.fluxoOpcoes),
    colaboradores: usuarios
      .filter((u) => u.ativo)
      .map((u) => ({
        id: u.id,
        nome: u.nome,
        login: u.login.toLowerCase(),
        senha: '',
        papel: PAPEL_PARA_UI[u.papel] || 'Executor',
        atividades: u.tipoAtividadeIds,
        telas: paraTelas(u.paineisVisiveis),
      })),
    produtos: catalogos.produtos.map((p) => ({ id: p.id, nome: p.nome })),
    modulacoes: catalogos.modulacoes.map((m) => ({ id: m.id, nome: m.nome })),
    diagramDefault,
  };
}

function porId(lista) {
  return new Map((lista || []).map((item) => [item.id, item]));
}

function listaSubprocessos(catalogo) {
  const vistos = new Map();
  for (const lista of Object.values(catalogo.subprocessos || {})) {
    for (const item of lista) {
      if (!vistos.has(item.id)) vistos.set(item.id, item);
    }
  }
  return [...vistos.values()];
}

function mudou(a, b, campos) {
  return campos.some((campo) => {
    const va = a[campo];
    const vb = b[campo];
    if (Array.isArray(va) || Array.isArray(vb)) {
      return JSON.stringify(va || []) !== JSON.stringify(vb || []);
    }
    return va !== vb;
  });
}

async function sincronizarTipos(anterior, proximo, idsUsuarioPorNome) {
  const antes = porId(anterior.atividades);
  const depois = porId(proximo.atividades);
  const idsServidor = new Set(antes.keys());
  const idNovoPorTemp = new Map();

  const resolverSucessores = (proximas) =>
    proximas
      .map((id) => idNovoPorTemp.get(id) || id)
      .filter((id) => idsServidor.has(id) || [...idNovoPorTemp.values()].includes(id));

  for (const atividade of proximo.atividades) {
    if (antes.has(atividade.id)) continue;
    const criado = await post('/tipos', {
      nome: atividade.nome,
      ordemPadrao: atividade.ordem,
      tempoEstimadoMin: atividade.minutos,
      cor: atividade.cor,
      temOpcoesListagem: atividade.usaSubprocessos,
      executorPadraoId: idsUsuarioPorNome.get(atividade.colaboradorPadrao) || null,
      sucessorIds: resolverSucessores(atividade.proximas),
    });
    idNovoPorTemp.set(atividade.id, criado.id);
  }

  for (const atividade of proximo.atividades) {
    const original = antes.get(atividade.id);
    if (!original) continue;
    if (
      !mudou(original, atividade, [
        'nome',
        'ordem',
        'minutos',
        'cor',
        'usaSubprocessos',
        'colaboradorPadrao',
        'proximas',
      ])
    ) {
      continue;
    }
    await patch(`/tipos/${atividade.id}`, {
      nome: atividade.nome,
      ordemPadrao: atividade.ordem,
      tempoEstimadoMin: atividade.minutos,
      cor: atividade.cor,
      temOpcoesListagem: atividade.usaSubprocessos,
      executorPadraoId: idsUsuarioPorNome.get(atividade.colaboradorPadrao) || null,
      sucessorIds: resolverSucessores(atividade.proximas),
    });
  }

  for (const atividade of anterior.atividades) {
    if (depois.has(atividade.id)) continue;
    await remover(`/tipos/${atividade.id}`);
  }
}

async function sincronizarSubprocessos(anterior, proximo) {
  const antes = porId(listaSubprocessos(anterior));
  const depois = listaSubprocessos(proximo);
  const idsDepois = new Set(depois.map((item) => item.id));

  for (const item of depois) {
    const original = antes.get(item.id);
    if (!original) {
      await post('/fluxo-opcoes', {
        codigo: item.codigo,
        nome: item.nome,
        tempoEstimadoMin: item.minutos,
        ordem: item.ordem,
      });
      continue;
    }
    if (!mudou(original, item, ['codigo', 'nome', 'minutos', 'ordem'])) continue;
    await patch('/fluxo-opcoes', {
      id: item.id,
      codigo: item.codigo,
      nome: item.nome,
      tempoEstimadoMin: item.minutos,
      ordem: item.ordem,
    });
  }

  for (const id of antes.keys()) {
    if (!idsDepois.has(id)) await remover(`/fluxo-opcoes?id=${encodeURIComponent(id)}`);
  }
}

async function sincronizarColaboradores(anterior, proximo) {
  const antes = porId(anterior.colaboradores);
  const depois = porId(proximo.colaboradores);

  for (const pessoa of proximo.colaboradores) {
    const original = antes.get(pessoa.id);
    const corpo = {
      nome: pessoa.nome,
      login: pessoa.login,
      papel: PAPEL_PARA_API[pessoa.papel] || 'EXECUTOR',
      tipoAtividadeIds: pessoa.atividades,
      paineisVisiveis: paraPaineis(pessoa.telas),
    };
    if (!original) {
      await post('/usuarios', { ...corpo, ...(pessoa.senha ? { senha: pessoa.senha } : {}) });
      continue;
    }
    const alterou =
      mudou(original, pessoa, ['nome', 'login', 'papel', 'atividades', 'telas']) ||
      Boolean(pessoa.senha);
    if (!alterou) continue;
    await patch(`/usuarios/${pessoa.id}`, {
      ...corpo,
      ...(pessoa.senha ? { senha: pessoa.senha } : {}),
    });
  }

  for (const pessoa of anterior.colaboradores) {
    if (depois.has(pessoa.id)) continue;
    await remover(`/usuarios/${pessoa.id}`);
  }
}

async function sincronizarNomes(anterior, proximo, chave, caminho) {
  const antes = porId(anterior[chave]);
  const depois = porId(proximo[chave]);

  for (const item of proximo[chave]) {
    const original = antes.get(item.id);
    if (!original) {
      await post(`/${caminho}`, { nome: item.nome });
      continue;
    }
    if (original.nome === item.nome) continue;
    await patch(`/${caminho}/${item.id}`, { nome: item.nome });
  }

  for (const item of anterior[chave]) {
    if (depois.has(item.id)) continue;
    await remover(`/${caminho}/${item.id}`);
  }
}

/**
 * Compara o catálogo antes e depois da edição e aplica só o que mudou.
 * Mantém a assinatura de `onCatalogChange` intacta para as telas.
 */
export async function sincronizarCatalogo(anterior, proximo) {
  const idsUsuarioPorNome = new Map(
    proximo.colaboradores.map((pessoa) => [pessoa.nome, pessoa.id])
  );

  await sincronizarTipos(anterior, proximo, idsUsuarioPorNome);
  await sincronizarSubprocessos(anterior, proximo);
  await sincronizarColaboradores(anterior, proximo);
  await sincronizarNomes(anterior, proximo, 'produtos', 'produtos');
  await sincronizarNomes(anterior, proximo, 'modulacoes', 'modulacoes');

  const diagramaMudou =
    JSON.stringify(anterior.diagramDefault) !== JSON.stringify(proximo.diagramDefault);
  if (diagramaMudou) {
    await post('/fluxo-padrao');
  }
}

export function salvarModoUi(modoUi) {
  return patch('/preferencias', { modoUi });
}

export function lerPreferencias() {
  return get('/preferencias');
}

export function salvarPreferencias(patchBody) {
  return patch('/preferencias', patchBody);
}

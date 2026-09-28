/**
 * Verificação ponta a ponta do fluxo: cria a árvore de uma demanda, aponta
 * tempo e confere a liberação das etapas, incluindo o gate do CADASTRO.
 *
 * Uso: node server/scripts/smoke.mjs  (com a API no ar)
 */
const BASE = process.env.SMOKE_BASE || 'http://localhost:3001';
const LOGIN = process.env.SMOKE_LOGIN || 'ADMIN';
const SENHA = process.env.SMOKE_SENHA || 'piumobile';

let cookie = '';
let falhas = 0;

async function api(caminho, opcoes = {}) {
  const resposta = await fetch(`${BASE}/api${caminho}`, {
    ...opcoes,
    headers: {
      ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...opcoes.headers,
    },
  });
  const set = resposta.headers.getSetCookie?.() || [];
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  const texto = await resposta.text();
  const corpo = texto ? JSON.parse(texto) : null;
  if (!resposta.ok) {
    throw new Error(`${caminho} → ${resposta.status} ${corpo?.error || texto}`);
  }
  return corpo;
}

function conferir(rotulo, obtido, esperado) {
  const ok = obtido === esperado;
  if (!ok) falhas += 1;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${rotulo}: ${obtido}${ok ? '' : ` (esperado ${esperado})`}`);
}

const porTipo = (lista, nome) =>
  lista.filter((d) => (d.tipoAtividade?.nome || '') === nome);

async function arvoreDe(raizId) {
  const todas = await api(
    '/demandas?status=PENDENTE_APROVACAO,AGUARDANDO,PENDENTE,LIBERADA,EM_ANDAMENTO,PAUSADO,CONCLUIDA,REJEITADA'
  );
  return todas.filter((d) => d.raizId === raizId || d.id === raizId);
}

async function concluir(demanda) {
  await api(`/demandas/${demanda.id}/acao`, {
    method: 'POST',
    body: JSON.stringify({ action: 'iniciar' }),
  });
  await api(`/demandas/${demanda.id}/acao`, {
    method: 'POST',
    body: JSON.stringify({ action: 'finalizar' }),
  });
}

async function main() {
  await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: LOGIN, senha: SENHA }),
  });
  await api('/preferencias', {
    method: 'PATCH',
    body: JSON.stringify({ modoUi: 'ADM' }),
  });

  const catalogos = await api('/catalogos');
  const tipoId = (nome) => catalogos.tipos.find((t) => t.nome === nome)?.id;

  const raiz = await api('/demandas', {
    method: 'POST',
    body: JSON.stringify({
      especificacao: 'SMOKE — CADEIA COMPLETA',
      produtoNome: 'SMOKE PRODUTO',
      modulacaoNome: 'POL',
      tipoAtividadeId: tipoId('3D ESTRUTURAL'),
      prioridade: 2,
      status: 'LIBERADA',
      tempoEstimadoMin: 30,
      dataSolicitacao: '2026-09-28',
      etapasSelecionadas: [
        'RECORTES',
        'LISTAGEM',
        'MODELAGEM',
        'ENCAIXE',
        'CADASTRO',
        'CONFERENCIA',
      ],
    }),
  });

  console.log(`raiz ${raiz.codigo}`);
  let arvore = await arvoreDe(raiz.id);
  conferir('etapas criadas', arvore.length, 7);
  conferir('RECORTES nasce', porTipo(arvore, 'RECORTES')[0]?.status, 'AGUARDANDO');
  conferir('CADASTRO nasce', porTipo(arvore, 'CADASTRO')[0]?.status, 'AGUARDANDO');

  // Cronômetro: iniciar → pausar → conferir motivo e tempo
  await api(`/demandas/${raiz.id}/acao`, {
    method: 'POST',
    body: JSON.stringify({ action: 'iniciar' }),
  });
  await new Promise((r) => setTimeout(r, 1100));
  const pausada = await api(`/demandas/${raiz.id}/acao`, {
    method: 'POST',
    body: JSON.stringify({ action: 'pausar', motivo: 'Setup / preparação' }),
  });
  conferir('status ao pausar', pausada.status, 'PAUSADO');
  const apontamento = pausada.apontamentos[0];
  conferir('motivo gravado', apontamento?.motivoParada, 'Setup / preparação');
  conferir('tempo apontado > 0', apontamento?.tempoTotalSegundos > 0, true);

  // Erro esperado: filha ainda bloqueada
  const recortes = porTipo(arvore, 'RECORTES')[0];
  try {
    await api(`/demandas/${recortes.id}/acao`, {
      method: 'POST',
      body: JSON.stringify({ action: 'iniciar' }),
    });
    conferir('bloqueio da etapa seguinte', 'sem erro', 'erro');
  } catch (e) {
    conferir(
      'bloqueio da etapa seguinte',
      e.message.includes('Demanda ainda aguardando liberação da etapa anterior'),
      true
    );
  }

  await api(`/demandas/${raiz.id}/acao`, {
    method: 'POST',
    body: JSON.stringify({ action: 'finalizar' }),
  });

  arvore = await arvoreDe(raiz.id);
  conferir('RECORTES liberada', porTipo(arvore, 'RECORTES')[0]?.status, 'LIBERADA');
  conferir('LISTAGEM liberada', porTipo(arvore, 'LISTAGEM')[0]?.status, 'LIBERADA');
  conferir('MODELAGEM liberada', porTipo(arvore, 'MODELAGEM')[0]?.status, 'LIBERADA');
  conferir('ENCAIXE ainda espera', porTipo(arvore, 'ENCAIXE')[0]?.status, 'AGUARDANDO');
  conferir('CADASTRO ainda espera', porTipo(arvore, 'CADASTRO')[0]?.status, 'AGUARDANDO');

  for (const nome of ['RECORTES', 'LISTAGEM', 'MODELAGEM']) {
    await concluir(porTipo(arvore, nome)[0]);
  }
  arvore = await arvoreDe(raiz.id);
  conferir('ENCAIXE liberado', porTipo(arvore, 'ENCAIXE')[0]?.status, 'LIBERADA');
  conferir('CADASTRO segue preso', porTipo(arvore, 'CADASTRO')[0]?.status, 'AGUARDANDO');

  await concluir(porTipo(arvore, 'ENCAIXE')[0]);
  arvore = await arvoreDe(raiz.id);
  conferir('CADASTRO liberado pelo gate', porTipo(arvore, 'CADASTRO')[0]?.status, 'LIBERADA');
  conferir('CONFERENCIA espera', porTipo(arvore, 'CONFERENCIA')[0]?.status, 'AGUARDANDO');

  await concluir(porTipo(arvore, 'CADASTRO')[0]);
  arvore = await arvoreDe(raiz.id);
  conferir('CONFERENCIA liberada', porTipo(arvore, 'CONFERENCIA')[0]?.status, 'LIBERADA');

  const semSessao = await fetch(`${BASE}/api/preferencias`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filtroStatusDemandas: [] }),
  });
  conferir('preferencias sem sessao', semSessao.status, 401);

  const painelAdmin = await api('/painel');
  conferir('painel tem grupos', Array.isArray(painelAdmin.gruposPorProduto), true);
  if (painelAdmin.produtoFocoId) {
    await api('/preferencias', {
      method: 'PATCH',
      body: JSON.stringify({ produtoFocoFixadoId: painelAdmin.produtoFocoId }),
    });
    const fixado = await api('/painel');
    conferir('produto fixado', fixado.produtoFixadoId, painelAdmin.produtoFocoId);
    await api('/preferencias', {
      method: 'PATCH',
      body: JSON.stringify({ produtoFocoFixadoId: null }),
    });
  }

  const usuarios = await api('/usuarios');
  const outro = usuarios.find((usuario) => usuario.papel === 'EXECUTOR');
  if (outro) {
    const alheia = await api('/demandas', {
      method: 'POST',
      body: JSON.stringify({
        especificacao: 'SMOKE — ALHEIA',
        produtoNome: 'SMOKE PRODUTO',
        modulacaoNome: 'POL',
        tipoAtividadeId: tipoId('RECORTES'),
        executorId: outro.id,
        prioridade: 3,
        status: 'LIBERADA',
      }),
    });
    const comoAdmin = await api('/demandas?status=LIBERADA');
    conferir('modo adm ve alheia', comoAdmin.some((item) => item.id === alheia.id), true);
    try {
      await api('/preferencias', {
        method: 'PATCH',
        body: JSON.stringify({ modoUi: 'EXECUTOR' }),
      });
      const minhas = await api(
        '/demandas?status=LIBERADA,EM_ANDAMENTO,PAUSADO,AGUARDANDO,CONCLUIDA'
      );
      conferir('modo executor esconde alheia', minhas.some((item) => item.id === alheia.id), false);
      const painelExecutor = await api('/painel');
      const codigos = (painelExecutor.gruposPorProduto || []).flatMap((grupo) =>
        grupo.demandas.map((item) => item.codigo)
      );
      conferir('fila do executor esconde alheia', codigos.includes(alheia.codigo), false);
    } finally {
      await api('/preferencias', {
        method: 'PATCH',
        body: JSON.stringify({ modoUi: 'ADM' }),
      });
      await api(`/demandas/${alheia.id}`, { method: 'DELETE' }).catch(() => {});
    }
  }

  // Limpeza
  for (const d of arvore) {
    await api(`/demandas/${d.id}`, { method: 'DELETE' }).catch(() => {});
  }

  console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

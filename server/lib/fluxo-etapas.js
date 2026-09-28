/** Helpers de etapas selecionadas e executores por etapa. */

export function normalizeTipoNome(nome) {
  return (nome || '').toUpperCase().trim();
}

export function parseEtapasSelecionadas(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.map((x) => String(x).toUpperCase().trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function serializeEtapasSelecionadas(etapas) {
  const uniq = [
    ...new Set(etapas.map((e) => String(e).toUpperCase().trim()).filter(Boolean)),
  ];
  return JSON.stringify(uniq);
}

export function etapaMarcada(etapas, tipoNome) {
  const t = tipoNome.toUpperCase().trim();
  return etapas.some((e) => e === t);
}

export function parseExecutoresPorEtapa(raw) {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const nome = String(k).toUpperCase().trim();
      const id = String(v || '').trim();
      if (nome && id) out[nome] = id;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeExecutoresPorEtapa(map) {
  if (!map || typeof map !== 'object') return '{}';
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    const nome = String(k).toUpperCase().trim();
    const id = String(v || '').trim();
    if (nome && id) out[nome] = id;
  }
  return JSON.stringify(out);
}

export function parsePreRequisitos(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.map((x) => String(x).toUpperCase().trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function serializePreRequisitos(nomes) {
  const uniq = [
    ...new Set(nomes.map((e) => String(e).toUpperCase().trim()).filter(Boolean)),
  ];
  return JSON.stringify(uniq);
}

/**
 * Pré-requisitos do gate Cadastro conforme o plano ticado.
 * `configurados` vem do cadastro do tipo (quando existir); senao usa padrao.
 */
export function preRequisitosCadastro(etapas, configurados) {
  const set = new Set(etapas.map((e) => e.toUpperCase().trim()));
  const base =
    configurados && configurados.length
      ? configurados.map((c) => c.toUpperCase().trim())
      : ['RECORTES', 'ENCAIXE', 'LISTAGEM'];

  const req = [];
  for (const r of base) {
    if (r === 'RECORTES' || r === 'RECORTE') {
      if (set.has('RECORTES') || set.has('RECORTE')) req.push('RECORTES');
    } else if (r === 'ENCAIXE') {
      if (set.has('ENCAIXE') || set.has('MODELAGEM')) req.push('ENCAIXE');
    } else if (r === 'MODELAGEM') {
      if (set.has('MODELAGEM')) req.push('MODELAGEM');
    } else if (set.has(r)) {
      req.push(r);
    }
  }
  return [...new Set(req)];
}

export function cadastroNoPlano(etapas) {
  return etapaMarcada(etapas, 'CADASTRO');
}

export function nomesCadeiaPosGate() {
  return ['CADASTRO', 'CONFERENCIA', 'TABELA', 'FICHA TECNICA'];
}

export function nomesPreGate() {
  return ['RECORTES', 'MODELAGEM', 'ENCAIXE', 'LISTAGEM'];
}

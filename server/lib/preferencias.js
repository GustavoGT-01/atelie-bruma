/**
 * Preferencias de UI por usuario, gravadas como JSON em Usuario.preferenciasJson.
 * Campos: filtroStatusDemandas, modoUi (ADM | EXECUTOR), paineisVisiveis,
 * produtoFocoFixadoId, colunasDemandas, filtroAtividadeDemandas,
 * filtroExecutorDemandas.
 */
export function parsePreferencias(raw) {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const out = {};
    if (Array.isArray(obj.filtroStatusDemandas)) {
      out.filtroStatusDemandas = obj.filtroStatusDemandas
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    }
    if (obj.modoUi === 'ADM' || obj.modoUi === 'EXECUTOR') {
      out.modoUi = obj.modoUi;
    }
    if (Array.isArray(obj.paineisVisiveis)) {
      out.paineisVisiveis = obj.paineisVisiveis
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    }
    if (obj.produtoFocoFixadoId === null) {
      out.produtoFocoFixadoId = null;
    } else if (typeof obj.produtoFocoFixadoId === 'string') {
      const id = obj.produtoFocoFixadoId.trim();
      out.produtoFocoFixadoId = id || null;
    }
    if (Array.isArray(obj.colunasDemandas)) {
      out.colunasDemandas = obj.colunasDemandas
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    }
    if (Array.isArray(obj.filtroAtividadeDemandas)) {
      out.filtroAtividadeDemandas = obj.filtroAtividadeDemandas
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    }
    if (Array.isArray(obj.filtroExecutorDemandas)) {
      out.filtroExecutorDemandas = obj.filtroExecutorDemandas
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    }
    return out;
  } catch {
    return {};
  }
}

export function serializePreferencias(prefs) {
  return JSON.stringify(prefs || {});
}

export function mergePreferencias(atual, patch) {
  return {
    ...atual,
    ...patch,
  };
}

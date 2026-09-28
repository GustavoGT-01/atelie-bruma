import { prisma } from './prisma.js';
import { parsePreferencias } from './preferencias.js';
import { isAdmin, isAdminUi } from './permissoes.js';
import { paineisEfetivos } from './paineis.js';

export async function loadModoUi(userId) {
  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { preferenciasJson: true },
  });
  return parsePreferencias(user?.preferenciasJson).modoUi || 'ADM';
}

export async function loadPrefs(userId) {
  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { preferenciasJson: true },
  });
  return parsePreferencias(user?.preferenciasJson);
}

/** Admin real + modo UI (default ADM) + paineis do menu. */
export async function resolveAdminUi(session) {
  const isRealAdmin = isAdmin(session.papel);
  const prefs = await loadPrefs(session.id);
  const modoUi = isRealAdmin ? prefs.modoUi || 'ADM' : 'ADM';
  const adminUi = isAdminUi(session.papel, modoUi);
  const paineis = paineisEfetivos({
    papel: session.papel,
    modoUi,
    paineisVisiveis: prefs.paineisVisiveis,
  });
  return {
    isRealAdmin,
    modoUi,
    adminUi,
    paineis,
    paineisVisiveis: prefs.paineisVisiveis,
  };
}

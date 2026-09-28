import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireSession } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';
import { demandaInclude } from '../lib/workflow.js';
import { demandaParaExecutarWhere } from '../lib/permissoes.js';
import { resolveAdminUi, loadPrefs } from '../lib/modo-ui.js';
import { cadeiaPorModulacao, ordenarFilaPainel } from '../lib/sequencia-painel.js';

const router = Router();

function resumo(demanda) {
  return {
    id: demanda.id,
    codigo: demanda.codigo,
    status: demanda.status,
    atividade: demanda.tipoAtividade?.nome || '',
    modulacao: demanda.modulacao?.nome || '',
    executor: demanda.executor?.nome || '',
  };
}

router.get(
  '/painel',
  requireSession,
  asyncRoute(async (req, res) => {
    const { adminUi } = await resolveAdminUi(req.session);
    const prefs = await loadPrefs(req.session.id);
    const executorFilter = adminUi ? undefined : demandaParaExecutarWhere(req.session.id);
    const demandas = await prisma.demanda.findMany({
      where: executorFilter ? { AND: [executorFilter] } : undefined,
      include: demandaInclude,
    });
    const fixado = prefs.produtoFocoFixadoId || null;
    const fila = ordenarFilaPainel(demandas, fixado, null);
    const doFoco = fila.produtoFocoId
      ? fila.ordenadas.filter((item) => (item.produto?.id || `__sem__:${item.id}`) === fila.produtoFocoId)
      : [];

    res.json({
      produtoFocoId: fila.produtoFocoId,
      produtoFocoNome: fila.produtoFocoNome,
      produtoFixadoId: fixado,
      proximaId: fila.proximaId,
      gruposPorProduto: fila.gruposPorProduto.map((grupo) => ({
        produtoId: grupo.produtoId,
        produtoNome: grupo.produtoNome,
        demandas: grupo.demandas.map(resumo),
      })),
      cadeia: cadeiaPorModulacao(doFoco).map((grupo) => ({
        titulo: grupo.titulo,
        itens: grupo.itens.map(resumo),
      })),
    });
  })
);

export default router;

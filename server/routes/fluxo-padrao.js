import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireEditor } from '../lib/auth.js';
import { asyncRoute500 } from '../lib/http.js';
import {
  carregarFluxoPadrao,
  salvarDiagramaAtualComoPadrao,
  aplicarFluxoPadrao,
} from '../lib/seed-fluxo-cadeia.js';
import { snapshotFabrica } from '../lib/fluxo-padrao.js';

const router = Router();

router.get('/fluxo-padrao', requireEditor('Sem permissao'), async (_req, res) => {
  const salvo = await carregarFluxoPadrao(prisma);
  const fabrica = snapshotFabrica();
  let atualizadoEm = null;
  try {
    const cfg = await prisma.configApp.findUnique({ where: { id: 'app' } });
    atualizadoEm = cfg?.atualizadoEm?.toISOString() || salvo.atualizadoEm || null;
  } catch {
    atualizadoEm = salvo.atualizadoEm || null;
  }
  res.json({ padrao: salvo, fabrica, atualizadoEm });
});

/** Salva o diagrama/pre-requisitos atuais como novo padrao. */
router.post(
  '/fluxo-padrao',
  requireEditor('Sem permissao'),
  asyncRoute500(async (_req, res) => {
    const snap = await salvarDiagramaAtualComoPadrao(prisma);
    res.json({ ok: true, padrao: snap });
  }, 'Falha ao salvar fluxo padrao. Rode a migracao do banco.')
);

/**
 * Restaura ligacoes a partir do padrao salvo.
 * Body: { fabrica?: true } para voltar ao padrao de fabrica (e gravar como salvo).
 */
router.put(
  '/fluxo-padrao',
  requireEditor('Sem permissao'),
  asyncRoute500(async (req, res) => {
    const body = req.body || {};
    if (body.fabrica) {
      const fab = snapshotFabrica();
      fab.atualizadoEm = new Date().toISOString();
      await prisma.configApp.upsert({
        where: { id: 'app' },
        update: {
          fluxoPadraoJson: JSON.stringify(fab),
          atualizadoEm: new Date(),
        },
        create: {
          id: 'app',
          fluxoPadraoJson: JSON.stringify(fab),
        },
      });
      await aplicarFluxoPadrao(prisma, fab);
      res.json({ ok: true, fonte: 'fabrica', padrao: fab });
      return;
    }
    const fluxo = await aplicarFluxoPadrao(prisma);
    res.json({ ok: true, fonte: 'salvo', padrao: fluxo });
  }, 'Falha ao restaurar fluxo padrao.')
);

export default router;

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireSession } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';
import {
  mergePreferencias,
  parsePreferencias,
  serializePreferencias,
} from '../lib/preferencias.js';

const router = Router();

router.get(
  '/preferencias',
  requireSession,
  asyncRoute(async (req, res) => {
    const user = await prisma.usuario.findUnique({
      where: { id: req.session.id },
      select: { preferenciasJson: true },
    });
    res.json(parsePreferencias(user?.preferenciasJson));
  })
);

router.patch(
  '/preferencias',
  requireSession,
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const user = await prisma.usuario.findUnique({
      where: { id: req.session.id },
      select: { preferenciasJson: true },
    });
    const atual = parsePreferencias(user?.preferenciasJson);
    const patch = {};
    if (Array.isArray(body.filtroStatusDemandas)) {
      patch.filtroStatusDemandas = body.filtroStatusDemandas
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    }
    if (body.modoUi === 'ADM' || body.modoUi === 'EXECUTOR') {
      if (req.session.papel !== 'ADMIN') {
        res.status(403).json({ error: 'Somente administrador pode trocar modo UI' });
        return;
      }
      patch.modoUi = body.modoUi;
    }
    if (body.produtoFocoFixadoId === null) {
      patch.produtoFocoFixadoId = null;
    } else if (typeof body.produtoFocoFixadoId === 'string') {
      const id = body.produtoFocoFixadoId.trim();
      patch.produtoFocoFixadoId = id || null;
    }
    if (Array.isArray(body.colunasDemandas)) {
      patch.colunasDemandas = body.colunasDemandas
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    }
    if (Array.isArray(body.filtroAtividadeDemandas)) {
      patch.filtroAtividadeDemandas = body.filtroAtividadeDemandas
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    }
    if (Array.isArray(body.filtroExecutorDemandas)) {
      patch.filtroExecutorDemandas = body.filtroExecutorDemandas
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    }
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const next = mergePreferencias(atual, patch);
    await prisma.usuario.update({
      where: { id: req.session.id },
      data: { preferenciasJson: serializePreferencias(next) },
    });
    res.json(next);
  })
);

export default router;

import { Router } from 'express';
import { login, destroySession, requireSession } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';
import { resolveAdminUi } from '../lib/modo-ui.js';
const router = Router();

router.post(
  '/auth/login',
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const user = await login(res, String(body.login || ''), String(body.senha || ''));
    if (!user) {
      res.status(401).json({ error: 'Usuário ou senha inválidos' });
      return;
    }
    res.json({
      ok: true,
      user: { id: user.id, nome: user.nome, login: user.login, papel: user.papel },
    });
  })
);

router.post('/auth/logout', (req, res) => {
  destroySession(res);
  res.json({ ok: true });
});

/**
 * A origem resolve a sessao no layout do Next. Numa SPA o cliente precisa
 * perguntar, entao esta rota devolve o mesmo que o layout usava.
 */
router.get(
  '/auth/sessao',
  requireSession,
  asyncRoute(async (req, res) => {
    const { modoUi, paineis, adminUi, isRealAdmin } = await resolveAdminUi(req.session);
    res.json({
      user: {
        id: req.session.id,
        nome: req.session.nome,
        login: req.session.login,
        papel: req.session.papel,
      },
      modoUi,
      paineis,
      adminUi,
      isRealAdmin,
    });
  })
);

export default router;

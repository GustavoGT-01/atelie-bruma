/** Helpers que reproduzem o formato de resposta das rotas do Next da origem. */

/** Envolve um handler async e devolve 400 com a mensagem do erro, como na origem. */
export function asyncRoute(handler, fallback = 'Erro') {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((e) => {
      if (res.headersSent) return;
      res.status(400).json({ error: e instanceof Error ? e.message : fallback });
    });
  };
}

/** Erro inesperado vira 500 com mensagem fixa, como nas rotas que usam try/catch. */
export function asyncRoute500(handler, mensagem) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((e) => {
      console.error(e);
      if (res.headersSent) return;
      res.status(500).json({ error: mensagem });
    });
  };
}

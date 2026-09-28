import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import { hashPassword, requireEditor } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';
import { nextCodigo } from '../lib/workflow.js';
import {
  ensureTipoIsolado,
  parseDesenvolvimentoSheet,
  slugLogin,
} from '../lib/import-xlsx.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

async function loadSheet(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws =
    wb.getWorksheet('DESENVOLVIMENTO') ||
    wb.worksheets.find((s) => s.name !== 'MAYCON' && s.name !== 'MATHEUS') ||
    wb.worksheets[0];
  if (!ws) return null;
  return parseDesenvolvimentoSheet(ws);
}

/** Valida o upload com as mesmas mensagens da origem. */
function arquivoValido(req, res) {
  if (!req.file) {
    res.status(400).json({ error: 'Arquivo obrigatório' });
    return false;
  }
  if (req.file.size > 10 * 1024 * 1024) {
    res.status(400).json({ error: 'Arquivo maior que 10 MB' });
    return false;
  }
  return true;
}

router.get('/import/xlsx', requireEditor(), (_req, res) => {
  res.json({
    escopo: ['TI', 'GERENCIA', 'DOCUMENTAÇÃO PARA TERCEIROS'],
    hint: 'POST multipart file=xlsx — importa só essas atividades (isoladas).',
  });
});

/** Preview: conta linhas no escopo vs fora. */
router.put(
  '/import/xlsx',
  requireEditor(),
  upload.single('file'),
  asyncRoute(async (req, res) => {
    if (!arquivoValido(req, res)) return;

    const rows = await loadSheet(req.file.buffer);
    if (!rows) {
      res.status(400).json({ error: 'Aba não encontrada' });
      return;
    }

    const inScope = rows.filter((r) => r.inScope);
    const byAtividade = {};
    for (const r of inScope) {
      byAtividade[r.atividade] = (byAtividade[r.atividade] || 0) + 1;
    }

    res.json({
      totalLinhas: rows.length,
      noEscopo: inScope.length,
      foraEscopo: rows.length - inScope.length,
      porAtividade: byAtividade,
      // A tela de Relatórios mostra a prévia linha a linha.
      linhas: inScope.map((r) => ({
        atividade: r.atividade,
        produto: r.produto,
        especificacao: r.especificacao,
        executor: r.executor,
      })),
    });
  })
);

router.post(
  '/import/xlsx',
  requireEditor(),
  upload.single('file'),
  asyncRoute(async (req, res) => {
    if (!arquivoValido(req, res)) return;

    const rows = await loadSheet(req.file.buffer);
    if (!rows) {
      res.status(400).json({ error: 'Aba não encontrada' });
      return;
    }

    const defaultPassword = await hashPassword('123456');
    let imported = 0;
    let skippedDuplicate = 0;
    let skippedOutOfScope = 0;
    const userCache = new Map();
    const prodCache = new Map();
    const tipoCache = new Map();
    const porAtividade = {};

    for (const row of rows) {
      if (!row.inScope || !row.atividade) {
        skippedOutOfScope++;
        continue;
      }

      const atividadeNome = row.atividade;

      let executorId = null;
      if (row.executor) {
        const key = row.executor.toUpperCase();
        if (userCache.has(key)) executorId = userCache.get(key);
        else {
          const login = slugLogin(row.executor);
          const user = await prisma.usuario.upsert({
            where: { login },
            update: { nome: row.executor },
            create: {
              nome: row.executor,
              login,
              senhaHash: defaultPassword,
              papel: 'EXECUTOR',
            },
          });
          userCache.set(key, user.id);
          executorId = user.id;
        }
      }

      let produtoId = null;
      if (row.produto && row.produto !== '-') {
        const key = row.produto.toUpperCase();
        if (prodCache.has(key)) produtoId = prodCache.get(key);
        else {
          const p = await prisma.produto.upsert({
            where: { nome: key },
            update: { ativo: true },
            create: { nome: key },
          });
          prodCache.set(key, p.id);
          produtoId = p.id;
        }
      }

      let tipoAtividadeId = tipoCache.get(atividadeNome);
      if (!tipoAtividadeId) {
        const t = await ensureTipoIsolado(atividadeNome);
        tipoCache.set(atividadeNome, t.id);
        tipoAtividadeId = t.id;
      }

      const status = row.dataConclusao ? 'CONCLUIDA' : 'LIBERADA';

      const existing = await prisma.demanda.findFirst({
        where: {
          especificacao: row.especificacao,
          produtoId: produtoId || undefined,
          tipoAtividadeId,
        },
      });
      if (existing) {
        skippedDuplicate++;
        continue;
      }

      const codigo = await nextCodigo();
      const criada = await prisma.demanda.create({
        data: {
          codigo,
          especificacao: row.especificacao,
          observacoes: row.observacoes,
          prioridade: row.prioridade,
          status,
          conferida: row.conferida,
          dataSolicitacao: row.dataSolicitacao || new Date(),
          dataConclusao: row.dataConclusao,
          progressoPct: status === 'CONCLUIDA' ? 100 : 0,
          executorId,
          produtoId,
          tipoAtividadeId,
          tempoEstimadoMin: 60,
        },
      });
      await prisma.demanda.update({
        where: { id: criada.id },
        data: { raizId: criada.id },
      });

      imported++;
      porAtividade[atividadeNome] = (porAtividade[atividadeNome] || 0) + 1;
    }

    res.json({
      imported,
      skippedDuplicate,
      skippedOutOfScope,
      porAtividade,
      usuarios: userCache.size,
      produtos: prodCache.size,
      tipos: tipoCache.size,
    });
  })
);

export default router;

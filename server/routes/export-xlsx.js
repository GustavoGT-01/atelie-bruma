import { Router } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../lib/auth.js';
import { asyncRoute } from '../lib/http.js';

const router = Router();

router.get(
  '/export/xlsx',
  requireAdmin('Somente administrador pode exportar relatórios'),
  asyncRoute(async (_req, res) => {
    const demandas = await prisma.demanda.findMany({
      include: {
        executor: true,
        produto: true,
        modulacao: true,
        tipoAtividade: true,
      },
      orderBy: { codigo: 'asc' },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PIU MOBILE';
    const ws = wb.addWorksheet('DESENVOLVIMENTO');

    ws.getCell('B2').value = 'DEMANDA THE BEST CHARACTER DEVELOPMENT IN HISTORY';
    ws.getCell('B2').font = { name: 'Arial', bold: true, size: 14 };

    const headers = [
      'EXECUTOR',
      'ATIVIDADE',
      'PRODUTO',
      'ESPECIFICAÇÃO DE ATIVIDADE',
      'DATA DE SOLICITAÇÃO',
      'OBSERVAÇÕES',
      'PRIORIDADE',
      'DATA DE CONCLUSÃO',
      'TEMPO DE ENTREGA',
      'CONCLUIDA',
      'CONFERENCIA',
      'MODULAÇÃO',
    ];
    headers.forEach((h, i) => {
      const cell = ws.getCell(5, i + 2);
      cell.value = h;
      cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F2744' },
      };
    });

    demandas.forEach((d, idx) => {
      const row = 6 + idx;
      const r = ws.getRow(row);
      r.getCell(2).value = d.executor?.nome || '';
      r.getCell(3).value = d.tipoAtividade?.nome || '';
      r.getCell(4).value = d.produto?.nome || '';
      r.getCell(5).value = d.especificacao;
      r.getCell(6).value = d.dataSolicitacao || null;
      r.getCell(6).numFmt = 'dd/mm/yyyy';
      r.getCell(7).value = d.observacoes || '-';
      r.getCell(8).value = d.prioridade;
      r.getCell(9).value = d.dataConclusao || null;
      r.getCell(9).numFmt = 'dd/mm/yyyy';
      // Formula like original sheet: I - F
      r.getCell(10).value = { formula: `IF(COUNTA(I${row})=0,"",I${row}-F${row})` };
      r.getCell(11).value = { formula: `IF(COUNTA(I${row})>0,TRUE,FALSE)` };
      r.getCell(12).value = d.conferida;
      r.getCell(13).value = d.modulacao?.nome || '';
      r.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10 };
      });
    });

    // Legend
    const legendRow = 6 + demandas.length + 2;
    ws.getCell(legendRow, 2).value =
      'Legenda: colunas espelham a planilha original. TEMPO DE ENTREGA e CONCLUIDA são fórmulas. Fonte: sistema interno SQLite.';
    ws.getCell(legendRow, 2).font = { name: 'Arial', italic: true, size: 9 };

    ws.columns = [
      {},
      { width: 14 },
      { width: 18 },
      { width: 14 },
      { width: 48 },
      { width: 16 },
      { width: 28 },
      { width: 12 },
      { width: 16 },
      { width: 16 },
      { width: 12 },
      { width: 12 },
      { width: 16 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="DEMANDA_DESENVOLVIMENTO_export.xlsx"'
    );
    res.send(Buffer.from(buffer));
  })
);

export default router;

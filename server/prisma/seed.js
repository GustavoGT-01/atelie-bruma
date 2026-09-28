import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { aplicarFluxoPadrao, salvarDiagramaAtualComoPadrao } from '../lib/seed-fluxo-cadeia.js';

const prisma = new PrismaClient();

/**
 * Catalogo inicial. Os nomes de atividade seguem a grafia canonica do motor de
 * fluxo (CONFERENCIA, FICHA TECNICA, GERENCIA sem acento): o gate do CADASTRO e
 * a cadeia pos-gate comparam por esses nomes.
 */
const ATIVIDADES = [
  { nome: 'BLOCO 3D', ordem: 0, minutos: 8, padrao: 'GUSTAVO', cor: '#3B82F6', proximas: [] },
  { nome: 'SOLICITAÇÃO COMERCIAL', ordem: 0, minutos: 2, padrao: 'EZIO', cor: '#F97316', proximas: ['3D ESTRUTURAL'] },
  { nome: 'DOCUMENTAÇÃO PARA TERCEIROS', ordem: 0, minutos: 45, padrao: 'GUSTAVO', cor: '#0284C7', proximas: [] },
  { nome: 'TI', ordem: 0, minutos: 30, padrao: 'ANDERSON', cor: '#A855F7', proximas: [] },
  { nome: 'GERENCIA', ordem: 0, minutos: 15, padrao: 'TATIANE', cor: '#64748B', proximas: [] },
  { nome: '3D ESTRUTURAL', ordem: 1, minutos: 197, padrao: 'MATHEUS', cor: '#06B6D4', proximas: ['RECORTES', 'LISTAGEM', 'MODELAGEM'] },
  { nome: 'RECORTES', ordem: 2, minutos: 73, padrao: 'GUSTAVO', cor: '#F59E0B', proximas: [] },
  { nome: 'LISTAGEM', ordem: 2, minutos: 140, padrao: 'GUSTAVO', cor: '#10B981', proximas: [], usaSubprocessos: true },
  { nome: 'MODELAGEM', ordem: 2, minutos: 60, padrao: 'MATHEUS', cor: '#8B5CF6', proximas: ['ENCAIXE'] },
  { nome: 'ENCAIXE', ordem: 3, minutos: 40, padrao: 'MAYCON', cor: '#EC4899', proximas: [] },
  { nome: 'CADASTRO', ordem: 3, minutos: 65, padrao: 'RAYANE', cor: '#14B8A6', proximas: ['CONFERENCIA'] },
  { nome: 'CONFERENCIA', ordem: 4, minutos: 30, padrao: 'GUSTAVO', cor: '#6366F1', proximas: ['TABELA'] },
  { nome: 'TABELA', ordem: 5, minutos: 20, padrao: 'RAYANE', cor: '#EAB308', proximas: ['FICHA TECNICA'] },
  { nome: 'FICHA TECNICA', ordem: 6, minutos: 25, padrao: 'RAYANE', cor: '#84CC16', proximas: [] },
];

const TELAS_OPERACAO = ['visao', 'demandas', 'painel', 'fluxo', 'fila'];
const TELAS_ADMIN = [...TELAS_OPERACAO, 'admin', 'relatorios'];

const COLABORADORES = [
  { nome: 'GUSTAVO', papel: 'ADMIN', atividades: ATIVIDADES.map((a) => a.nome), paineis: TELAS_ADMIN },
  { nome: 'MATHEUS', papel: 'EXECUTOR', atividades: ['3D ESTRUTURAL', 'MODELAGEM'], paineis: TELAS_OPERACAO },
  { nome: 'EZIO', papel: 'EXECUTOR', atividades: ['SOLICITAÇÃO COMERCIAL'], paineis: TELAS_OPERACAO },
  { nome: 'MAYCON', papel: 'EXECUTOR', atividades: ['ENCAIXE'], paineis: TELAS_OPERACAO },
  { nome: 'RAYANE', papel: 'PLANEJAMENTO', atividades: ['CADASTRO', 'TABELA', 'FICHA TECNICA'], paineis: TELAS_OPERACAO },
  { nome: 'ANDERSON', papel: 'EXECUTOR', atividades: ['TI'], paineis: TELAS_OPERACAO },
  { nome: 'TATIANE', papel: 'EXECUTOR', atividades: ['GERENCIA'], paineis: TELAS_OPERACAO },
];

const PRODUTOS = [
  'ACONCHEGO', 'AIR III', 'AMANHÃ', 'AMY', 'ANTONY', 'ARREPIO', 'BAIÃO', 'BRAVO',
  'CAIE', 'CAPADÓCIA', 'CRIO', 'DEO', 'DONGUAN', 'ENGER', 'FORASTEIRO',
  'HUDSON', 'LUMI', 'MONTELLO', 'PLATAFORMA II', 'RÉGIA', 'SAMBO', 'SAVONA', 'SERENA',
];

const MODULACOES = [
  '1B', '1B 1A', '1B 2A', '1U AV 2A', '1B CURVO 2A', '1B CURVO CRECIO 1A', '2D',
  '2B 2A', 'SB 1A', 'POL', 'PUFF', 'MOD-1', 'TODAS', 'PADRÃO', 'ÚNICA', 'GERAL',
];

async function main() {
  const adminLogin = String(process.env.SEED_ADMIN_LOGIN || 'ADMIN').trim().toUpperCase();
  const adminSenha = String(process.env.SEED_ADMIN_SENHA || 'piumobile');
  const senhaPadrao = String(process.env.SEED_USER_SENHA || 'piumobile');

  await prisma.usuario.upsert({
    where: { login: adminLogin },
    update: { papel: 'ADMIN', ativo: true },
    create: {
      nome: 'Administrador',
      login: adminLogin,
      senhaHash: await bcrypt.hash(adminSenha, 10),
      papel: 'ADMIN',
    },
  });

  // Tipos da cadeia, subprocessos A–L e ligacoes de fabrica
  await aplicarFluxoPadrao(prisma);

  const senhaHash = await bcrypt.hash(senhaPadrao, 10);
  const usuarioPorNome = new Map();
  for (const pessoa of COLABORADORES) {
    const login = pessoa.nome.toUpperCase();
    const user = await prisma.usuario.upsert({
      where: { login },
      update: { nome: pessoa.nome, papel: pessoa.papel, ativo: true },
      create: {
        nome: pessoa.nome,
        login,
        senhaHash,
        papel: pessoa.papel,
        preferenciasJson: JSON.stringify({ paineisVisiveis: pessoa.paineis }),
      },
    });
    usuarioPorNome.set(pessoa.nome, user.id);
  }

  // Tipos: garante os do catalogo do destino, com minutos, cor e executor padrao
  const tipoPorNome = new Map();
  for (const atividade of ATIVIDADES) {
    const executorPadraoId = usuarioPorNome.get(atividade.padrao) || null;
    const tipo = await prisma.tipoAtividade.upsert({
      where: { nome: atividade.nome },
      update: {
        ordemPadrao: atividade.ordem,
        tempoEstimadoMin: atividade.minutos,
        cor: atividade.cor,
        temOpcoesListagem: Boolean(atividade.usaSubprocessos),
        executorPadraoId,
        ativo: true,
      },
      create: {
        nome: atividade.nome,
        ordemPadrao: atividade.ordem,
        tempoEstimadoMin: atividade.minutos,
        cor: atividade.cor,
        temOpcoesListagem: Boolean(atividade.usaSubprocessos),
        executorPadraoId,
        preRequisitos: '[]',
      },
    });
    tipoPorNome.set(atividade.nome, tipo.id);
  }

  // Ligacoes do diagrama do catalogo do destino
  for (const atividade of ATIVIDADES) {
    const origemId = tipoPorNome.get(atividade.nome);
    await prisma.tipoSucessor.deleteMany({ where: { origemId } });
    for (let i = 0; i < atividade.proximas.length; i++) {
      const destinoId = tipoPorNome.get(atividade.proximas[i]);
      if (!destinoId) continue;
      await prisma.tipoSucessor.create({
        data: { origemId, destinoId, ordem: i },
      });
    }
  }

  // Atividades visiveis por colaborador
  for (const pessoa of COLABORADORES) {
    const usuarioId = usuarioPorNome.get(pessoa.nome);
    await prisma.usuarioTipoAtividade.deleteMany({ where: { usuarioId } });
    for (const nome of pessoa.atividades) {
      const tipoAtividadeId = tipoPorNome.get(nome);
      if (!tipoAtividadeId) continue;
      await prisma.usuarioTipoAtividade.create({
        data: { usuarioId, tipoAtividadeId },
      });
    }
  }

  for (const nome of PRODUTOS) {
    await prisma.produto.upsert({
      where: { nome },
      update: { ativo: true },
      create: { nome },
    });
  }

  for (const nome of MODULACOES) {
    await prisma.modulacao.upsert({
      where: { nome },
      update: { ativo: true },
      create: { nome },
    });
  }

  // Diagrama semeado vira o padrao restauravel pela tela de Cadastros
  await salvarDiagramaAtualComoPadrao(prisma);

  console.log(
    `Seed OK: ${ATIVIDADES.length} atividades, ${COLABORADORES.length} colaboradores, ` +
      `${PRODUTOS.length} produtos, ${MODULACOES.length} modulações.`
  );
  console.log(`Admin: ${adminLogin} (senha em SEED_ADMIN_SENHA).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

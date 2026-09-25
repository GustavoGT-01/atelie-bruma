const PERMITIDAS = new Set(['TI', 'GERENCIA', 'DOCUMENTACAO PARA TERCEIROS']);
const LIMITE = 2000;

const ALIASES = {
  atividade: ['ATIVIDADE', 'TIPO DE ATIVIDADE', 'TIPO'],
  produto: ['PRODUTO'],
  modulacao: ['MODULACAO', 'MODULO'],
  especificacao: ['ESPECIFICACAO', 'DESCRICAO', 'DETALHE', 'OBSERVACAO'],
  executor: ['EXECUTOR', 'RESPONSAVEL', 'COLABORADOR'],
  prioridade: ['PRIORIDADE'],
  solicitacao: ['SOLICITACAO', 'DATA DA SOLICITACAO', 'DATA'],
  tempoEstimado: ['TEMPO ESTIMADO', 'TEMPO', 'MINUTOS'],
};

export function chave(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('pt-BR');
}

function entidades(texto) {
  return String(texto)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

function atributos(tag) {
  const mapa = {};
  for (const match of tag.matchAll(/([\w:]+)="([^"]*)"/g)) {
    mapa[match[1]] = match[2];
  }
  return mapa;
}

function achar(arquivos, regex) {
  for (const [nome, conteudo] of arquivos) {
    if (regex.test(nome)) return conteudo;
  }
  return '';
}

async function inflar(dados) {
  const fluxo = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

async function descompactar(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const arquivos = new Map();
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const assinatura = view.getUint32(offset, true);
    if (assinatura === 0x02014b50 || assinatura === 0x06054b50) break;
    if (assinatura !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const flags = view.getUint16(offset + 6, true);
    const metodo = view.getUint16(offset + 8, true);
    const tamanho = view.getUint32(offset + 18, true);
    const nomeTamanho = view.getUint16(offset + 26, true);
    const extraTamanho = view.getUint16(offset + 28, true);
    const nomeInicio = offset + 30;
    const nome = new TextDecoder().decode(bytes.subarray(nomeInicio, nomeInicio + nomeTamanho));
    const dadosInicio = nomeInicio + nomeTamanho + extraTamanho;

    if ((flags & 0x8) && tamanho === 0) {
      throw new Error('Salve a planilha de novo no Excel e tente outra vez.');
    }
    if (dadosInicio + tamanho > bytes.length) {
      throw new Error('O arquivo não é uma planilha .xlsx.');
    }

    const compactado = bytes.subarray(dadosInicio, dadosInicio + tamanho);
    let conteudo = compactado;
    if (metodo === 8) {
      try {
        conteudo = await inflar(compactado);
      } catch {
        throw new Error('O arquivo não é uma planilha .xlsx.');
      }
    } else if (metodo !== 0) {
      throw new Error('O arquivo não é uma planilha .xlsx.');
    }

    if (!nome.endsWith('/')) {
      arquivos.set(nome.replace(/\\/g, '/'), new TextDecoder().decode(conteudo));
    }
    offset = dadosInicio + tamanho;
  }

  if (!arquivos.size) throw new Error('O arquivo não é uma planilha .xlsx.');
  return arquivos;
}

function textosCompartilhados(xml) {
  if (!xml) return [];
  return xml.split(/<si\b[^>]*>/).slice(1).map((item) => {
    const pedacos = [...item.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => match[1]);
    return entidades(pedacos.join(''));
  });
}

function colunaIndice(letras) {
  let n = 0;
  for (const char of letras.toUpperCase()) n = n * 26 + (char.charCodeAt(0) - 64);
  return n;
}

function lerGrade(xml, compartilhados) {
  const grade = [];
  for (const match of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = atributos(match[1]);
    const ref = attrs.r || '';
    const letras = ref.replace(/[0-9]/g, '');
    const numero = Number(ref.replace(/[A-Z]/gi, ''));
    if (!letras || !numero) continue;

    const miolo = match[2] || '';
    let valor = '';
    if (attrs.t === 's') {
      const indice = Number((miolo.match(/<v>([\s\S]*?)<\/v>/) || [])[1]);
      valor = compartilhados[indice] ?? '';
    } else if (attrs.t === 'inlineStr') {
      valor = entidades((miolo.match(/<t\b[^>]*>([\s\S]*?)<\/t>/) || [])[1] || '');
    } else {
      valor = entidades((miolo.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '');
    }

    if (!grade[numero]) grade[numero] = [];
    grade[numero][colunaIndice(letras)] = valor;
  }
  return grade;
}

function acharAba(arquivos) {
  const livro = achar(arquivos, /(^|\/)xl\/workbook\.xml$/i);
  if (!livro) throw new Error('O arquivo não é uma planilha .xlsx.');

  const folhas = [...livro.matchAll(/<sheet\b[^>]*>/g)].map((match) => atributos(match[0]));
  const alvo = folhas.find((folha) => chave(folha.name) === 'DESENVOLVIMENTO');
  if (!alvo) throw new Error('A planilha não tem a aba Desenvolvimento.');

  const rels = achar(arquivos, /(^|\/)xl\/_rels\/workbook\.xml\.rels$/i);
  const relacoes = [...(rels || '').matchAll(/<Relationship\b[^>]*>/g)].map((match) => atributos(match[0]));
  const relacao = relacoes.find((item) => item.Id === alvo['r:id']);
  const alvoCaminho = (relacao?.Target || 'worksheets/sheet1.xml').replace(/^\//, '');
  const nomeArquivo = alvoCaminho.split('/').pop();
  const xml = achar(arquivos, new RegExp(`(?:^|/)${nomeArquivo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
  if (!xml) throw new Error('Não achei a aba Desenvolvimento dentro do arquivo.');
  return xml;
}

function indiceColunas(grade) {
  for (let i = 1; i < Math.min(grade.length, 25); i += 1) {
    const linha = grade[i];
    if (!linha) continue;
    const mapa = {};
    linha.forEach((celula, indice) => {
      const nome = chave(celula);
      for (const [campo, aliases] of Object.entries(ALIASES)) {
        if (aliases.includes(nome) && mapa[campo] == null) mapa[campo] = indice;
      }
    });
    if (mapa.atividade != null) return { linha: i, mapa };
  }
  throw new Error('A aba Desenvolvimento não tem a coluna Atividade.');
}

function textoCelula(linha, indice) {
  if (indice == null || !linha) return '';
  return String(linha[indice] ?? '').trim();
}

function maiusculas(texto) {
  return texto ? texto.toLocaleUpperCase('pt-BR') : '';
}

function dataExcel(valor) {
  if (!/^\d+(\.\d+)?$/.test(valor)) return '';
  const serial = Number(valor);
  if (serial < 20000 || serial > 80000) return '';
  const utc = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(utc);
}

function dataHoje() {
  return new Intl.DateTimeFormat('pt-BR').format(new Date());
}

function prioridade(valor) {
  const nome = chave(valor);
  if (nome === 'ALTA') return 'Alta';
  if (nome === 'MEDIA') return 'Média';
  if (nome === 'BAIXA') return 'Baixa';
  return 'Média';
}

function tempo(valor, minutos) {
  if (!valor) return `${minutos || 30} min`;
  if (/^\d+([.,]\d+)?$/.test(valor)) return `${valor.replace(',', '.')} min`;
  return valor;
}

function executor(valor, padrao) {
  return maiusculas(valor) || padrao;
}

export function classificar(grade, atividades, usuarioAtual) {
  const { linha: cabecalho, mapa } = indiceColunas(grade);
  if (mapa.especificacao == null) {
    throw new Error('A aba Desenvolvimento não tem a coluna Especificação.');
  }

  const aceitas = [];
  let ignoradas = 0;
  let cortou = false;
  let lidas = 0;

  for (let i = cabecalho + 1; i < grade.length; i += 1) {
    const linha = grade[i];
    if (!linha || linha.every((item) => !String(item ?? '').trim())) continue;
    lidas += 1;
    if (lidas > LIMITE) {
      cortou = true;
      break;
    }

    const nomeAtividade = chave(textoCelula(linha, mapa.atividade));
    const oficial = atividades.find((item) => chave(item.nome) === nomeAtividade);
    const especificacao = maiusculas(textoCelula(linha, mapa.especificacao));
    if (!PERMITIDAS.has(nomeAtividade) || !oficial || !especificacao) {
      ignoradas += 1;
      continue;
    }

    aceitas.push({
      atividade: oficial.nome,
      produto: maiusculas(textoCelula(linha, mapa.produto)),
      modulacao: maiusculas(textoCelula(linha, mapa.modulacao)),
      especificacao,
      executor: executor(textoCelula(linha, mapa.executor), usuarioAtual),
      prioridade: prioridade(textoCelula(linha, mapa.prioridade)),
      solicitacao: dataExcel(textoCelula(linha, mapa.solicitacao)) || textoCelula(linha, mapa.solicitacao) || dataHoje(),
      tempoEstimado: tempo(textoCelula(linha, mapa.tempoEstimado), oficial.minutos),
    });
  }

  return { aceitas, ignoradas, cortou };
}

export async function lerPlanilha(buffer, atividades, usuarioAtual) {
  const arquivos = await descompactar(buffer);
  const xml = acharAba(arquivos);
  const compartilhados = textosCompartilhados(achar(arquivos, /(^|\/)xl\/sharedStrings\.xml$/i));
  return classificar(lerGrade(xml, compartilhados), atividades, usuarioAtual);
}

export function montarDemandas(linhas, idsAtuais) {
  const usados = new Set(idsAtuais);
  return linhas.map((linha) => {
    let id = '';
    do {
      id = `DEM-${Math.floor(1000 + Math.random() * 9000)}`;
    } while (usados.has(id));
    usados.add(id);
    return {
      id,
      atividade: linha.atividade,
      produto: linha.produto,
      modulacao: linha.modulacao,
      especificacao: linha.especificacao,
      executor: linha.executor,
      prioridade: linha.prioridade,
      solicitacao: linha.solicitacao,
      status: 'Liberada',
      tempoEstimado: linha.tempoEstimado,
      tempoEmAtividadeSegundos: 0,
      motivoPausa: null,
      historicoParadas: [],
    };
  });
}

function campoCsv(valor) {
  const texto = String(valor ?? '');
  if (/[;"\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function baixarPlanilha(demands) {
  const colunas = [
    'id',
    'atividade',
    'produto',
    'modulacao',
    'especificacao',
    'executor',
    'prioridade',
    'solicitacao',
    'status',
    'tempoEstimado',
    'tempoEmAtividadeSegundos',
  ];
  const linhas = [
    colunas.join(';'),
    ...demands.map((demanda) => colunas.map((coluna) => campoCsv(demanda[coluna])).join(';')),
  ];
  const blob = new Blob([`\uFEFF${linhas.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'demandas.csv';
  link.click();
  URL.revokeObjectURL(url);
}

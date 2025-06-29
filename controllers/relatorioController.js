const fs = require('fs');
const path = require('path');

const baseRelatoriosDir = path.join(__dirname, '../relatorios');

exports.page = (req, res) => {
  res.render('relatorio'); // Essa view pode listar todos os tipos, como vimos.
};

// 🔽 Cria e salva relatório em uma subpasta (ex: reposicao, fechamento...)
exports.salvar = (req, res) => {
  console.log('Recebido no salvar:', req.body);

  const { quiosque, dados, separador, tipo } = req.body;

  if (!quiosque || !dados || !tipo) {
    return res.status(400).json({ mensagem: "Tipo, quiosque e dados são obrigatórios." });
  }

  const dirDestino = path.join(baseRelatoriosDir, tipo);
  if (!fs.existsSync(dirDestino)) fs.mkdirSync(dirDestino, { recursive: true });

  let texto = `Separador: ${separador || 'Não informado'}\nQuiosque: ${quiosque}\n\n`;
  texto += Object.entries(dados)
    .map(([sku, qtd]) => `${sku}\t${qtd}`)
    .join('\n');

  const nomeArquivo = `${Date.now()}_${quiosque.replace(/[^a-zA-Z0-9-_]/g, '-')}.txt`;
  const caminhoArquivo = path.join(dirDestino, nomeArquivo);

  try {
    fs.writeFileSync(caminhoArquivo, texto, 'utf-8');
    res.json({ mensagem: "Relatório salvo com sucesso!", arquivo: nomeArquivo });
  } catch (err) {
    console.error("Erro ao salvar relatório:", err);
    res.status(500).json({ mensagem: "Erro ao salvar relatório." });
  }
};

// 🔽 Lista relatórios da subpasta
exports.listar = (req, res) => {
  const { tipo } = req.params;
  const dirDestino = path.join(baseRelatoriosDir, tipo);

  fs.readdir(dirDestino, (err, files) => {
    if (err) {
      return res.status(500).json({ mensagem: `Erro ao listar relatórios de ${tipo}.` });
    }
    const txtFiles = files.filter(f => f.endsWith('.txt'));
    res.json(txtFiles);
  });
};

// 🔽 Lê conteúdo de um relatório da subpasta
exports.ler = (req, res) => {
  const { tipo, nomeArquivo } = req.params;
  const caminhoArquivo = path.join(baseRelatoriosDir, tipo, nomeArquivo);

  if (!nomeArquivo.endsWith('.txt') || nomeArquivo.includes('..')) {
    return res.status(400).json({ mensagem: 'Nome de arquivo inválido.' });
  }

  if (req.query.raw === 'true') {
    return res.download(caminhoArquivo, nomeArquivo);
  }

  fs.readFile(caminhoArquivo, 'utf-8', (err, data) => {
    if (err) {
      return res.status(404).json({ mensagem: 'Arquivo não encontrado.' });
    }
    res.json({ conteudo: data });
  });
};

// 🔽 Exclui relatório da subpasta
exports.deletar = (req, res) => {
  const { tipo, nomeArquivo } = req.params;
  const caminhoArquivo = path.join(baseRelatoriosDir, tipo, nomeArquivo);

  if (!nomeArquivo.endsWith('.txt') || nomeArquivo.includes('..')) {
    return res.status(400).json({ mensagem: 'Nome de arquivo inválido.' });
  }

  fs.unlink(caminhoArquivo, (err) => {
    if (err) {
      return res.status(404).json({ mensagem: 'Arquivo não encontrado ou erro ao apagar.' });
    }
    res.json({ mensagem: 'Arquivo apagado com sucesso.' });
  });
};

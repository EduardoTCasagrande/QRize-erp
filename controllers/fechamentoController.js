const fs = require('fs');
const path = require('path');

const pastaFechamento = path.join(__dirname, '..', 'relatorios', 'fechamento');

exports.listarFechamentos = (req, res) => {
  fs.readdir(pastaFechamento, (err, files) => {
    if (err) {
      console.error('Erro ao listar arquivos de fechamento:', err);
      return res.status(500).json({ erro: 'Erro ao listar arquivos de fechamento.' });
    }

    const arquivosTxt = files.filter(file => file.endsWith('.txt'));
    res.json(arquivosTxt);
  });
};

exports.paginaFechamentos = (req, res) => {
  fs.readdir(pastaFechamento, (err, files) => {
    if (err) {
      return res.status(500).send('Erro ao listar relatórios.');
    }
    const arquivosTxt = files.filter(f => f.endsWith('.txt'));
    res.render('fechamentos', { arquivos: arquivosTxt });
  });
};

exports.ler = (req, res) => {
  const nomeArquivo = req.params.nomeArquivo;

  if (!nomeArquivo.endsWith('.txt') || nomeArquivo.includes('..')) {
    return res.status(400).json({ mensagem: 'Nome de arquivo inválido.' });
  }

  const caminhoArquivo = path.join(pastaFechamento, nomeArquivo);

  if (req.query.raw === 'true') {
    return res.download(caminhoArquivo, nomeArquivo, (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(404).send('Arquivo não encontrado para download.');
        }
      }
    });
  }

  fs.readFile(caminhoArquivo, 'utf-8', (err, data) => {
    if (err) {
      return res.status(404).json({ mensagem: 'Arquivo não encontrado para visualização.' });
    }
    // Retorna JSON para a leitura no front-end
    res.json({ conteudo: data });
  });
};

exports.deletar = (req, res) => {
  const nomeArquivo = req.params.nomeArquivo;

  if (!nomeArquivo.endsWith('.txt') || nomeArquivo.includes('..')) {
    return res.status(400).json({ mensagem: 'Nome de arquivo inválido.' });
  }

  const caminhoArquivo = path.join(pastaFechamento, nomeArquivo);

  fs.unlink(caminhoArquivo, (err) => {
    if (err) {
      return res.status(404).json({ mensagem: 'Arquivo não encontrado ou erro ao apagar.' });
    }
    res.json({ mensagem: 'Arquivo apagado com sucesso.' });
  });
};

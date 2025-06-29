const db = require('../models/db');
const bcrypt = require('bcrypt');

// Página de gerenciamento
exports.gerenciarPage = (req, res) => {
  if (!req.session.user || !req.session.user.admin) {
    return res.status(403).send('Acesso negado.');
  }

  db.all('SELECT id, username, quiosque, nivel FROM usuarios', [], (err, usuarios) => {
    if (err) {
      console.error('Erro ao buscar usuários:', err.message);
      return res.status(500).send('Erro ao buscar usuários.');
    }

    db.all('SELECT nome FROM quiosques', [], (err2, quiosques) => {
      if (err2) {
        console.error('Erro ao buscar quiosques:', err2.message);
        return res.status(500).send('Erro ao buscar quiosques.');
      }

      res.render('gerenciar-usuarios', {
        usuarios,
        quiosques,
        userSession: req.session.user
      });
    });
  });
};

// Atualizar senha
exports.atualizarSenha = async (req, res) => {
  const { id, novaSenha } = req.body;

  if (!req.session.user || !req.session.user.admin) {
    return res.status(403).json({ status: 'erro', mensagem: 'Acesso negado.' });
  }

  if (!id || !novaSenha) {
    return res.status(400).json({ status: 'erro', mensagem: 'Dados incompletos.' });
  }

  db.get('SELECT nivel FROM usuarios WHERE id = ?', [id], async (err, row) => {
    if (err) return res.status(500).json({ status: 'erro', mensagem: 'Erro ao verificar usuário.' });
    if (!row) return res.status(404).json({ status: 'erro', mensagem: 'Usuário não encontrado.' });
    if (row.nivel === 'deus') return res.status(403).json({ status: 'erro', mensagem: 'Senha do DEUS não pode ser alterada.' });

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    db.run('UPDATE usuarios SET senha = ? WHERE id = ?', [senhaHash, id], function (err) {
      if (err) return res.status(500).json({ status: 'erro', mensagem: 'Erro ao atualizar senha.' });
      res.json({ status: 'ok', mensagem: 'Senha atualizada com sucesso.' });
    });
  });
};

// Atualizar quiosque do usuário
exports.atualizarQuiosque = (req, res) => {
  const { userId, novoQuiosque } = req.body;

  if (!req.session.user || req.session.user.nivel !== 'deus') {
    return res.status(403).json({ status: 'erro', mensagem: 'Apenas DEUS pode alterar o quiosque.' });
  }

  if (!userId || !novoQuiosque) {
    return res.status(400).json({ status: 'erro', mensagem: 'Dados incompletos.' });
  }

  db.run('UPDATE usuarios SET quiosque = ? WHERE id = ?', [novoQuiosque, userId], function (err) {
    if (err) return res.status(500).json({ status: 'erro', mensagem: 'Erro ao atualizar quiosque.' });
    if (this.changes === 0) return res.status(404).json({ status: 'erro', mensagem: 'Usuário não encontrado.' });

    res.json({ status: 'ok', mensagem: 'Quiosque do usuário atualizado com sucesso!' });
  });
};

// Atualizar username
exports.atualizarUsername = (req, res) => {
  const { userId, novoUsername } = req.body;

  if (!req.session.user || req.session.user.nivel !== 'deus') {
    return res.status(403).json({ status: 'erro', mensagem: 'Apenas DEUS pode alterar o username.' });
  }

  if (!userId || !novoUsername) {
    return res.status(400).json({ status: 'erro', mensagem: 'Dados incompletos.' });
  }

  db.get('SELECT id FROM usuarios WHERE username = ?', [novoUsername], (err, row) => {
    if (err) return res.status(500).json({ status: 'erro', mensagem: 'Erro ao verificar username.' });
    if (row) return res.status(400).json({ status: 'erro', mensagem: 'Username já está em uso.' });

    db.run('UPDATE usuarios SET username = ? WHERE id = ?', [novoUsername, userId], function (err) {
      if (err) return res.status(500).json({ status: 'erro', mensagem: 'Erro ao atualizar username.' });
      if (this.changes === 0) return res.status(404).json({ status: 'erro', mensagem: 'Usuário não encontrado.' });

      res.json({ status: 'ok', mensagem: 'Username atualizado com sucesso!' });
    });
  });
};

// Atualizar nome do quiosque
exports.atualizarNomeQuiosque = (req, res) => {
  const { nomeAntigo, nomeNovo } = req.body;

  if (!req.session.user || req.session.user.nivel !== 'deus') {
    return res.status(403).json({ status: 'erro', mensagem: 'Apenas DEUS pode alterar nome do quiosque.' });
  }

  if (!nomeAntigo || !nomeNovo) {
    return res.status(400).json({ status: 'erro', mensagem: 'Dados incompletos.' });
  }

  db.get('SELECT nome FROM quiosques WHERE nome = ?', [nomeNovo], (err, row) => {
    if (err) return res.status(500).json({ status: 'erro', mensagem: 'Erro ao verificar nome.' });
    if (row) return res.status(400).json({ status: 'erro', mensagem: 'Já existe um quiosque com esse nome.' });

    db.run('UPDATE quiosques SET nome = ? WHERE nome = ?', [nomeNovo, nomeAntigo], function (err) {
      if (err) return res.status(500).json({ status: 'erro', mensagem: 'Erro ao atualizar nome.' });
      if (this.changes === 0) return res.status(404).json({ status: 'erro', mensagem: 'Quiosque não encontrado.' });

      res.json({ status: 'ok', mensagem: 'Nome do quiosque atualizado com sucesso!' });
    });
  });
};

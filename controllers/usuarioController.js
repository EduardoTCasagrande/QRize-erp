const pool = require('../models/postgres'); 
const bcrypt = require('bcrypt');

// Página de gerenciamento
exports.gerenciarPage = async (req, res) => {
  if (!req.session.user || !req.session.user.admin) {
    return res.status(403).send('Acesso negado.');
  }

  try {
    const usuariosResult = await pool.query('SELECT id, username, quiosque_id, nivel FROM usuarios');
    const quiosquesResult = await pool.query('SELECT nome FROM quiosques');

    res.render('gerenciar-usuarios', {
      usuarios: usuariosResult.rows,
      quiosques: quiosquesResult.rows,
      userSession: req.session.user
    });
  } catch (err) {
    console.error('Erro ao buscar dados:', err.message);
    res.status(500).send('Erro ao buscar dados.');
  }
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

  try {
    const result = await db.query('SELECT nivel FROM usuarios WHERE id = $1', [id]);
    const usuario = result.rows[0];
    if (!usuario) return res.status(404).json({ status: 'erro', mensagem: 'Usuário não encontrado.' });
    if (usuario.nivel === 'deus') return res.status(403).json({ status: 'erro', mensagem: 'Senha do DEUS não pode ser alterada.' });

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await db.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [senhaHash, id]);

    res.json({ status: 'ok', mensagem: 'Senha atualizada com sucesso.' });
  } catch (err) {
    console.error('Erro ao atualizar senha:', err.message);
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao atualizar senha.' });
  }
};

// Atualizar quiosque do usuário
exports.atualizarQuiosque = async (req, res) => {
  const { userId, novoQuiosque } = req.body;

  if (!req.session.user || req.session.user.nivel !== 'DEUS') {
    return res.status(403).json({ status: 'erro', mensagem: 'Apenas DEUS pode alterar o quiosque.' });
  }

  if (!userId || !novoQuiosque) {
    return res.status(400).json({ status: 'erro', mensagem: 'Dados incompletos.' });
  }

  try {
    const result = await pool.query('UPDATE usuarios SET quiosque_id = $1 WHERE id = $2 RETURNING id', [novoQuiosque, userId]);
    if (result.rowCount === 0) return res.status(404).json({ status: 'erro', mensagem: 'Usuário não encontrado.' });

    res.json({ status: 'ok', mensagem: 'Quiosque do usuário atualizado com sucesso!' });
  } catch (err) {
    console.error('Erro ao atualizar quiosque:', err.message);
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao atualizar quiosque.' });
  }
};

// Atualizar username
exports.atualizarUsername = async (req, res) => {
  const { userId, novoUsername } = req.body;

  if (!req.session.user || req.session.user.nivel !== 'DEUS') {
    return res.status(403).json({ status: 'erro', mensagem: 'Apenas DEUS pode alterar o username.' });
  }

  if (!userId || !novoUsername) {
    return res.status(400).json({ status: 'erro', mensagem: 'Dados incompletos.' });
  }

  try {
    const check = await pool.query('SELECT id FROM usuarios WHERE username = $1', [novoUsername]);
    if (check.rowCount > 0) return res.status(400).json({ status: 'erro', mensagem: 'Username já está em uso.' });

    const result = await pool.query('UPDATE usuarios SET username = $1 WHERE id = $2 RETURNING id', [novoUsername, userId]);
    if (result.rowCount === 0) return res.status(404).json({ status: 'erro', mensagem: 'Usuário não encontrado.' });

    res.json({ status: 'ok', mensagem: 'Username atualizado com sucesso!' });
  } catch (err) {
    console.error('Erro ao atualizar username:', err.message);
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao atualizar username.' });
  }
};

// Atualizar nome do quiosque
exports.atualizarNomeQuiosque = async (req, res) => {
  const { nomeAntigo, nomeNovo } = req.body;

  if (!req.session.user || req.session.user.nivel !== 'DEUS') {
    return res.status(403).json({ status: 'erro', mensagem: 'Apenas DEUS pode alterar nome do quiosque.' });
  }

  if (!nomeAntigo || !nomeNovo) {
    return res.status(400).json({ status: 'erro', mensagem: 'Dados incompletos.' });
  }

  try {
    const check = await pool.query('SELECT nome FROM quiosques WHERE nome = $1', [nomeNovo]);
    if (check.rowCount > 0) return res.status(400).json({ status: 'erro', mensagem: 'Já existe um quiosque com esse nome.' });

    const result = await pool.query('UPDATE quiosques SET nome = $1 WHERE nome = $2 RETURNING nome', [nomeNovo, nomeAntigo]);
    if (result.rowCount === 0) return res.status(404).json({ status: 'erro', mensagem: 'Quiosque não encontrado.' });

    res.json({ status: 'ok', mensagem: 'Nome do quiosque atualizado com sucesso!' });
  } catch (err) {
    console.error('Erro ao atualizar nome do quiosque:', err.message);
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao atualizar nome.' });
  }
};

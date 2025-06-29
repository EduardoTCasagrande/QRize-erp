const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../quiosques.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite em', dbPath);
  }
});

// Tabela de quiosques
db.run(`CREATE TABLE IF NOT EXISTS quiosques (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  range TEXT NOT NULL,
  colunas TEXT NOT NULL
)`);

// Tabela de estoque por quiosque
db.run(`CREATE TABLE IF NOT EXISTS estoque_quiosque (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiosque TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  UNIQUE(quiosque, sku)
)`);

db.run(`CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  quiosque TEXT NOT NULL,
  admin INTEGER NOT NULL DEFAULT 0,
  nivel TEXT NOT NULL DEFAULT 'user',   -- <-- Nivel do usuário (user, admin, repositor)
  FOREIGN KEY (quiosque) REFERENCES quiosques(nome) 
)`, (err) => {
  if (err) console.error("Erro ao criar tabela usuarios:", err.message);
});

// Tabela de preços com foto por SKU
db.run(`CREATE TABLE IF NOT EXISTS precos (
  sku TEXT PRIMARY KEY,
  preco REAL NOT NULL,
  foto TEXT
)`, (err) => {
  if (err) console.error('Erro ao criar tabela precos:', err.message);
});

// Tabela de movimentos de caixa
db.run(`CREATE TABLE IF NOT EXISTS caixa_movimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiosque TEXT NOT NULL,
  valor REAL NOT NULL,
  forma_pagamento TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (quiosque) REFERENCES quiosques(nome)
)`, (err) => {
  if (err) console.error('Erro ao criar tabela caixa_movimentos:', err.message);
});

// Tabela de histórico de transações
db.run(`CREATE TABLE IF NOT EXISTS historico_transacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_venda INTEGER,
  tipo TEXT NOT NULL,
  quiosque TEXT NOT NULL,
  sku TEXT,
  quantidade INTEGER,
  valor REAL,
  operador TEXT,
  data TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
)`, (err) => {
  if (err) console.error('Erro ao criar tabela historico_transacoes:', err.message);
});

// Tabela de status do caixa (aberto/fechado)
db.run(`CREATE TABLE IF NOT EXISTS caixa_status (
  quiosque TEXT PRIMARY KEY,
  aberto INTEGER NOT NULL DEFAULT 0,
  valor_inicial REAL DEFAULT 0,
  data_abertura TEXT,
  data_fechamento TEXT,
  FOREIGN KEY (quiosque) REFERENCES quiosques(nome)
)`, (err) => {
  if (err) console.error('Erro ao criar tabela caixa_status:', err.message);
});


module.exports = db;

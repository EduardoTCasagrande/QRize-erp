const db = require('./models/db'); // ajuste o caminho conforme sua estrutura

function limparDados() {
  const tabelas = ['caixa_movimentos', 'historico_transacoes', 'usuarios'];

  tabelas.forEach(tabela => {
    db.run(`DELETE FROM ${tabela}`, (err) => {
      if (err) {
        console.error(`Erro ao limpar ${tabela}:`, err.message);
      } else {
        console.log(`✅ Tabela ${tabela} limpa com sucesso.`);
      }
    });
  });
}

limparDados();

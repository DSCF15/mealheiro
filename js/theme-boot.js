// Aplica o tema antes da primeira pintura para evitar um clarão branco.
(function () {
  try {
    var raw = localStorage.getItem('mealheiro.v1');
    var theme = raw ? (JSON.parse(raw).settings || {}).theme : null;
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  } catch (e) { /* usa o tema do sistema */ }
})();

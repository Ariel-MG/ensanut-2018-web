/**
 * Lógica del Dashboard (index.html). Deriva de src/pages/Dashboard.jsx,
 * conservando KPIs + lista de tablas + buscador (sin gráficas).
 */
(async function initDashboard() {
  initLayout({ currentTable: null });

  const listEl = document.getElementById('tabla-list');

  let data;
  try {
    data = await dataService.getTablas();
  } catch (e) {
    listEl.innerHTML = `<div class="state"><h2>Error</h2><p>${e.message}</p></div>`;
    return;
  }

  const tablas = data.tablas || [];

  // --- KPIs ---
  const totalRegistros = tablas.reduce((acc, t) => acc + (t.total_registros || 0), 0);
  const totalCS = tablas.filter((t) => t.dominio === 'CS').reduce((a, t) => a + (t.total_registros || 0), 0);
  const totalCN = tablas.filter((t) => t.dominio === 'CN').reduce((a, t) => a + (t.total_registros || 0), 0);

  document.getElementById('kpi-registros').textContent = fmtNum(totalRegistros);
  document.getElementById('kpi-tablas').textContent    = fmtNum(data.total_tablas ?? tablas.length);
  document.getElementById('kpi-cs').textContent        = fmtNum(totalCS);
  document.getElementById('kpi-cn').textContent        = fmtNum(totalCN);

  // --- Lista de tablas (ordenada por volumen) ---
  const ordenadas = tablas.slice().sort((a, b) => b.total_registros - a.total_registros);

  if (!ordenadas.length) {
    listEl.innerHTML = `<div class="state"><h2>Sin tablas</h2><p>No hay tablas disponibles.</p></div>`;
    return;
  }

  listEl.innerHTML = ordenadas.map((t) => `
    <a class="tabla-item" href="explorer.html?tabla=${encodeURIComponent(t.nombre)}">
      <div>
        <div class="tabla-item__name">${t.nombre}<span class="badge-dominio">${t.dominio}</span></div>
        <div class="tabla-item__meta">${t.descripcion_dominio} · ${t.total_columnas} columnas</div>
      </div>
      <div class="tabla-item__count">${fmtNum(t.total_registros)}</div>
    </a>
  `).join('');
})();

/**
 * Lógica del Dashboard (index.html). Deriva de src/pages/Dashboard.jsx,
 * conservando KPIs + lista de tablas + vistas + buscador (sin gráficas).
 */
(async function initDashboard() {
  initLayout({ currentTable: null });

  const listEl   = document.getElementById('tabla-list');
  const vistasEl = document.getElementById('vistas-list');

  const errorState = (msg, ic = 'alert') =>
    `<div class="state"><div class="state__icon">${icon(ic, 'icon--lg')}</div><h2>Error</h2><p>${escapeHtml(msg)}</p></div>`;

  let data;
  try {
    data = await dataService.getTablas();
  } catch (e) {
    listEl.innerHTML = errorState(e.message);
    if (vistasEl) vistasEl.innerHTML = '';
    return;
  }

  const entidades = data.tablas || [];
  const tablas = entidades.filter((t) => t.tipo !== 'vista');
  const vistas = entidades.filter((t) => t.tipo === 'vista');

  // --- KPIs (sólo tablas para registros/totales) ---
  const totalRegistros = tablas.reduce((acc, t) => acc + (t.total_registros || 0), 0);
  const totalCS = tablas.filter((t) => t.dominio === 'CS').reduce((a, t) => a + (t.total_registros || 0), 0);
  const totalCN = tablas.filter((t) => t.dominio === 'CN').reduce((a, t) => a + (t.total_registros || 0), 0);

  document.getElementById('kpi-registros').textContent = fmtNum(totalRegistros);
  document.getElementById('kpi-tablas').textContent    = fmtNum(data.total_tablas ?? tablas.length);
  document.getElementById('kpi-vistas').textContent    = fmtNum(data.total_vistas ?? vistas.length);
  document.getElementById('kpi-cs').textContent        = fmtNum(totalCS);
  document.getElementById('kpi-cn').textContent        = fmtNum(totalCN);

  // --- Tarjeta de tabla ---
  function cardTabla(t) {
    const dom = t.dominio === 'CS' ? 'CS' : 'CN';
    return `
      <a class="tabla-item" href="explorer.html?tabla=${encodeURIComponent(t.nombre)}">
        <div class="tabla-item__icon" data-dom="${dom}">${icon(dom === 'CS' ? 'activity' : 'leaf')}</div>
        <div class="tabla-item__body">
          <div class="tabla-item__name"><span class="tabla-item__nametext">${escapeHtml(t.nombre)}</span><span class="badge-dominio" data-dom="${dom}">${dom}</span></div>
          <div class="tabla-item__meta">${escapeHtml(t.descripcion_dominio)} · ${t.total_columnas} columnas</div>
        </div>
        <div class="tabla-item__count">${fmtNum(t.total_registros)}<small>registros</small></div>
      </a>`;
  }

  // --- Tarjeta de vista (sin conteo de filas) ---
  function cardVista(t) {
    return `
      <a class="tabla-item tabla-item--vista" href="explorer.html?tabla=${encodeURIComponent(t.nombre)}">
        <div class="tabla-item__icon" data-dom="VW">${icon('layers')}</div>
        <div class="tabla-item__body">
          <div class="tabla-item__name"><span class="tabla-item__nametext">${escapeHtml(t.nombre)}</span><span class="badge-dominio" data-dom="VW">Vista</span></div>
          <div class="tabla-item__meta">${escapeHtml(t.descripcion_dominio)} · ${t.total_columnas} columnas</div>
        </div>
        <div class="tabla-item__count"><svg class="icon" aria-hidden="true"><use href="assets/img/ui-icons.svg#i-arrow-right"></use></svg></div>
      </a>`;
  }

  // --- Render tablas ---
  if (!tablas.length) {
    listEl.innerHTML = `<div class="state"><div class="state__icon">${icon('folder', 'icon--lg')}</div><h2>Sin tablas</h2><p>No hay tablas disponibles.</p></div>`;
  } else {
    listEl.innerHTML = tablas.slice().sort((a, b) => b.total_registros - a.total_registros).map(cardTabla).join('');
  }

  // --- Render vistas ---
  if (!vistas.length) {
    document.getElementById('vistas-title').style.display = 'none';
    vistasEl.style.display = 'none';
  } else {
    vistasEl.innerHTML = vistas.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(cardVista).join('');
  }
})();

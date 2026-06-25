/**
 * Explorador de datos (explorer.html). Deriva de src/pages/DataExplorer.jsx
 * y src/components/FilterPanel.jsx + MetadataTooltip.jsx.
 *
 * Lee ?tabla= de la URL, carga columnas y registros paginados, permite
 * filtrar dinámicamente y exportar a CSV.
 */
(function initExplorer() {
  const LIMITE = 15;
  const root   = document.getElementById('explorer-root');
  const tabla  = new URLSearchParams(window.location.search).get('tabla');

  // Estado local.
  const state = {
    page: 1,
    filtros: {},
    columnas: [],
  };

  initLayout({ currentTable: tabla });

  // Sin tabla seleccionada → estado vacío.
  if (!tabla) {
    root.innerHTML = `
      <div class="card state" style="height:100%">
        <div class="state__icon">${icon('folder', 'icon--lg')}</div>
        <h2>Ninguna tabla seleccionada</h2>
        <p>Selecciona un módulo desde el menú lateral para comenzar a explorar los datos de la ENSANUT.</p>
      </div>`;
    return;
  }

  /** Escapa texto para insertarlo de forma segura en HTML. */
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /** Parsea "1=Hombre, 2=Mujer" → [{valor:'1', etiqueta:'Hombre'}, ...] o null. */
  function parseRangos(rangos) {
    if (!rangos || !rangos.includes('=')) return null;
    const opciones = [];
    for (const parte of rangos.split(/[,;]/)) {
      const m = parte.trim().match(/^([^=]+)=(.+)$/);
      if (m) opciones.push({ valor: m[1].trim(), etiqueta: m[2].trim() });
    }
    return opciones.length ? opciones : null;
  }

  /** Render del esqueleto (header + controles + contenedores). */
  function renderShell() {
    const nFiltros = Object.keys(state.filtros).length;
    root.innerHTML = `
      <div class="explorer">
        <div class="explorer__header">
          <div class="explorer__title">${icon('table')} ${esc(tabla)}</div>
          <div class="explorer__controls">
            <div class="filter-panel" id="filter-panel">
              <button class="btn btn--ghost" id="filter-toggle">
                ${icon('filter')} Filtros ${nFiltros ? `<span class="filter-badge">${nFiltros}</span>` : ''}
              </button>
              <div class="filter-panel__pop" id="filter-pop"></div>
            </div>
            <button class="btn btn--primary" id="export-btn">${icon('download')} Exportar CSV</button>
          </div>
        </div>
        <div class="explorer__body" id="explorer-body">
          <div class="toast" id="toast">${icon('refresh')} Actualizando...</div>
          <table class="data" id="data-table">
            <thead id="data-head"></thead>
            <tbody id="data-body"></tbody>
          </table>
        </div>
        <div class="pagination">
          <div class="pagination__total" id="total-label">Total de registros: 0</div>
          <div class="pagination__controls">
            <button class="icon-btn" id="prev-btn" aria-label="Anterior">${icon('chevron-left')}</button>
            <span class="pagination__page" id="page-label">Página 1</span>
            <button class="icon-btn" id="next-btn" aria-label="Siguiente">${icon('chevron-right')}</button>
          </div>
        </div>
      </div>`;

    document.getElementById('export-btn').addEventListener('click', () => {
      dataService.exportToCSV(tabla, state.filtros);
    });
    document.getElementById('prev-btn').addEventListener('click', () => {
      if (state.page > 1) { state.page--; loadRegistros(); }
    });
    document.getElementById('next-btn').addEventListener('click', () => {
      state.page++; loadRegistros();
    });
    setupFilterPanel();
  }

  /** Configura el botón y popover de filtros. */
  function setupFilterPanel() {
    const toggle = document.getElementById('filter-toggle');
    const pop    = document.getElementById('filter-pop');
    const panel  = document.getElementById('filter-panel');

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      pop.classList.toggle('is-open');
    });
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target)) pop.classList.remove('is-open');
    });

    // Construir los campos a partir de las columnas.
    pop.innerHTML = `<div class="filter-panel__head">Filtrar ${esc(tabla)}</div>` +
      state.columnas.map((col) => {
        const opciones = parseRangos(col.rangos_claves);
        const actual   = state.filtros[col.nombre] ?? '';
        if (opciones) {
          const opts = ['<option value="">(todos)</option>']
            .concat(opciones.map((o) => `<option value="${esc(o.valor)}" ${actual === o.valor ? 'selected' : ''}>${esc(o.valor)} — ${esc(o.etiqueta)}</option>`))
            .join('');
          return `<div class="filter-row"><label>${esc(col.nombre)}</label><select data-col="${esc(col.nombre)}">${opts}</select></div>`;
        }
        return `<div class="filter-row"><label>${esc(col.nombre)}</label><input type="text" data-col="${esc(col.nombre)}" value="${esc(actual)}" placeholder="filtrar..." /></div>`;
      }).join('') + `
      <div class="filter-panel__actions">
        <button class="btn btn--primary" id="filter-apply" style="flex:1">Aplicar</button>
        <button class="btn btn--ghost" id="filter-clear">Limpiar</button>
      </div>`;

    pop.querySelector('#filter-apply').addEventListener('click', () => {
      const nuevos = {};
      pop.querySelectorAll('[data-col]').forEach((el) => {
        const v = el.value.trim();
        if (v !== '') nuevos[el.dataset.col] = v;
      });
      state.filtros = nuevos;
      state.page = 1;
      pop.classList.remove('is-open');
      renderShell();      // re-render para actualizar el badge
      loadRegistros();
    });
    pop.querySelector('#filter-clear').addEventListener('click', () => {
      state.filtros = {};
      state.page = 1;
      pop.classList.remove('is-open');
      renderShell();
      loadRegistros();
    });
  }

  /** Render del encabezado de la tabla con tooltips de metadatos. */
  function renderHead() {
    const head = document.getElementById('data-head');
    head.innerHTML = '<tr>' + state.columnas.map((col) => {
      const desc = `${col.descripcion ?? ''}${col.rangos_claves ? ` (Rangos: ${col.rangos_claves})` : ''}`;
      return `<th>
        <span class="th-tip">${esc(col.nombre)} ${icon('info', 'th-tip__icon')}
          <span class="th-tip__box">${esc(desc || 'Sin descripción')}</span>
        </span>
      </th>`;
    }).join('') + '</tr>';
  }

  /** Muestra/oculta el toast de "Actualizando". */
  function toast(on) {
    document.getElementById('toast').classList.toggle('is-visible', on);
  }

  /** Carga la página actual de registros y pinta la tabla. */
  async function loadRegistros() {
    const body = document.getElementById('data-body');
    toast(true);
    try {
      const res = await dataService.getRegistros(tabla, {
        pagina: state.page,
        limite: LIMITE,
        ...state.filtros,
      });

      const registros = res.registros || [];
      if (!registros.length) {
        body.innerHTML = `<tr><td class="empty-cell" colspan="${state.columnas.length || 1}">No hay datos disponibles para esta consulta.</td></tr>`;
      } else {
        body.innerHTML = registros.map((row) => '<tr>' + state.columnas.map((col) => {
          const v = row[col.nombre] ?? row[col.nombre.toLowerCase()] ?? '-';
          return `<td>${esc(v)}</td>`;
        }).join('') + '</tr>').join('');
      }

      document.getElementById('total-label').innerHTML = (res.total === null || res.total === undefined)
        ? `${icon('layers')} <strong>Vista analítica</strong> · conteo no calculado`
        : `Total de registros: <strong>${fmtNum(res.total)}</strong>`;
      document.getElementById('page-label').textContent  = `Página ${state.page}`;
      document.getElementById('prev-btn').disabled = state.page <= 1;
      document.getElementById('next-btn').disabled = !res.hay_mas;
    } catch (e) {
      body.innerHTML = `<tr><td colspan="${state.columnas.length || 1}">
        <div class="error-box">
          <div class="state__icon">${icon('alert', 'icon--lg')}</div>
          <h3>Error de consulta</h3>
          <p>${esc(e.message)}</p>
          <button class="btn btn--ghost" id="retry-clear" style="margin-top:12px">Limpiar filtros e intentar</button>
        </div></td></tr>`;
      const btn = document.getElementById('retry-clear');
      if (btn) btn.addEventListener('click', () => { state.filtros = {}; state.page = 1; renderShell(); loadRegistros(); });
    } finally {
      toast(false);
    }
  }

  /** Arranque: cargar columnas, luego registros. */
  (async function start() {
    root.innerHTML = `<div class="card state" style="height:100%"><div class="spinner"></div><p style="margin-top:12px">Cargando columnas...</p></div>`;
    try {
      const colData = await dataService.getColumnas(tabla);
      state.columnas = colData.columnas || [];
    } catch (e) {
      root.innerHTML = `<div class="card state" style="height:100%">
        <div class="state__icon">${icon('alert', 'icon--lg')}</div>
        <h2>Error</h2><p>${esc(e.message)}</p></div>`;
      return;
    }
    renderShell();
    renderHead();
    loadRegistros();
  })();
})();

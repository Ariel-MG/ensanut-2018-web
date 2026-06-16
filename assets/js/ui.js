/**
 * Layout compartido (sidebar + topbar) y buscador global de diccionario.
 * Reemplaza src/layouts/MainLayout.jsx y src/components/DictionarySearchModal.jsx,
 * sin la lógica de sesión (la conexión a BD es fija en el servidor).
 *
 * Uso en cada página:
 *   <body> ... <script src="assets/js/api.js"></script>
 *              <script src="assets/js/ui.js"></script>
 *   y un contenedor con id="app-root" donde se inyecta el layout, o el HTML
 *   define la estructura y llama initLayout({active, currentTable, title}).
 */

/**
 * Inicializa el sidebar y topbar dentro de los contenedores con
 * id="sidebar-nav" (lista de tablas) y id="dict-search" (buscador).
 *
 * @param {Object} opts
 * @param {string} [opts.currentTable]  Tabla activa (para resaltar en el menú).
 */
async function initLayout(opts = {}) {
  const { currentTable = null } = opts;
  renderDictSearch();
  await renderSidebar(currentTable);
}

/**
 * Construye la navegación lateral con la lista de tablas desde la API.
 * @param {string|null} currentTable
 */
async function renderSidebar(currentTable) {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  try {
    const data = await dataService.getTablas();
    const tablas = (data.tablas || []).slice().sort((a, b) => b.total_registros - a.total_registros);

    const dashActive = !currentTable ? 'is-active' : '';
    let html = `
      <a href="index.html" class="navlink ${dashActive}">
        <span>📊</span><span class="navlink__name">Dashboard Resumen</span>
      </a>
      <div class="sidebar__section">Tablas de Datos</div>
    `;

    for (const t of tablas) {
      const active = currentTable === t.nombre ? 'is-active' : '';
      html += `
        <a href="explorer.html?tabla=${encodeURIComponent(t.nombre)}" class="navlink ${active}" title="${t.nombre}">
          <span>🗄️</span><span class="navlink__name">${t.nombre}</span>
        </a>`;
    }
    nav.innerHTML = html;
  } catch (e) {
    nav.innerHTML = `<div class="sidebar__loading">No se pudieron cargar las tablas.</div>`;
  }
}

/**
 * Activa el buscador global de diccionario en el contenedor id="dict-search".
 */
function renderDictSearch() {
  const root = document.getElementById('dict-search');
  if (!root) return;

  root.classList.add('dictsearch');
  root.innerHTML = `
    <input type="text" id="dict-input" placeholder="Buscar variable en el diccionario..." autocomplete="off" />
    <div class="dictsearch__results" id="dict-results"></div>
  `;

  const input   = document.getElementById('dict-input');
  const results = document.getElementById('dict-results');

  const run = debounce(async (term) => {
    if (!term || term.length < 2) {
      results.classList.remove('is-open');
      results.innerHTML = '';
      return;
    }
    try {
      const data = await dataService.buscarDiccionario({ termino: term, limite: 8 });
      const items = data.resultados || [];
      if (!items.length) {
        results.innerHTML = `<div class="dictsearch__empty">Sin resultados para "${term}".</div>`;
      } else {
        results.innerHTML = items.map((r) => `
          <div class="dictresult" data-tabla="${r.nombre_de_la_tabla}">
            <div>
              <span class="dictresult__col">${r.nombre_de_la_columna}</span>
              <span class="dictresult__table">${r.nombre_de_la_tabla}</span>
            </div>
            <div class="dictresult__desc">${r.descripcion ?? ''}</div>
          </div>
        `).join('');
        results.querySelectorAll('.dictresult').forEach((el) => {
          el.addEventListener('click', () => {
            window.location.href = `explorer.html?tabla=${encodeURIComponent(el.dataset.tabla)}`;
          });
        });
      }
      results.classList.add('is-open');
    } catch (e) {
      results.innerHTML = `<div class="dictsearch__empty">Error en la búsqueda.</div>`;
      results.classList.add('is-open');
    }
  }, 350);

  input.addEventListener('input', (e) => run(e.target.value.trim()));
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) results.classList.remove('is-open');
  });
}

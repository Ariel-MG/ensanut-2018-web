/**
 * Layout compartido (sidebar + topbar) y buscador global de diccionario.
 * Reemplaza src/layouts/MainLayout.jsx y src/components/DictionarySearchModal.jsx,
 * sin la lógica de sesión (la conexión a BD es fija en el servidor).
 */

/** Devuelve el markup de un icono del sprite SVG (assets/img/ui-icons.svg). */
function icon(name, cls = '') {
  return `<svg class="icon ${cls}" aria-hidden="true"><use href="assets/img/ui-icons.svg#i-${name}"></use></svg>`;
}

/**
 * Inicializa el sidebar, el buscador y el toggle de menú móvil.
 * @param {Object} opts
 * @param {string} [opts.currentTable]  Tabla activa (para resaltar en el menú).
 */
async function initLayout(opts = {}) {
  const { currentTable = null } = opts;
  setupNavToggle();
  renderDictSearch();
  await renderSidebar(currentTable);
}

/**
 * Botón ☰: en móvil abre/cierra el sidebar como cajón (nav-open); en escritorio
 * lo oculta/muestra (nav-collapsed) y recuerda la preferencia en localStorage.
 */
function setupNavToggle() {
  const app  = document.getElementById('app');
  const btn  = document.getElementById('menu-btn');
  const back = document.getElementById('backdrop');
  if (!app) return;

  const isMobile = () => window.matchMedia('(max-width: 1024px)').matches;

  // Restaurar preferencia de escritorio.
  if (localStorage.getItem('ensanut-nav') === 'collapsed') app.classList.add('nav-collapsed');

  const toggle = () => {
    if (isMobile()) {
      app.classList.toggle('nav-open');
    } else {
      app.classList.toggle('nav-collapsed');
      localStorage.setItem('ensanut-nav', app.classList.contains('nav-collapsed') ? 'collapsed' : 'open');
    }
  };
  const closeMobile = () => app.classList.remove('nav-open');

  if (btn)  btn.addEventListener('click', toggle);
  if (back) back.addEventListener('click', closeMobile);
  // Al navegar desde el menú, cerrar el cajón móvil.
  document.getElementById('sidebar-nav')?.addEventListener('click', (e) => {
    if (e.target.closest('a') && isMobile()) closeMobile();
  });
  // Al cruzar a escritorio, asegurar que el cajón móvil quede cerrado.
  window.addEventListener('resize', () => { if (!isMobile()) closeMobile(); });
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
    const entidades = data.tablas || [];
    const tablas = entidades.filter((t) => t.tipo !== 'vista').sort((a, b) => b.total_registros - a.total_registros);
    const vistas = entidades.filter((t) => t.tipo === 'vista').sort((a, b) => a.nombre.localeCompare(b.nombre));

    const dashActive = !currentTable ? 'is-active' : '';
    let html = `
      <a href="index.html" class="navlink ${dashActive}">
        ${icon('dashboard')}<span class="navlink__name">Dashboard Resumen</span>
      </a>
      <div class="sidebar__section">Tablas de datos</div>
    `;

    for (const t of tablas) {
      const active = currentTable === t.nombre ? 'is-active' : '';
      html += `
        <a href="explorer.html?tabla=${encodeURIComponent(t.nombre)}" class="navlink ${active}" title="${t.nombre} · ${fmtNum(t.total_registros)} registros">
          ${icon('table')}<span class="navlink__name">${t.nombre}</span>
          <span class="navlink__count">${fmtCompact(t.total_registros)}</span>
        </a>`;
    }

    if (vistas.length) {
      html += `<div class="sidebar__section">Vistas analíticas</div>`;
      for (const t of vistas) {
        const active = currentTable === t.nombre ? 'is-active' : '';
        html += `
          <a href="explorer.html?tabla=${encodeURIComponent(t.nombre)}" class="navlink ${active}" title="${t.nombre} (vista)">
            ${icon('layers')}<span class="navlink__name">${t.nombre}</span>
          </a>`;
      }
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
    <div class="dictsearch__field">
      ${icon('search')}
      <input type="text" id="dict-input" placeholder="Buscar variable en el diccionario..." autocomplete="off" />
    </div>
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
        results.innerHTML = `<div class="dictsearch__empty">Sin resultados para "${escapeHtml(term)}".</div>`;
      } else {
        results.innerHTML = items.map((r) => `
          <div class="dictresult" data-tabla="${escapeHtml(r.nombre_de_la_tabla)}">
            <div>
              <span class="dictresult__col">${escapeHtml(r.nombre_de_la_columna)}</span>
              <span class="dictresult__table">${escapeHtml(r.nombre_de_la_tabla)}</span>
            </div>
            <div class="dictresult__desc">${escapeHtml(r.descripcion ?? '')}</div>
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

/** Escapa texto para insertarlo de forma segura en HTML. */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Formato compacto de números grandes para chips del menú (3.7M, 43K). */
function fmtCompact(n) {
  return Number(n || 0).toLocaleString('es-MX', { notation: 'compact', maximumFractionDigits: 1 });
}

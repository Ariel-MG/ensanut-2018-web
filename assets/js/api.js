/**
 * Capa de datos del frontend. Reemplaza src/services/api.js (axios + react-query).
 * Usa fetch() contra rutas relativas /api, sin sesión ni interceptores.
 */

// Modo de routing:
//   false → llamadas directas a api/index.php?r=... (NO requiere mod_rewrite).
//           Es lo más compatible, incluyendo hosting en subcarpetas (/~usuario/).
//   true  → URLs limpias (requiere mod_rewrite y AllowOverride): api/tablas/...
const USE_REWRITE = false;

/**
 * Directorio del documento actual, con '/' final. Soporta despliegues en
 * subrutas como https://host/~datascience/ (no asume la raíz del dominio).
 * @returns {string}
 */
function baseDir() {
  return window.location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
}

/**
 * Construye la URL absoluta de un endpoint, según el modo de routing.
 * @param {string} path  Ruta relativa, ej: '/tablas/CS_ADULTOS/registros'
 * @param {Object} [params]  Parámetros de query.
 * @returns {string}
 */
function apiUrl(path, params = {}) {
  const clean = String(path).replace(/^\/+/, ''); // sin '/' inicial
  let url;
  if (USE_REWRITE) {
    url = new URL('api/' + clean, baseDir());
  } else {
    url = new URL('api/index.php', baseDir());
    url.searchParams.set('r', clean);
  }
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  return url.toString();
}

/**
 * Realiza un GET a la API y devuelve el JSON. Lanza Error con mensaje legible.
 * @param {string} path  Ruta relativa, ej: '/tablas'
 * @param {Object} [params]  Parámetros de query.
 * @returns {Promise<any>}
 */
async function apiGet(path, params = {}) {
  const res = await fetch(apiUrl(path, params));
  let body = null;
  try { body = await res.json(); } catch (_) { /* respuesta no-JSON */ }

  if (!res.ok) {
    const msg = body?.error?.message || `Error ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

const dataService = {
  /** Lista de tablas con dominio y conteos. */
  getTablas: () => apiGet('/tablas'),

  /** Columnas de una tabla con descripciones del diccionario. */
  getColumnas: (tabla) => apiGet(`/tablas/${encodeURIComponent(tabla)}/columnas`),

  /** Registros paginados con filtros dinámicos. */
  getRegistros: (tabla, params) => apiGet(`/tablas/${encodeURIComponent(tabla)}/registros`, params),

  /** Busca variables en el diccionario de datos. */
  buscarDiccionario: (params) => apiGet('/diccionario', params),

  /** Abre la descarga del CSV filtrado en una pestaña nueva. */
  exportToCSV: (tabla, filtros = {}, columnas = []) => {
    const params = { ...filtros };
    if (columnas.length) params.columnas = columnas.join(',');
    window.open(apiUrl(`/tablas/${encodeURIComponent(tabla)}/exportar`, params), '_blank');
  },
};

/**
 * Crea una versión "debounced" de una función.
 * @param {Function} fn
 * @param {number} wait  ms
 * @returns {Function}
 */
function debounce(fn, wait = 350) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Formatea un número con separadores de miles (es-MX). */
function fmtNum(n) {
  return Number(n || 0).toLocaleString('es-MX');
}

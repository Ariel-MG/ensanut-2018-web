<?php
/**
 * Front controller de la API ENSANUT 2018 (PHP/PostgreSQL).
 *
 * Enruta las peticiones /api/... a los controladores. Reemplaza a
 * app/main.py (FastAPI). Soporta dos modos de routing:
 *   1) Reescritura limpia vía .htaccess  → /api/tablas/CS_ADULTOS/registros
 *   2) Fallback sin mod_rewrite          → /api/index.php?r=tablas/CS_ADULTOS/registros
 */

require __DIR__ . '/helpers.php';
require __DIR__ . '/db.php';
require __DIR__ . '/controllers/tablas.php';
require __DIR__ . '/controllers/diccionario.php';

// Manejo global de errores → JSON estandarizado.
set_exception_handler(function (Throwable $e) {
    if ($e instanceof ApiError) {
        json_error($e->apiCode, $e->getMessage(), $e->status);
    }
    error_log('[ensanut-api] ' . $e->getMessage());
    json_error('internal_error', 'Error interno del servidor.', 500);
});

/**
 * Obtiene la ruta solicitada relativa a /api, sin query string.
 *
 * @return string Ej: "tablas/CS_ADULTOS/registros"
 */
function ruta_actual(): string
{
    // Modo fallback explícito.
    if (isset($_GET['r'])) {
        return trim($_GET['r'], '/');
    }

    $uri  = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
    $uri  = rawurldecode($uri);

    // Recortar todo hasta (e incluyendo) "/api/".
    $pos = strpos($uri, '/api/');
    if ($pos !== false) {
        return trim(substr($uri, $pos + 5), '/');
    }
    // Si se invoca como /api o /api/
    $pos = strpos($uri, '/api');
    if ($pos !== false) {
        return trim(substr($uri, $pos + 4), '/');
    }
    return trim($uri, '/');
}

$ruta   = ruta_actual();
$pdo    = db();
$partes = $ruta === '' ? [] : explode('/', $ruta);

// --- Enrutamiento ---------------------------------------------------------

// GET /api  o  /api/  → health check
if (count($partes) === 0) {
    json_response(['status' => 'ok', 'version' => '2.0.0-php']);
}

switch ($partes[0]) {
    case 'tablas':
        if (count($partes) === 1) {
            // GET /api/tablas
            ctrl_tablas_lista($pdo);
        }
        $tabla = $partes[1] ?? '';
        $sub   = $partes[2] ?? '';
        if ($tabla === '') {
            json_error('not_found', 'Tabla no especificada.', 404);
        }
        switch ($sub) {
            case 'columnas':
                ctrl_tablas_columnas($pdo, $tabla);
            case 'registros':
                ctrl_tablas_registros($pdo, $tabla);
            case 'exportar':
                ctrl_tablas_exportar($pdo, $tabla);
            default:
                json_error('not_found', "Recurso no encontrado: /tablas/$tabla/$sub", 404);
        }
        break;

    case 'diccionario':
        ctrl_diccionario($pdo);
        break;

    default:
        json_error('not_found', "Ruta no encontrada: /$ruta", 404);
}

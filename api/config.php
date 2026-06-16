<?php
/**
 * Configuración de conexión a PostgreSQL.
 *
 * Orden de prioridad:
 *   1) api/config.local.php  → archivo NO versionado con las credenciales reales
 *      (recomendado en producción). Copia config.local.example.php a
 *      config.local.php y edítalo en el servidor. Está en .gitignore, así que
 *      nunca se sube al repo.
 *   2) Variables de entorno: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD,
 *      DB_IDENT_CASE.
 *   3) Los valores por defecto de abajo (solo para desarrollo).
 */

$localFile = __DIR__ . '/config.local.php';
if (is_file($localFile)) {
    return require $localFile;
}

return [
    'host'     => getenv('DB_HOST')     ?: 'localhost',
    'port'     => getenv('DB_PORT')     ?: '5432',
    'dbname'   => getenv('DB_NAME')     ?: 'ensanut',
    'user'     => getenv('DB_USER')     ?: 'postgres',
    'password' => getenv('DB_PASSWORD') ?: '',

    // Case de identificadores en la BD destino.
    //   'lower' → tablas/columnas en minúsculas (default de Postgres sin comillas).
    //   'upper' → tablas/columnas en MAYÚSCULAS, almacenadas entre comillas.
    // Verifícalo con:  SELECT table_name FROM information_schema.tables WHERE table_schema='public';
    'ident_case' => getenv('DB_IDENT_CASE') ?: 'lower',
];

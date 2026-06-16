<?php
/**
 * Configuración de conexión a PostgreSQL.
 *
 * Las credenciales se leen de variables de entorno si existen; si no, usan los
 * valores por defecto de abajo. En el servidor de producción, define las
 * variables de entorno o edita los defaults — y, de ser posible, mueve este
 * archivo fuera del webroot.
 *
 * Variables soportadas: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
 */

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

<?php
/**
 * PLANTILLA de credenciales. NO contiene datos reales.
 *
 * En el servidor:
 *   1) cp api/config.local.example.php api/config.local.php
 *   2) edita api/config.local.php con tus credenciales reales de PostgreSQL.
 *
 * config.local.php está en .gitignore → nunca se sube al repo (importante
 * porque el repo es público).
 */

return [
    'host'       => 'localhost',
    'port'       => '5432',
    'dbname'     => 'ensanut',
    'user'       => 'TU_USUARIO',
    'password'   => 'TU_PASSWORD',

    // Schema donde están las tablas ENSANUT (ej. 'ensanut'). 'public' por defecto.
    'schema'     => 'public',

    // 'lower' si las tablas están en minúsculas (cs_adultos),
    // 'upper' si están en MAYÚSCULAS (CS_ADULTOS). Verifícalo con:
    //   SELECT table_name FROM information_schema.tables WHERE table_schema='public';
    'ident_case' => 'lower',
];

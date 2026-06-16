<?php
/**
 * Conexión PDO a PostgreSQL (singleton) y helpers de identificadores.
 *
 * Reemplaza a app/core/database.py + app/db/* del backend FastAPI original,
 * pero con una única conexión fija (sin sesiones ni conexión dinámica).
 */

/**
 * Devuelve la conexión PDO compartida, creándola en el primer uso.
 *
 * @return PDO
 * @throws RuntimeException si falla la conexión.
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $cfg = require __DIR__ . '/config.php';

    $dsn = sprintf(
        'pgsql:host=%s;port=%s;dbname=%s',
        $cfg['host'],
        $cfg['port'],
        $cfg['dbname']
    );

    try {
        $pdo = new PDO($dsn, $cfg['user'], $cfg['password'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $e) {
        throw new RuntimeException('No se pudo conectar a la base de datos.', 0, $e);
    }

    return $pdo;
}

/**
 * Devuelve el case configurado para los identificadores ('lower' | 'upper').
 *
 * @return string
 */
function ident_case(): string
{
    static $case = null;
    if ($case === null) {
        $cfg  = require __DIR__ . '/config.php';
        $case = $cfg['ident_case'] === 'upper' ? 'upper' : 'lower';
    }
    return $case;
}

/**
 * Cita de forma segura un identificador de tabla o columna para usarlo en SQL.
 *
 * El identificador YA debe venir validado (whitelist de tabla o validación
 * contra information_schema). Esto solo aplica el quoting correcto según el
 * case de la BD; nunca debe recibir entrada de usuario sin validar.
 *
 * @param string $name Identificador validado (en MAYÚSCULAS).
 * @return string Identificador citado y listo para interpolar en SQL.
 */
function qid(string $name): string
{
    if (ident_case() === 'upper') {
        // Tablas/columnas almacenadas en MAYÚSCULAS → citar para preservar el case.
        $safe = str_replace('"', '', strtoupper($name));
        return '"' . $safe . '"';
    }
    // BD en minúsculas → bajar y citar (evita choques con palabras reservadas).
    $safe = str_replace('"', '', strtolower($name));
    return '"' . $safe . '"';
}

/**
 * Devuelve el valor con el que comparar contra information_schema
 * (table_name / column_name), que respeta el case físico.
 *
 * @param string $name Identificador en MAYÚSCULAS.
 * @return string
 */
function ident_schema_value(string $name): string
{
    return ident_case() === 'upper' ? strtoupper($name) : strtolower($name);
}

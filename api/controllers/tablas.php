<?php
/**
 * Controlador de tablas. Porta app/services/data_service.py:
 * obtener_tablas, obtener_columnas, obtener_registros, generar_csv_stream.
 *
 * Parámetros reservados de query que NO se tratan como filtros de columna.
 */
const PARAMS_RESERVADOS = ['pagina', 'limite', 'columnas', 'r'];

/**
 * GET /api/tablas — lista de tablas y vistas con dominio y conteos.
 *
 * Las TABLAS llevan COUNT(*) exacto. Las VISTAS llevan tipo='vista' y NO se
 * cuentan (algunas tardan decenas de segundos); su total_registros es null.
 */
function ctrl_tablas_lista(PDO $pdo): void
{
    // Conteo de columnas de todas las entidades (tablas + vistas) en una query.
    $todas  = array_merge(TABLAS_PERMITIDAS, VISTAS_PERMITIDAS);
    $place  = [];
    $params = [];
    foreach ($todas as $i => $t) {
        $place[]        = ":t$i";
        $params[":t$i"] = ident_schema_value($t);
    }
    $params[':schema'] = schema_name();
    $in = implode(',', $place);

    $stmt = $pdo->prepare(
        "SELECT table_name, COUNT(*) AS n FROM information_schema.columns
         WHERE table_schema = :schema AND table_name IN ($in)
         GROUP BY table_name"
    );
    $stmt->execute($params);
    $colCounts = [];
    foreach ($stmt->fetchAll() as $row) {
        $colCounts[strtoupper($row['table_name'])] = (int) $row['n'];
    }

    $entidades = [];

    // --- Tablas: COUNT(*) real (seguro: vienen de la whitelist). ---
    $tablas = TABLAS_PERMITIDAS;
    sort($tablas);
    foreach ($tablas as $nombre) {
        if (!isset($colCounts[$nombre])) continue; // no existe físicamente
        $c = $pdo->query("SELECT COUNT(*) FROM " . qid($nombre))->fetchColumn();
        $prefijo = explode('_', $nombre)[0];
        $entidades[] = [
            'nombre'              => $nombre,
            'tipo'                => 'tabla',
            'dominio'             => $prefijo,
            'descripcion_dominio' => DOMINIOS[$prefijo] ?? 'Desconocido',
            'total_registros'     => (int) $c,
            'total_columnas'      => $colCounts[$nombre] ?? 0,
        ];
    }

    // --- Vistas: SIN COUNT(*) (total null). ---
    $vistas = VISTAS_PERMITIDAS;
    sort($vistas);
    foreach ($vistas as $nombre) {
        if (!isset($colCounts[$nombre])) continue;
        $entidades[] = [
            'nombre'              => $nombre,
            'tipo'                => 'vista',
            'dominio'             => 'VW',
            'descripcion_dominio' => descripcion_vista($nombre),
            'total_registros'     => null,
            'total_columnas'      => $colCounts[$nombre] ?? 0,
        ];
    }

    $nTablas = count(array_filter($entidades, fn($e) => $e['tipo'] === 'tabla'));
    $nVistas = count(array_filter($entidades, fn($e) => $e['tipo'] === 'vista'));

    json_response([
        'total_tablas' => $nTablas,
        'total_vistas' => $nVistas,
        'tablas'       => $entidades,
    ]);
}

/**
 * GET /api/tablas/{tabla}/columnas — columnas + descripciones del diccionario.
 */
function ctrl_tablas_columnas(PDO $pdo, string $tabla): void
{
    $tabla = validar_tabla($tabla);

    $stmt = $pdo->prepare(
        "SELECT c.column_name,
                d.descripcion,
                d.tipo_de_dato,
                d.rangos_claves
         FROM information_schema.columns c
         LEFT JOIN diccionario_de_datos d
                ON UPPER(d.nombre_de_la_tabla)   = :tabla
               AND UPPER(d.nombre_de_la_columna) = UPPER(c.column_name)
         WHERE c.table_schema = :schema AND c.table_name = :tname
         ORDER BY c.ordinal_position"
    );
    $stmt->execute([':tabla' => $tabla, ':tname' => ident_schema_value($tabla), ':schema' => schema_name()]);

    $columnas = [];
    foreach ($stmt->fetchAll() as $row) {
        $columnas[] = [
            'nombre'        => strtoupper($row['column_name']),
            'descripcion'   => $row['descripcion'],
            'tipo_de_dato'  => $row['tipo_de_dato'],
            'rangos_claves' => $row['rangos_claves'],
        ];
    }

    json_response([
        'tabla'          => $tabla,
        'total_columnas' => count($columnas),
        'columnas'       => $columnas,
    ]);
}

/**
 * Construye la cláusula WHERE y los parámetros bind a partir de los filtros
 * dinámicos de $_GET (cualquier param no reservado). Capa 3 anti-inyección.
 *
 * @param string[] $validas Columnas reales (MAYÚSCULAS).
 * @return array{0:string,1:array} [where_sql, params]
 */
function construir_filtros(array $validas, string $tabla): array
{
    $filtros = [];
    foreach ($_GET as $k => $v) {
        if (in_array($k, PARAMS_RESERVADOS, true)) {
            continue;
        }
        $filtros[$k] = $v;
    }
    if (!$filtros) {
        return ['', []];
    }

    validar_columnas(array_keys($filtros), $validas, $tabla);

    $parts  = [];
    $params = [];
    $i = 0;
    foreach ($filtros as $col => $val) {
        $p          = ":f$i";
        $parts[]    = qid(strtoupper($col)) . " = $p";
        $params[$p] = $val;
        $i++;
    }
    return ['WHERE ' . implode(' AND ', $parts), $params];
}

/**
 * Resuelve la lista de columnas a seleccionar a partir del param `columnas`.
 *
 * @param string[] $validas
 * @return array{0:string,1:array} [cols_sql, cols_respuesta(MAYÚSCULAS)]
 */
function resolver_columnas(array $validas, string $tabla): array
{
    if (empty($_GET['columnas'])) {
        return ['*', $validas];
    }
    $solicitadas = array_filter(array_map('trim', explode(',', $_GET['columnas'])));
    $cols        = validar_columnas($solicitadas, $validas, $tabla);
    $sql         = implode(', ', array_map(fn($c) => qid($c), $cols));
    return [$sql, $cols];
}

/**
 * GET /api/tablas/{tabla}/registros — registros paginados con filtros.
 */
function ctrl_tablas_registros(PDO $pdo, string $tabla): void
{
    $tabla   = validar_tabla($tabla);
    $validas = columnas_validas($pdo, $tabla);

    $pagina = query_int('pagina', 1, 1);
    $limite = query_int('limite', 15, 1, 100);

    [$colsSql, $colsResp] = resolver_columnas($validas, $tabla);
    [$where, $params]     = construir_filtros($validas, $tabla);

    $tablaSql = qid($tabla);
    $esVista  = es_vista($tabla);
    $offset   = ($pagina - 1) * $limite;

    // En TABLAS calculamos el total exacto. En VISTAS lo evitamos (COUNT(*) puede
    // tardar decenas de segundos): pedimos una fila extra para saber si hay más.
    if (!$esVista) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM $tablaSql $where");
        $stmt->execute($params);
        $total   = (int) $stmt->fetchColumn();
        $fetch   = $limite;
        $hayMas  = ($offset + $limite) < $total;
    } else {
        $total = null;
        $fetch = $limite + 1; // +1 para detectar página siguiente sin contar.
    }

    // Página de datos.
    $sql  = "SELECT $colsSql FROM $tablaSql $where LIMIT :limite OFFSET :offset";
    $stmt = $pdo->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':limite', $fetch, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll();
    if ($esVista) {
        $hayMas = count($rows) > $limite;
        if ($hayMas) {
            array_pop($rows); // descartar la fila extra de sondeo
        }
    }

    // Normaliza las claves de cada registro a MAYÚSCULAS (consistencia con la API).
    $registros = [];
    foreach ($rows as $row) {
        $up = [];
        foreach ($row as $k => $v) {
            $up[strtoupper($k)] = $v;
        }
        $registros[] = $up;
    }

    json_response([
        'tabla'     => $tabla,
        'tipo'      => $esVista ? 'vista' : 'tabla',
        'total'     => $total,
        'pagina'    => $pagina,
        'limite'    => $limite,
        'hay_mas'   => $hayMas,
        'columnas'  => $colsResp,
        'registros' => $registros,
    ]);
}

/**
 * GET /api/tablas/{tabla}/exportar — CSV en streaming (sin paginar).
 */
function ctrl_tablas_exportar(PDO $pdo, string $tabla): void
{
    $tabla   = validar_tabla($tabla);
    $validas = columnas_validas($pdo, $tabla);

    [$colsSql, ]      = resolver_columnas($validas, $tabla);
    [$where, $params] = construir_filtros($validas, $tabla);

    $tablaSql = qid($tabla);

    // Cabeceras de descarga.
    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename={$tabla}.csv");

    // Streaming real con CURSOR del lado del servidor: lee en lotes de 2000
    // filas y nunca carga la tabla completa en memoria (clave por el límite
    // de RAM del hosting). Equivale al chunksize=5000 de pandas del original.
    $LOTE = 2000;
    $fp   = fopen('php://output', 'w');
    $first = true;

    // Emular prepares aquí: así el DECLARE CURSOR recibe un SQL plano con los
    // valores ya interpolados y escapados por PDO (sigue siendo seguro contra
    // inyección), evitando el binding de parámetros dentro de un DECLARE.
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, true);

    $pdo->beginTransaction();
    try {
        $decl = $pdo->prepare("DECLARE csv_cur NO SCROLL CURSOR FOR SELECT $colsSql FROM $tablaSql $where");
        $decl->execute($params);

        while (true) {
            $batch = $pdo->query("FETCH $LOTE FROM csv_cur")->fetchAll(PDO::FETCH_ASSOC);
            if (!$batch) {
                break;
            }
            foreach ($batch as $row) {
                if ($first) {
                    fputcsv($fp, array_map('strtoupper', array_keys($row)));
                    $first = false;
                }
                fputcsv($fp, $row);
            }
            flush();
        }

        $pdo->exec('CLOSE csv_cur');
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    fclose($fp);
    exit;
}

<?php
/**
 * Controlador del diccionario de datos. Porta buscar_diccionario()
 * de app/services/data_service.py.
 */

/**
 * GET /api/diccionario — busca variables por término y/o tabla.
 *
 * Query params: termino (opcional), tabla (opcional), pagina (def 1), limite (def 20, máx 50).
 */
function ctrl_diccionario(PDO $pdo): void
{
    $termino = isset($_GET['termino']) ? trim($_GET['termino']) : '';
    $tabla   = isset($_GET['tabla']) ? trim($_GET['tabla']) : '';
    $pagina  = query_int('pagina', 1, 1);
    $limite  = query_int('limite', 20, 1, 50);

    $where  = [];
    $params = [];

    if ($termino !== '') {
        $where[]            = '(UPPER(nombre_de_la_columna) LIKE UPPER(:term) OR UPPER(descripcion) LIKE UPPER(:term))';
        $params[':term']    = '%' . $termino . '%';
    }
    if ($tabla !== '') {
        $where[]            = 'UPPER(nombre_de_la_tabla) = UPPER(:tabla)';
        $params[':tabla']   = $tabla;
    }
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    // Total.
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM diccionario_de_datos $whereSql");
    $stmt->execute($params);
    $total = (int) $stmt->fetchColumn();

    // Página.
    $offset = ($pagina - 1) * $limite;
    $sql = "SELECT nombre_de_la_db, nombre_del_conjunto, nombre_de_la_tabla,
                   nombre_de_la_columna, descripcion, tipo_de_dato, rangos_claves
            FROM diccionario_de_datos
            $whereSql
            ORDER BY nombre_de_la_tabla, nombre_de_la_columna
            LIMIT :limite OFFSET :offset";
    $stmt = $pdo->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':limite', $limite, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $resultados = [];
    foreach ($stmt->fetchAll() as $row) {
        $resultados[] = [
            'nombre_de_la_db'      => $row['nombre_de_la_db'],
            'nombre_del_conjunto'  => $row['nombre_del_conjunto'],
            'nombre_de_la_tabla'   => $row['nombre_de_la_tabla'],
            'nombre_de_la_columna' => $row['nombre_de_la_columna'],
            'descripcion'          => $row['descripcion'],
            'tipo_de_dato'         => $row['tipo_de_dato'],
            'rangos_claves'        => $row['rangos_claves'],
        ];
    }

    json_response([
        'total'      => $total,
        'pagina'     => $pagina,
        'limite'     => $limite,
        'hay_mas'    => ($offset + $limite) < $total,
        'resultados' => $resultados,
    ]);
}

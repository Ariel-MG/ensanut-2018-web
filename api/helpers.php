<?php
/**
 * Helpers compartidos: whitelist de tablas, validación de columnas,
 * respuestas JSON y manejo de errores.
 *
 * Reúne la lógica de seguridad de app/services/data_service.py
 * (_validar_tabla, _obtener_columnas_validas, _validar_columnas) y el
 * formato de error de app/exceptions.py.
 */

/**
 * Whitelist de tablas consultables (capa 1 anti-inyección).
 * Idéntica a TABLAS_PERMITIDAS de app/models/ensanut.py.
 */
const TABLAS_PERMITIDAS = [
    'CN_ALIMENTOS_ADU', 'CN_ALIMENTOS_COM', 'CN_ALIMENTOS_ESC', 'CN_ALIMENTOS_PREES',
    'CN_ANTROPOMETRIA', 'CN_CAT_ALIMENTOS', 'CN_DES_INF', 'CN_DES_INF_P7',
    'CN_FCA_ADOLESCENTES', 'CN_FCA_ADU', 'CN_FCA_ESC', 'CN_FCA_PREES',
    'CN_HOGARES', 'CN_LAC_MAT', 'CN_MUESAN_DETBIO_ADU', 'CN_MUESAN_DETBIO_ESC',
    'CN_MUESAN_DETBIO_PREES', 'CN_MUESAN_HEMOGLOBINA', 'CN_MUESAN_HEPA_ADU',
    'CN_MUESAN_PLOMO', 'CN_PLOMO', 'CN_RESIDENTES', 'CN_VIVIENDAS',
    'CS_ACT_FIS_ADO', 'CS_ACT_FIS_NINO', 'CS_ADOLESCENTES', 'CS_ADULTOS',
    'CS_AYUDA_ALIMENTARIA', 'CS_ETIQUETADO_FRONTAL', 'CS_HOGARES', 'CS_NINO',
    'CS_RESIDENTES', 'CS_SEGURIDAD_ALIMENTARIA', 'CS_SERV_SALUD', 'CS_VIVIENDAS',
];

/** Mapeo de prefijo a descripción del dominio (de _DOMINIOS). */
const DOMINIOS = [
    'CN' => 'Cuestionario de Nutrición',
    'CS' => 'Cuestionario de Salud',
];

/**
 * Excepción de la API con código y status HTTP, equivalente a DBError.
 */
class ApiError extends Exception
{
    public string $apiCode;
    public int $status;

    public function __construct(string $apiCode, string $message, int $status)
    {
        parent::__construct($message);
        $this->apiCode = $apiCode;
        $this->status  = $status;
    }
}

/**
 * Envía una respuesta JSON y termina la ejecución.
 *
 * @param mixed $data
 * @param int   $status
 */
function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Envía una respuesta de error con el formato estándar y termina.
 *
 * @param string $code
 * @param string $message
 * @param int    $status
 */
function json_error(string $code, string $message, int $status): void
{
    json_response(['error' => ['code' => $code, 'message' => $message]], $status);
}

/**
 * Valida que la tabla esté en la whitelist (capa 1). Normaliza a MAYÚSCULAS.
 *
 * @param string $tabla
 * @return string Nombre de tabla validado en MAYÚSCULAS.
 * @throws ApiError 404 si no está permitida.
 */
function validar_tabla(string $tabla): string
{
    $up = strtoupper($tabla);
    if (!in_array($up, TABLAS_PERMITIDAS, true)) {
        throw new ApiError(
            'table_not_allowed',
            "La tabla '$tabla' no existe. Consulta GET /api/tablas para ver las tablas disponibles.",
            404
        );
    }
    return $up;
}

/**
 * Obtiene las columnas válidas de una tabla desde information_schema (capa 2),
 * con caché en proceso. Devuelve nombres en MAYÚSCULAS.
 *
 * @param PDO    $pdo
 * @param string $tabla Tabla ya validada (MAYÚSCULAS).
 * @return string[] Columnas en MAYÚSCULAS.
 */
function columnas_validas(PDO $pdo, string $tabla): array
{
    static $cache = [];
    if (isset($cache[$tabla])) {
        return $cache[$tabla];
    }

    $stmt = $pdo->prepare(
        "SELECT column_name FROM information_schema.columns
         WHERE table_schema = :schema AND table_name = :t
         ORDER BY ordinal_position"
    );
    $stmt->execute([':schema' => schema_name(), ':t' => ident_schema_value($tabla)]);

    $cols = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $c) {
        $cols[] = strtoupper($c);
    }
    $cache[$tabla] = $cols;
    return $cols;
}

/**
 * Valida que todas las columnas solicitadas existan en la tabla (capa 2).
 *
 * @param string[] $solicitadas
 * @param string[] $validas      Columnas reales (MAYÚSCULAS).
 * @param string   $tabla
 * @return string[] Columnas validadas en MAYÚSCULAS.
 * @throws ApiError 400 si alguna no existe.
 */
function validar_columnas(array $solicitadas, array $validas, string $tabla): array
{
    $set    = array_flip($validas);
    $upper  = array_map('strtoupper', $solicitadas);
    $malas  = array_values(array_filter($upper, fn($c) => !isset($set[$c])));
    if ($malas) {
        throw new ApiError(
            'column_invalid',
            "Columnas inválidas para la tabla '$tabla': " . implode(', ', $malas) .
            ". Consulta GET /api/tablas/$tabla/columnas para ver las columnas disponibles.",
            400
        );
    }
    return $upper;
}

/**
 * Lee un entero de $_GET con valor por defecto y límites opcionales.
 *
 * @param string   $key
 * @param int      $default
 * @param int|null $min
 * @param int|null $max
 * @return int
 */
function query_int(string $key, int $default, ?int $min = null, ?int $max = null): int
{
    $val = isset($_GET[$key]) && is_numeric($_GET[$key]) ? (int) $_GET[$key] : $default;
    if ($min !== null && $val < $min) {
        $val = $min;
    }
    if ($max !== null && $val > $max) {
        $val = $max;
    }
    return $val;
}

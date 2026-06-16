# ENSANUT 2018 — Versión PHP + HTML/CSS/JS

Versión migrada de la aplicación ENSANUT 2018 para hosting **solo con PHP** (sin
Node, sin `sudo`, memoria limitada). Reemplaza el backend FastAPI/Python y el
frontend React/Vite.

- **Frontend:** HTML/CSS/JS plano, **sin paso de compilación**. Se edita y se sube tal cual.
- **Backend:** PHP + PDO contra **PostgreSQL** (extensión `pdo_pgsql`), con una conexión fija.

---

## Estructura

```
public_html/
├── index.html            # Dashboard (KPIs + lista de tablas + buscador)
├── explorer.html         # Explorador de una tabla (filtros, paginación, CSV)
├── assets/
│   ├── css/style.css     # Estilos (reemplaza Tailwind)
│   ├── js/api.js         # Llamadas a la API (fetch)
│   ├── js/ui.js          # Sidebar + topbar + buscador de diccionario
│   ├── js/dashboard.js   # Lógica del Dashboard
│   ├── js/explorer.js    # Lógica del Explorador
│   └── img/              # Logo y favicon
└── api/
    ├── index.php         # Router de la API
    ├── .htaccess         # Reescritura de URLs (mod_rewrite)
    ├── config.php        # Credenciales de la BD
    ├── db.php            # Conexión PDO + quoting de identificadores
    ├── helpers.php       # Whitelist, validaciones, respuestas JSON
    └── controllers/      # tablas.php, diccionario.php
```

## Endpoints de la API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/` | Health check |
| GET | `/api/tablas` | Lista de tablas con dominio y conteos |
| GET | `/api/tablas/{tabla}/columnas` | Columnas + descripciones del diccionario |
| GET | `/api/tablas/{tabla}/registros` | Registros paginados con filtros (`pagina`, `limite`, `columnas`, y `COL=valor`) |
| GET | `/api/tablas/{tabla}/exportar` | Exporta a CSV (streaming por cursor) |
| GET | `/api/diccionario` | Búsqueda en el diccionario (`termino`, `tabla`, `pagina`, `limite`) |

## Seguridad (3 capas anti-inyección, igual que el original)

1. **Tabla** → validada contra la whitelist `TABLAS_PERMITIDAS` en `helpers.php`.
2. **Columnas** (filtros/selección) → validadas contra `information_schema.columns`.
3. **Valores** → siempre como *prepared statements* PDO; nunca concatenados.

---

## Configuración

Credenciales (recomendado, repo público → archivo no versionado):

```bash
cp api/config.local.example.php api/config.local.php
# edita api/config.local.php con tus credenciales reales
```

`api/config.local.php` está en `.gitignore`, así que nunca se sube. Alternativa:
definir variables de entorno `DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD,
DB_IDENT_CASE`.

### Routing

Por defecto el frontend usa `api/index.php?r=...` (no requiere `mod_rewrite`),
y resuelve la API de forma **relativa**, por lo que funciona en subcarpetas como
`https://host/~usuario/`. Si tu hosting tiene `mod_rewrite` + `AllowOverride` y
prefieres URLs limpias, pon `const USE_REWRITE = true;` en `assets/js/api.js`.

### ⚠️ Paso obligatorio: `DB_IDENT_CASE`

Postgres baja a minúsculas los identificadores sin comillas. Antes de usar la
app, conéctate a la BD y corre:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 50;
```

- Si los nombres salen **en minúsculas** (`cs_adultos`) → deja `DB_IDENT_CASE=lower`.
- Si salen **en MAYÚSCULAS** (`CS_ADULTOS`) → pon `DB_IDENT_CASE=upper`.

## Probar en local (necesitas PHP con `pdo_pgsql`)

```bash
php -S localhost:8080 -t public_html
```

Luego:

```bash
curl localhost:8080/api/tablas
curl "localhost:8080/api/tablas/CS_ADULTOS/columnas"
curl "localhost:8080/api/tablas/CS_ADULTOS/registros?pagina=1&limite=20&SEXO=1"
curl -O "localhost:8080/api/tablas/CS_ADULTOS/exportar?SEXO=2"
curl "localhost:8080/api/diccionario?termino=glucosa"
```

Y abre `http://localhost:8080/index.html` en el navegador.

> Nota: con el servidor embebido de PHP, el `.htaccess` no aplica. El router de
> `index.php` igual funciona porque detecta la ruta después de `/api/`.

## Despliegue

1. Sube/clona el contenido en la raíz web (o subcarpeta `/~usuario/`).
2. Crea `api/config.local.php` con las credenciales y el `ident_case` correcto.
3. Verifica que el hosting tenga la extensión: `php -m | grep pgsql`.
4. El routing por defecto (`?r=`) ya funciona sin `mod_rewrite` y en subcarpetas.

## Qué se eliminó respecto al original

- Login/conexión dinámica a BD (Oracle, formularios, sesiones `X-Session-Id`).
- Gráficas del Dashboard y endpoints de métricas que las alimentaban.
- Páginas vacías (Diccionarios, Configuración, Renovación).
- Toda dependencia de Node/React/Vite/Tailwind (ya no hay build).

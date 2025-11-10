# Sistema BIM - Servidor MCP con ItemsFinder

Un sistema completo para la manipulación y visualización de modelos BIM utilizando el protocolo MCP (Model Context Protocol) y la clase **ItemsFinder** real de OpenBIM Components para búsquedas avanzadas.

## 🚀 Características Principales

- 🏗️ **Carga de modelos BIM**: Soporte completo para archivos .frags y .ifc
- 🆕 **Conversión IFC automática**: Carga archivos IFC nativos sin pre-procesamiento
- ⚡ **ItemsFinder Real**: Usa la clase ItemsFinder del visualizador (no simulación)
- 🔍 **Análisis de atributos**: Extracción completa de atributos y Property Sets
- 🎯 **Filtrado inteligente**: Búsqueda por categorías, atributos y relaciones IFC
- 🆕 **Property Sets (Psets)**: Búsqueda avanzada en Property Sets con relaciones anidadas
- ✨ **Resaltado visual**: Destacado automático de elementos en el visualizador 3D
- 💾 **Persistencia de consultas**: Crea, reutiliza, exporta e importa consultas
- 🌐 **Interfaz web**: Visualizador 3D interactivo con controles avanzados
- 🔧 **API MCP**: Herramientas completas accesibles via protocolo MCP

## 🏗️ Estructura del Proyecto

```
live-mcp-server/
├── app-mcp/                          # Aplicación web frontend
│   ├── src/                         # Código fuente TypeScript
│   │   ├── bim-components/          # Componentes BIM personalizados
│   │   │   └── MCP/                # Componente MCP con ItemsFinder
│   │   ├── ui-templates/           # Plantillas de interfaz
│   │   └── main.ts                 # Aplicación principal + WebSocket
│   ├── Proyecto de Referencia.frag  # Archivo BIM de ejemplo
│   └── package.json
├── server-mcp/                      # Servidor MCP backend
│   ├── main.ts                     # Servidor con todas las herramientas MCP
│   └── package.json
├── ITEMSFINDER_GUIDE.md            # 📖 Guía completa de ItemsFinder
├── PSETS_QUICK_GUIDE.md            # 🔷 Guía rápida de Property Sets
├── itemsfinder_examples.py         # 🐍 Ejemplos prácticos con código
├── fast_search_examples.py         # 🐍 Ejemplos actualizados (Property Sets)
└── README.md                       # Este archivo
```

## 🛠️ Herramientas MCP Disponibles

### 📦 Herramientas de Carga

#### `load-frags`
Carga un archivo .frags pre-procesado en el visualizador.

**Parámetros:**
- `path` (string): Ruta completa al archivo .frags

**Ventajas:**
- ⚡ Carga muy rápida (archivos optimizados)
- 📦 Archivos más pequeños
- ✅ Ideal para uso repetido

#### `load-ifc` 🆕
Carga un archivo .ifc nativo, lo convierte automáticamente a fragmentos y lo visualiza.

**Parámetros:**
- `path` (string): Ruta completa al archivo .ifc
- `modelId` (string, opcional): ID único para el modelo (default: "mcp")

**Ventajas:**
- 🔄 Conversión automática IFC → Fragmentos
- 📝 No requiere pre-procesamiento
- 🌐 Compatible con cualquier archivo IFC estándar
- ⚡ Procesamiento eficiente con IfcLoader

**Ejemplo:**
```json
{
  "tool": "load-ifc",
  "path": "C:/Projects/Building_A.ifc",
  "modelId": "edificio_principal"
}
```

**📖 Guía completa:** Ver `LOAD_IFC_GUIDE.md`

---

### 🔍 Herramientas de Análisis

#### `get-all-attributes`
Obtiene todos los atributos de los elementos del modelo BIM.

**Parámetros:**
- `category` (string, opcional): Categoría específica (ej: IFCWALL, IFCBEAM)
- `includePropertySets` (boolean, opcional): Incluir Property Sets (default: true)
- `includeRelations` (boolean, opcional): Incluir relaciones (default: false)

#### `getModelIdMap`
Obtiene IDs locales de elementos basados en una categoría.

**Parámetros:**
- `category` (string): Nombre de categoría (ej: IFCWALL)

#### `get-elements-info`
Obtiene información completa de elementos específicos: atributos directos, Property Sets y propiedades.

**Parámetros:**
- `modelIdMap` (Record<string, number[]>): Mapa de modelos con sus localIds
- `formatPsets` (boolean, opcional): Si formatear los Property Sets (default: true)

#### `export-elements-csv` 🆕
Exporta información completa de elementos específicos directamente a formato CSV. Similar a `get-elements-info` pero enfocado únicamente en exportación CSV.

**Parámetros:**
- `modelIdMap` (Record<string, number[]>): Mapa de modelos con sus localIds
- `outputPath` (string, opcional): Ruta del archivo CSV (default: "elements_export.csv")
- `formatPsets` (boolean, opcional): Si formatear los Property Sets (default: true)
- `includeMetadata` (boolean, opcional): Si incluir metadatos adicionales (default: true)

**Características:**
- ✅ Exportación directa a CSV sin pasos intermedios
- ✅ Formato plano optimizado para Excel y herramientas BI
- ✅ Property Sets incluidos como columnas separadas
- ✅ Manejo automático de rutas y escape de caracteres
- ✅ Estadísticas completas de la exportación

---

### ⚡ Herramientas de ItemsFinder (NUEVO)

#### `fast-find-elements` ⭐ (ACTUALIZADO)
**Crea consultas** en ItemsFinder con búsqueda por categoría, atributos directos y **Property Sets con relaciones anidadas**.

**Parámetros:**
- `queryName` (string): Nombre único para la consulta
- `categories` (array, opcional): Categorías IFC a buscar (ej: ['WALL', 'DOOR'])
- `attributes` (array, opcional): Array de criterios de atributos directos
  - `name` (string): Nombre del atributo
  - `value` (string|boolean|number, opcional): Valor del atributo
- `relation` (object, opcional): Criterios de relación (soporta **relaciones anidadas** para Property Sets)
  - `name` (string): Nombre de la relación IFC (ej: 'IsDefinedBy', 'HasProperties')
  - `query` (object): Consulta para elementos relacionados (puede contener otra relación)
    - `categories` (array, opcional): Categorías del elemento relacionado
    - `attributes` (array, opcional): Atributos del elemento relacionado
    - `relation` (object, opcional): **Relación anidada** (útil para Property Sets)
- `execute` (boolean, opcional): Ejecutar inmediatamente (default: true)

**🆕 NUEVO: Soporte para Property Sets (Psets)**

La herramienta ahora soporta relaciones anidadas, permitiendo búsquedas en Property Sets. 
Para buscar por propiedades en Psets, usa la estructura: 
`IsDefinedBy` → `IFCPROPERTYSET` → `HasProperties` → `IFCPROPERTYSINGLEVALUE`

#### `execute-query`
Ejecuta una consulta previamente creada y resalta los resultados.

**Parámetros:**
- `queryName` (string): Nombre de la consulta a ejecutar
- `highlightResults` (boolean, opcional): Si resaltar resultados (default: true)

#### `list-queries`
Lista todas las consultas disponibles en ItemsFinder.

**Parámetros:** Ninguno

#### `delete-query`
Elimina una consulta específica.

**Parámetros:**
- `queryName` (string): Nombre de la consulta a eliminar

#### `export-queries`
Exporta todas las consultas a formato JSON.

**Parámetros:** Ninguno

#### `import-queries`
Importa consultas desde JSON.

**Parámetros:**
- `data` (any): Datos JSON de consultas exportadas

---

### 🎨 Herramientas de Visualización

#### `highlight`
Resalta elementos específicos en el visualizador.

**Parámetros:**
- `modelIdMap` (object): Mapa de IDs de elementos a resaltar

## 🚀 Instalación y Configuración

### 1. Instalar dependencias

```bash
# Instalar dependencias del servidor MCP
cd server-mcp
npm install

# Instalar dependencias de la aplicación web
cd ../app-mcp
npm install
```

### 2. Iniciar el servidor MCP

```bash
cd server-mcp
npm start
```

### 3. Iniciar la aplicación web

```bash
cd app-mcp
npm run dev
```

### 4. Acceder a la aplicación

Abre tu navegador y ve a `http://localhost:5173` para acceder al visualizador 3D.

---

## 🆕 Novedad: Carga Flexible de Modelos

**Ya no es necesario usar `load-frags` para todo!** 

Ahora puedes:
1. ✅ Cargar modelos **manualmente** en el visualizador web
2. ✅ Usar herramientas MCP como `fast-find-elements` inmediatamente
3. ✅ Trabajar con modelos previamente cargados (cache del navegador)

**Ejemplo:**
```
Paso 1: Abre el visualizador web → Carga tu modelo .frags manualmente
Paso 2: Abre Cursor → Usa fast-find-elements directamente ✅
```

Solo necesitas `load-frags` si quieres:
- Cargar el modelo desde el servidor MCP
- Usar `get-all-attributes` o `getModelIdMap` (procesan en servidor)

📖 **Más info:** Ver `MODELO_CARGADO_FIX.md` y `DIAGRAMA_FIX.md`

## 🔍 Ejemplos de Uso

### Ejemplo Básico - Buscar Muros

```json
{
  "queryName": "Todos los Muros",
  "categories": ["WALL"],
  "execute": true
}
```

### Ejemplo Intermedio - Buscar por Atributo

```json
{
  "queryName": "Muros Mampostería",
  "categories": ["WALL"],
  "attributes": [
    {
      "name": "Name",
      "value": "Mampostería"
    }
  ],
  "execute": true
}
```

### Ejemplo Avanzado - Búsqueda Jerárquica

```json
{
  "queryName": "Columnas Nivel Entrada",
  "categories": ["COLUMN"],
  "relation": {
    "name": "ContainedInStructure",
    "query": {
      "categories": ["BUILDINGSTOREY"],
      "attributes": [
        {
          "name": "Name",
          "value": "Entry"
        }
      ]
    }
  },
  "execute": true
}
```

### 🆕 Ejemplo Property Sets - Buscar por Sector de Obra

```json
{
  "queryName": "elementos_sector_s2",
  "categories": ["COLUMN", "WALL"],
  "relation": {
    "name": "IsDefinedBy",
    "query": {
      "categories": ["IFCPROPERTYSET"],
      "attributes": [
        {
          "name": "Name",
          "value": "Texto de título"
        }
      ],
      "relation": {
        "name": "HasProperties",
        "query": {
          "categories": ["IFCPROPERTYSINGLEVALUE"],
          "attributes": [
            {
              "name": "Name",
              "value": "Sector de Obra"
            },
            {
              "name": "NominalValue",
              "value": "S2"
            }
          ]
        }
      }
    }
  },
  "execute": true
}
```

### 🆕 Ejemplo Property Sets - Columnas con Atributos y Pset

```json
{
  "queryName": "columnas_rect_s3",
  "categories": ["COLUMN"],
  "attributes": [
    {
      "name": "Name",
      "value": "Rect"
    }
  ],
  "relation": {
    "name": "IsDefinedBy",
    "query": {
      "categories": ["IFCPROPERTYSET"],
      "attributes": [
        {
          "name": "Name",
          "value": "Texto de título"
        }
      ],
      "relation": {
        "name": "HasProperties",
        "query": {
          "categories": ["IFCPROPERTYSINGLEVALUE"],
          "attributes": [
            {
              "name": "Name",
              "value": "Sector de Obra"
            },
            {
              "name": "NominalValue",
              "value": "S3"
            }
          ]
        }
      }
    }
  },
  "execute": true
}
```

### Ejemplo de Gestión - Crear y Ejecutar Después

**Paso 1:** Crear sin ejecutar
```json
{
  "queryName": "Muros Estructurales",
  "categories": ["WALL"],
  "attributes": [
    {
      "name": "LoadBearing",
      "value": true
    }
  ],
  "execute": false
}
```

**Paso 2:** Ejecutar cuando se necesite
```json
{
  "tool": "execute-query",
  "queryName": "Muros Estructurales",
  "highlightResults": true
}
```

## 📊 Flujo de Trabajo Típico

### Opción A: Con archivo IFC 🆕
1. **Cargar modelo IFC**: Usar `load-ifc` para cargar y convertir automáticamente
2. **Explorar atributos**: Usar `get-all-attributes` para entender la estructura
3. **Crear consultas**: Usar `fast-find-elements` para crear consultas en ItemsFinder
4. **Visualizar resultados**: Los elementos se resaltan automáticamente
5. **Gestionar consultas**: Listar, ejecutar, exportar o eliminar consultas según necesidad

### Opción B: Con archivo .frags (más rápido)
1. **Cargar modelo**: Usar `load-frags` para cargar un archivo .frags pre-procesado
2. **Explorar atributos**: Usar `get-all-attributes` para entender la estructura
3. **Crear consultas**: Usar `fast-find-elements` para crear consultas en ItemsFinder
4. **Visualizar resultados**: Los elementos se resaltan automáticamente
5. **Gestionar consultas**: Listar, ejecutar, exportar o eliminar consultas según necesidad

## 🔷 Guía de Property Sets (Psets)

### ¿Qué son los Property Sets?

Los **Property Sets (Psets)** son conjuntos de propiedades personalizadas asociadas a elementos IFC. A diferencia de los atributos directos del elemento, los Psets están organizados en grupos temáticos y se acceden a través de relaciones IFC.

### Estructura de Relaciones para Psets

Para buscar por propiedades en Psets, debes usar una estructura de **relaciones anidadas**:

```
ELEMENTO (ej: IFCCOLUMN)
  └─ IsDefinedBy (relación)
      └─ IFCPROPERTYSET (ej: "Texto de título")
          └─ HasProperties (relación)
              └─ IFCPROPERTYSINGLEVALUE
                  ├─ Name (ej: "Sector de Obra")
                  └─ NominalValue (ej: "S2")
```

### Componentes de una Búsqueda en Psets

1. **Elemento Principal** (opcional):
   - `categories`: Tipo de elemento a buscar (WALL, COLUMN, SLAB, etc.)
   - `attributes`: Atributos directos del elemento

2. **Primera Relación - IsDefinedBy**:
   - Conecta el elemento con sus Property Sets
   - `name`: "IsDefinedBy"

3. **Property Set - IFCPROPERTYSET**:
   - `categories`: ["IFCPROPERTYSET"]
   - `attributes`: [{ "name": "Name", "value": "Nombre del Pset" }]

4. **Segunda Relación - HasProperties**:
   - Conecta el Pset con sus propiedades
   - `name`: "HasProperties"

5. **Propiedad - IFCPROPERTYSINGLEVALUE**:
   - `categories`: ["IFCPROPERTYSINGLEVALUE"]
   - `attributes`: 
     - Nombre de la propiedad: `{ "name": "Name", "value": "Nombre Propiedad" }`
     - Valor de la propiedad: `{ "name": "NominalValue", "value": "Valor" }`

### Ejemplos Comunes de Psets

#### Buscar por Sector de Obra
```json
{
  "queryName": "elementos_sector",
  "categories": ["WALL", "COLUMN", "BEAM"],
  "relation": {
    "name": "IsDefinedBy",
    "query": {
      "categories": ["IFCPROPERTYSET"],
      "attributes": [{"name": "Name", "value": "Texto de título"}],
      "relation": {
        "name": "HasProperties",
        "query": {
          "categories": ["IFCPROPERTYSINGLEVALUE"],
          "attributes": [
            {"name": "Name", "value": "Sector de Obra"},
            {"name": "NominalValue", "value": "S1"}
          ]
        }
      }
    }
  }
}
```

#### Buscar Elementos Estructurales (LoadBearing)
```json
{
  "queryName": "elementos_portantes",
  "relation": {
    "name": "IsDefinedBy",
    "query": {
      "categories": ["IFCPROPERTYSET"],
      "attributes": [{"name": "Name", "value": "Pset_WallCommon"}],
      "relation": {
        "name": "HasProperties",
        "query": {
          "categories": ["IFCPROPERTYSINGLEVALUE"],
          "attributes": [
            {"name": "Name", "value": "LoadBearing"},
            {"name": "NominalValue", "value": "TRUE"}
          ]
        }
      }
    }
  }
}
```

### Tips para Búsquedas en Psets

💡 **Tip 1: Descubre los Psets disponibles**
Usa `get-all-attributes` con `includePropertySets: true` para ver qué Psets tiene tu modelo.

💡 **Tip 2: Combina con categorías**
Limita la búsqueda agregando `categories` en el nivel principal para mejor rendimiento.

💡 **Tip 3: Combina con atributos directos**
Puedes filtrar por atributos directos del elemento Y propiedades del Pset simultáneamente.

💡 **Tip 4: Usa valores parciales**
Los valores se convierten a regex, así que puedes buscar coincidencias parciales (ej: "S" encontrará "S1", "S2", "S3").

## ⚡ Ventajas del ItemsFinder Real

### 🚀 Rendimiento y Eficiencia
- **Motor nativo de OpenBIM Components**: Usa el ItemsFinder real del visualizador
- **Optimizado para grandes modelos**: Rendimiento superior en modelos complejos
- **Procesamiento en cliente**: Búsquedas instantáneas sin latencia de red

### 🎯 Funcionalidad Completa
- **Expresiones regulares nativas**: Búsquedas flexibles y potentes
- **Relaciones IFC completas**: Soporte para todas las relaciones del estándar IFC
- **Múltiples criterios**: Combina categorías, atributos y relaciones en una consulta

### 💾 Persistencia y Reutilización
- **Consultas guardadas**: Las consultas permanecen en el visualizador
- **Exportar/Importar**: Guarda tus consultas para reutilizar en otros proyectos
- **Biblioteca de consultas**: Crea una colección de búsquedas comunes

### 🔧 Gestión Avanzada
- **Crear sin ejecutar**: Prepara consultas para usar después
- **Ejecución bajo demanda**: Ejecuta consultas cuando las necesites
- **Control de visualización**: Decide si resaltar o no los resultados

## 🧪 Pruebas y Ejemplos

### Documentación Completa

📖 **[ITEMSFINDER_GUIDE.md](./ITEMSFINDER_GUIDE.md)** - Guía completa de uso de ItemsFinder con:
- Descripción detallada de todas las herramientas
- Casos de uso comunes
- Ejemplos prácticos paso a paso
- Solución de problemas
- Mejores prácticas

🔷 **[PSETS_QUICK_GUIDE.md](./PSETS_QUICK_GUIDE.md)** - Guía rápida de Property Sets (NUEVO):
- ¿Qué son y cuándo usarlos?
- Estructura visual de relaciones
- Plantilla base lista para usar
- 3 ejemplos paso a paso completos
- Tips y mejores prácticas
- Solución de problemas comunes
- Ejercicios prácticos

### Ejemplos de Código

🐍 **[itemsfinder_examples.py](./itemsfinder_examples.py)** - Ejemplos prácticos en Python:
```bash
python itemsfinder_examples.py
```

Contiene:
- 15+ ejemplos de uso
- Casos de uso reales (análisis estructural, seguridad contra incendios, MEP, etc.)
- Plantillas reutilizables
- Referencias de categorías y relaciones IFC

🐍 **[fast_search_examples.py](./fast_search_examples.py)** - Ejemplos actualizados (NUEVO):
```bash
python fast_search_examples.py
```

Contiene:
- Búsquedas básicas por categoría
- **4 ejemplos completos de Property Sets**
- Búsquedas por atributos directos
- Búsquedas relacionales
- Generador de comandos MCP

### Prueba Rápida

1. **Cargar modelo:**
   ```
   tool: load-frags
   path: "app-mcp/Proyecto de Referencia.frag"
   ```

2. **Buscar muros:**
   ```
   tool: fast-find-elements
   queryName: "Todos los Muros"
   categories: ["WALL"]
   execute: true
   ```

3. **Listar consultas creadas:**
   ```
   tool: list-queries
   ```

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js, TypeScript, MCP SDK, WebSocket Server
- **Frontend**: TypeScript, Three.js, @thatopen/components, @thatopen/ui
- **BIM**: @thatopen/fragments para manipulación de modelos BIM
- **Búsqueda**: ItemsFinder REAL de OpenBIM Components (no simulación)
- **Visualización**: WebGL, Post-processing effects
- **Comunicación**: WebSocket para comunicación bidireccional en tiempo real

## 📁 Archivos y Documentación

- `ITEMSFINDER_GUIDE.md`: 📖 Guía completa de uso con ejemplos y mejores prácticas
- `itemsfinder_examples.py`: 🐍 15+ ejemplos prácticos con casos de uso reales
- `app-mcp/Proyecto de Referencia.frag`: Archivo BIM de ejemplo
- `app-mcp/src/bim-components/MCP/`: Componente MCP con integración ItemsFinder
- `server-mcp/main.ts`: Servidor con 9 herramientas MCP completas

## 🆕 Actualización - ItemsFinder Real

### ⚠️ Cambio Importante

La herramienta `fast-find-elements` ahora usa **la clase ItemsFinder REAL** del visualizador en lugar de una simulación en el servidor.

### ✨ Nuevas Características

1. **6 herramientas nuevas** para gestión completa de consultas:
   - `execute-query`: Ejecutar consultas guardadas
   - `list-queries`: Listar consultas disponibles
   - `delete-query`: Eliminar consultas
   - `export-queries`: Exportar a JSON
   - `import-queries`: Importar desde JSON

2. **Persistencia de consultas**: Las consultas permanecen en el visualizador

3. **Mejor rendimiento**: Procesamiento nativo en el cliente

4. **Funcionalidad completa**: Todas las características de ItemsFinder disponibles

### 📊 Diferencias con Versión Anterior

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Motor | Simulación en servidor | ItemsFinder real del visualizador |
| Persistencia | Solo durante ejecución | Consultas guardadas permanentemente |
| Herramientas | 1 (fast-find-elements) | 6 (crear, ejecutar, listar, eliminar, exportar, importar) |
| Rendimiento | Procesamiento en servidor | Procesamiento nativo en cliente |
| Funcionalidad | Limitada | Completa (100% de ItemsFinder) |

## 🤝 Contribución

Para contribuir al proyecto:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crea un Pull Request

## 📚 Recursos Adicionales

- [That Open Components Documentation](https://docs.thatopen.com/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [IFC Standard Documentation](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/)

## 🎯 Casos de Uso

- **Análisis de modelos BIM**: Exploración eficiente de elementos
- **Filtrado por criterios**: Búsqueda de elementos específicos
- **Análisis espacial**: Elementos por pisos, sectores, etc.
- **Control de calidad**: Verificación de atributos y propiedades
- **Visualización interactiva**: Resaltado y análisis visual

---

**Desarrollado con ❤️ usando That Open Components y MCP Protocol**

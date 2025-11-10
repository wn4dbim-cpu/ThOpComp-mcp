# ThOpComp-mcp

Sistema completo para la manipulación y visualización de modelos BIM utilizando el protocolo MCP (Model Context Protocol) y la clase **ItemsFinder** de OpenBIM Components para búsquedas avanzadas.

## 📋 Descripción

ThOpComp-mcp es una herramienta que permite cargar, analizar y visualizar modelos BIM (Building Information Modeling) a través de una interfaz web interactiva y un servidor MCP. El sistema soporta archivos IFC nativos y fragmentos (.frags), proporcionando capacidades avanzadas de búsqueda, filtrado y análisis de elementos BIM mediante la integración con ItemsFinder.

## ✨ Características Principales

- 🏗️ **Carga de modelos BIM**: Soporte completo para archivos .frags y .ifc
- 🔄 **Conversión IFC automática**: Carga archivos IFC nativos sin pre-procesamiento
- ⚡ **ItemsFinder Real**: Usa la clase ItemsFinder del visualizador para búsquedas avanzadas
- 🔍 **Análisis de atributos**: Extracción completa de atributos y Property Sets
- 🎯 **Filtrado inteligente**: Búsqueda por categorías, atributos y relaciones IFC
- 🔷 **Property Sets (Psets)**: Búsqueda avanzada en Property Sets con relaciones anidadas
- ✨ **Resaltado visual**: Destacado automático de elementos en el visualizador 3D
- 💾 **Persistencia de consultas**: Crea, reutiliza, exporta e importa consultas



## 🛠️ Herramientas MCP Disponibles

### Carga de Modelos
- **`load-frags`**: Carga un archivo .frags pre-procesado en el visualizador
- **`load-ifc`**: Carga un archivo .ifc nativo, lo convierte automáticamente a fragmentos y lo visualiza

### Análisis y Extracción
- **`getModelIdMap`**: Obtiene IDs locales de elementos basados en una categoría
- **`get-elements-info`**: Obtiene información completa de elementos específicos (atributos, Property Sets y propiedades)
- **`export-elements-csv`**: Exporta información completa de elementos directamente a formato CSV
- **`get-elements-measurements`**: Extrae mediciones completas (volumen, área, longitud) de elementos BIM específicos
- **`discover-measurement-properties`**: Explora el modelo para descubrir en qué Property Sets se encuentran las propiedades de medición por categoría
- **`get-selected-elements`**: Obtiene los IDs de los elementos actualmente seleccionados o resaltados en el visualizador

### Búsqueda con ItemsFinder
- **`fast-find-elements`**: Crea consultas en ItemsFinder con búsqueda por categoría, atributos directos y Property Sets con relaciones anidadas
- **`execute-query`**: Ejecuta una consulta previamente creada y resalta los resultados
- **`list-queries`**: Lista todas las consultas disponibles en ItemsFinder
- **`delete-query`**: Elimina una consulta específica
- **`export-queries`**: Exporta todas las consultas a formato JSON
- **`import-queries`**: Importa consultas desde JSON

### Visualización
- **`highlight`**: Resalta elementos específicos en el visualizador

## ⚠️ Nota Importante sobre Precisión

**Las mediciones y resultados proporcionados por esta herramienta pueden no ser exactos.** 

Los valores de volumen, área, longitud y otras mediciones extraídas de los modelos BIM dependen de:
- La calidad y completitud de los datos en el archivo IFC original
- La precisión de la geometría del modelo
- La implementación de las librerías de procesamiento BIM utilizadas
- Las propiedades y Property Sets definidos en el modelo

Se recomienda **verificar y validar** los resultados obtenidos, especialmente para:
- Cálculos de cantidades de obra
- Estimaciones de costos
- Análisis estructurales
- Cualquier uso que requiera precisión absoluta

Esta herramienta está diseñada como una **ayuda para análisis y exploración** de modelos BIM, no como un sistema de medición certificado.

## 🏗️ Estructura del Proyecto

```
ThOpComp-mcp/
├── app-mcp/                    # Aplicación web frontend
│   ├── src/                    # Código fuente TypeScript
│   │   ├── bim-components/     # Componentes BIM personalizados
│   │   │   └── MCP/           # Componente MCP con ItemsFinder
│   │   ├── ui-templates/       # Plantillas de interfaz
│   │   └── main.ts            # Aplicación principal + WebSocket
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── index.html
├── server-mcp/                 # Servidor MCP backend
│   ├── main.ts                # Servidor con todas las herramientas MCP
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## 🚀 Instalación y Configuración

### Requisitos Previos

- Node.js (versión 18 o superior)
- npm o pnpm

### 1. Instalar Dependencias

```bash
# Instalar dependencias del servidor MCP
cd server-mcp
npm install

# Instalar dependencias de la aplicación web
cd ../app-mcp
npm install
```

### 2. Iniciar el Servidor MCP

```bash
cd server-mcp
npm start
```

El servidor MCP se ejecutará y estará listo para recibir comandos a través del protocolo MCP.

### 3. Iniciar la Aplicación Web

En una nueva terminal:

```bash
cd app-mcp
npm run dev
```

La aplicación web estará disponible en `http://localhost:5173`

### 4. Acceder a la Aplicación

Abre tu navegador y ve a `http://localhost:5173` para acceder al visualizador 3D interactivo.

## 🛠️ Tecnologías Utilizadas

### Backend
- **Node.js** - Entorno de ejecución
- **TypeScript** - Lenguaje de programación
- **@modelcontextprotocol/sdk** - SDK para protocolo MCP
- **@thatopen/fragments** - Manipulación de modelos BIM
- **WebSocket (ws)** - Comunicación en tiempo real
- **zod** - Validación de esquemas

### Frontend
- **TypeScript** - Lenguaje de programación
- **Vite** - Herramienta de construcción
- **Three.js** - Biblioteca 3D
- **@thatopen/components** - Componentes BIM de That Open
- **@thatopen/ui** - Interfaz de usuario
- **@thatopen/fragments** - Manipulación de fragmentos BIM
- **web-ifc** - Carga de archivos IFC

## 📚 Recursos Adicionales

- [That Open Components Documentation](https://docs.thatopen.com/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [IFC Standard Documentation](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/)

---

**Desarrollado con ❤️ usando That Open Components y MCP Protocol**

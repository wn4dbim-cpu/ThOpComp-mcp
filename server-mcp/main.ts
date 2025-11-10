import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as FRAGS from "@thatopen/fragments";
import * as fs from "node:fs";
import * as path from "node:path";
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3001 });

const server = new McpServer({
  name: "BIM",
  version: "1.0.0",
});

let modelIdMap: { [modelIds: string]: number[] } | null = null;
let fragments: FRAGS.SingleThreadedFragmentsModel;
let filePath: string;

// Directorio base para exportaciones (relativo al proyecto)
const EXPORTS_DIR = path.join(process.cwd(), "exports");

// Función helper para obtener ruta de exportación absoluta
function getExportPath(filename: string): string {
  // Crear directorio exports si no existe
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
  
  // Si el filename ya es una ruta absoluta, usarla tal cual
  if (path.isAbsolute(filename)) {
    // Asegurar que el directorio padre existe
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return filename;
  }
  
  // Si es relativo, guardarlo en la carpeta exports
  return path.join(EXPORTS_DIR, filename);
}

// Helper centralizado para logging, envia salida a stderr y evita interferir con el protocolo MCP
function logInfo(...args: unknown[]): void {
  console.error(...args);
}

// Función helper para normalizar números a formato CSV (siempre punto decimal)
function normalizeNumberForCSV(value: any): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  
  // Si es un número, usar toLocaleString con formato inglés para asegurar punto decimal
  if (typeof value === 'number') {
    // Usar formato inglés (en-US) que siempre usa punto como separador decimal
    return value.toLocaleString('en-US', {
      useGrouping: false,
      maximumFractionDigits: 20
    });
  }
  
  // Si es un string, analizar si es numérico
  const stringValue = String(value).trim();
  
  // Si está vacío después de trim, retornar vacío
  if (stringValue === '') {
    return '';
  }
  
  // Intentar detectar si es un número con formato europeo (coma como decimal)
  // Patrón: número con coma decimal (ej: "15,5" o "1.234,56")
  const europeanNumberPattern = /^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^-?\d+,\d+$/;
  
  if (europeanNumberPattern.test(stringValue)) {
    // Es un número con formato europeo: reemplazar punto (miles) y coma (decimal)
    // Ejemplo: "1.234,56" -> "1234.56"
    return stringValue
      .replace(/\./g, '')  // Eliminar separadores de miles (puntos)
      .replace(',', '.');   // Convertir coma decimal a punto
  }
  
  // Si contiene solo una coma y parece ser un número decimal simple
  if (stringValue.includes(',') && !stringValue.includes('.')) {
    const commaCount = (stringValue.match(/,/g) || []).length;
    // Si hay solo una coma, probablemente es separador decimal
    if (commaCount === 1) {
      const parts = stringValue.split(',');
      // Si ambas partes son numéricas, es un decimal con coma
      if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
        return stringValue.replace(',', '.');
      }
    }
  }
  
  // Si es un número válido sin coma, retornarlo tal cual
  if (!isNaN(parseFloat(stringValue)) && isFinite(parseFloat(stringValue)) && !stringValue.includes(',')) {
    return stringValue;
  }
  
  // Si no es numérico o tiene formato complejo, retornar el valor original
  // (puede ser texto que contiene números, como "15,5 m²")
  return stringValue;
}

// Función helper para generar CSV de mediciones
function generateMeasurementsCSV(measurements: any): string {
  logInfo(`📋 [generateMeasurementsCSV] Iniciando generación de CSV...`);
  logInfo(`📋 [generateMeasurementsCSV] Estructura recibida:`, Object.keys(measurements));
  
  const csvRows: string[] = [];
  const headers = [
    'ModelId', 'LocalId', 'Name', 'Category',
    'Volume_Value', 'Volume_Unit', 'Volume_Source', 'Volume_Property',
    'Area_Value', 'Area_Unit', 'Area_Source', 'Area_Property',
    'Length_Value', 'Length_Unit', 'Length_Source', 'Length_Property',
    'Custom_Measurements'
  ];
  
  csvRows.push(headers.join(','));
  
  let totalRows = 0;
  for (const [modelId, elements] of Object.entries(measurements)) {
    const elementsArray = elements as any[];
    logInfo(`📋 [generateMeasurementsCSV] Modelo "${modelId}": ${elementsArray.length} elementos`);
    
    for (const element of elementsArray) {
      const row = [
        modelId,
        element.localId || '',
        `"${(element.name || '').replace(/"/g, '""')}"`,
        element.category || '',
        normalizeNumberForCSV(element.measurements?.volume?.value),
        element.measurements?.volume?.unit || '',
        element.measurements?.volume?.source || '',
        element.measurements?.volume?.property || '',
        normalizeNumberForCSV(element.measurements?.area?.value),
        element.measurements?.area?.unit || '',
        element.measurements?.area?.source || '',
        element.measurements?.area?.property || '',
        normalizeNumberForCSV(element.measurements?.length?.value),
        element.measurements?.length?.unit || '',
        element.measurements?.length?.source || '',
        element.measurements?.length?.property || '',
        `"${JSON.stringify(element.measurements?.custom || {}).replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
      totalRows++;
    }
  }
  
  logInfo(`📋 [generateMeasurementsCSV] CSV generado: ${totalRows} filas de datos + 1 header`);
  return csvRows.join('\n');
}

// Función helper para generar CSV de descubrimiento de propiedades
function generateDiscoveryCSV(categoryMap: any, measurementMap: any): string {
  logInfo(`📋 [generateDiscoveryCSV] Generando CSV de descubrimiento...`);
  
  const csvRows: string[] = [];
  const headers = [
    'Category', 'Elements_Analyzed', 'PropertySet_Count', 'PropertySet_Name', 
    'Measurement_Type', 'Property_Name', 'Sample_Value', 'Frequency', 'Confidence'
  ];
  
  csvRows.push(headers.join(','));
  
  let totalRows = 0;
  for (const [category, categoryInfo] of Object.entries(categoryMap)) {
    const info = categoryInfo as any;
    
    if (info.measurementPropertySets && Object.keys(info.measurementPropertySets).length > 0) {
      // Hay propiedades de medición encontradas
      for (const [psetName, properties] of Object.entries(info.measurementPropertySets)) {
        const props = properties as any;
        for (const [propName, propInfo] of Object.entries(props)) {
          const prop = propInfo as any;
          const row = [
            category,
            info.elementsAnalyzed || 0,
            info.propertySetCount || 0,
            `"${psetName}"`,
            prop.measurementType || 'custom',
            `"${propName}"`,
            normalizeNumberForCSV(prop.sampleValue),
            normalizeNumberForCSV(prop.frequency || 1),
            prop.confidence || 'medium'
          ];
          csvRows.push(row.join(','));
          totalRows++;
        }
      }
    } else {
      // No hay propiedades de medición
      const row = [
        category,
        info.elementsAnalyzed || 0,
        info.propertySetCount || 0,
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        0,
        'none'
      ];
      csvRows.push(row.join(','));
      totalRows++;
    }
  }
  
  logInfo(`📋 [generateDiscoveryCSV] CSV generado: ${totalRows} filas de datos + 1 header`);
  return csvRows.join('\n');
}

// Sistema de manejo de respuestas asíncronas del cliente
let pendingResponse: {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout?: NodeJS.Timeout;
} | null = null;

// Manejar respuestas del cliente WebSocket
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if ((data.command === 'selectedElementsResult' || 
           data.command === 'selectedElementsMetadataResult' ||
           data.command === 'elementsInfoResult' ||
           data.command === 'elementsMeasurementsResult' ||
           data.command === 'discoveryResult') && pendingResponse) {
        clearTimeout(pendingResponse.timeout);
        pendingResponse.resolve(data.payload);
        pendingResponse = null;
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  });
});

server.tool(
  "load-frags",
  "Loads a .frags file. Needs file-system server",
  {
    path: z.string().describe("Full path of the file to load with fragments."),
  },
  async ({ path }) => {
    filePath = path;
    const file: Buffer = fs.readFileSync(path);

    wss.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        client.send(file);
      }
    });

    return {
      content: [
        {
          type: "text",
          text: `Loaded and sent Frags from ${filePath}`,
        },
      ],
    };
  }
)

server.tool(
  "load-ifc",
  "Carga un archivo .ifc, lo convierte a fragmentos y lo visualiza en el visor 3D. El IfcLoader del visualizador se encarga de la conversión automática.",
  {
    path: z.string().describe("Ruta completa del archivo .ifc a cargar"),
    modelId: z.string().optional().default("mcp").describe("ID único para el modelo (default: 'mcp')"),
  },
  async ({ path, modelId = "mcp" }) => {
    try {
      // Validar que hay clientes WebSocket conectados
      if (wss.clients.size === 0) {
        throw new Error("No hay visualizadores conectados. Asegúrate de que la aplicación web esté abierta en http://localhost:5173");
      }

      // Validar que el archivo existe y es .ifc
      if (!fs.existsSync(path)) {
        throw new Error(`El archivo no existe: ${path}`);
      }

      if (!path.toLowerCase().endsWith('.ifc')) {
        throw new Error(`El archivo debe tener extensión .ifc. Recibido: ${path}`);
      }

      // Leer el archivo IFC
      const fileBuffer: Buffer = fs.readFileSync(path);
      const fileSize = (fileBuffer.length / (1024 * 1024)).toFixed(2); // MB

      // Enviar comando con el archivo IFC al visualizador
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          // Enviar comando JSON primero indicando que viene un archivo IFC
          client.send(
            JSON.stringify({
              command: "loadIfc",
              payload: {
                modelId,
                fileName: path.split(/[\\/]/).pop(), // Nombre del archivo
                fileSize,
              },
            })
          );

          // Enviar el archivo IFC como ArrayBuffer
          // Esperamos un poco para que el comando JSON se procese primero
          setTimeout(() => {
            client.send(fileBuffer);
          }, 50);
        }
      });

      // Guardar la ruta para otras herramientas que la necesiten
      filePath = path;

      return {
        content: [
          {
            type: "text",
            text: `Archivo IFC cargado exitosamente\n\nArchivo: ${path.split(/[\\/]/).pop()}\nTamano: ${fileSize} MB\nEstado: Enviado al visualizador para conversion\n\nEl visualizador esta procesando el archivo IFC y convirtiendolo a fragmentos...\nEsto puede tomar unos segundos dependiendo del tamano del modelo.\n\nTip: Observa el visualizador web para ver el progreso de carga.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error al cargar archivo IFC: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
)

server.tool(
  "getModelIdMap",
  "Gets local Ids of elements based on a category",
  {
    category: z.string().describe("Category name. e.g.: IFCWALL"),
  },
  ({ category }) => {
    const fileBuffer: Buffer = fs.readFileSync(filePath);
    fragments = new FRAGS.SingleThreadedFragmentsModel("mcp", new Uint8Array(fileBuffer));

    const items = fragments.getItemsOfCategories([new RegExp(category)]);
    const localIds = Object.values(items).flat();

    modelIdMap = { mcp: localIds };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(modelIdMap),
        },
      ],
    };
  }
)

server.tool(
  "highlight",
  "Highlights the elements extracted from the localIds",
  {
    modelIdMap: z
      .record(z.array(z.number()))
      .describe("The localIds to highlight."),
  },
  ({ modelIdMap }) => {
    if (!modelIdMap) throw new Error("No local Ids retrieved yet");

    wss.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        client.send(
          JSON.stringify({
            command: "highlight",
            payload: { modelIdMap },
          }),
        );
      }
    });

    return {
      content: [
        {
          type: "text",
          text: `Sent a request to highlight the elements.`,
        },
      ],
    };
  }
)

server.tool(
  "get-elements-info",
  "Obtiene información completa de elementos específicos: atributos directos, Property Sets y propiedades. Simple y directo como highlight.",
  {
    modelIdMap: z
      .record(z.array(z.number()))
      .describe("Mapa de modelos con sus localIds. Ejemplo: { 'mcp': [123, 456, 789] }"),
    formatPsets: z
      .boolean()
      .optional()
      .default(true)
      .describe("Si formatear los Property Sets a estructura legible (default: true)")
  },
  async ({ modelIdMap, formatPsets = true }) => {
    try {
      // Validar que hay clientes WebSocket conectados
      if (wss.clients.size === 0) {
        throw new Error("No hay visualizadores conectados. Asegúrate de que la aplicación web esté abierta en http://localhost:5173");
      }

      if (!modelIdMap) {
        throw new Error("No se proporcionaron localIds");
      }

      logInfo(` [get-elements-info] Solicitando información de elementos...`);
      logInfo(`   - Modelos: ${Object.keys(modelIdMap).join(', ')}`);
      
      // Enviar comando al visualizador para obtener información
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              command: "getElementsInfo",
              payload: { modelIdMap, formatPsets },
            }),
          );
        }
      });

      // Esperar respuesta del cliente con timeout
      const response = await new Promise((resolve, reject) => {
        pendingResponse = {
          resolve,
          reject,
          timeout: setTimeout(() => {
            reject(new Error("Timeout esperando respuesta del visualizador"));
          }, 10000) // 10 segundos de timeout (más tiempo para procesar múltiples elementos)
        };
      });

      const { success, totalElements, elements, message } = response as any;

      if (!success) {
        return {
          content: [
            {
              type: "text",
              text: ` ${message}`,
            },
          ],
        };
      }

      // Generar resumen limpio y estadísticas
      let totalPsets = 0;
      let elementsWithPsets = 0;
      
      for (const [modelId, elementsList] of Object.entries(elements)) {
        const elementsArray = elementsList as any[];
        for (const element of elementsArray) {
          if (element.propertySets && Object.keys(element.propertySets).length > 0) {
            elementsWithPsets++;
            totalPsets += Object.keys(element.propertySets).length;
          }
        }
      }

      const summary = `Información de elementos obtenida exitosamente

Resumen:
- Total de elementos: ${totalElements}
- Modelos: ${Object.keys(elements).length}
- Elementos con Property Sets: ${elementsWithPsets}
- Total Property Sets encontrados: ${totalPsets}

Datos completos disponibles en formato JSON.`;

      return {
        content: [
          {
            type: "text",
            text: summary,
          },
          {
            type: "text",
            text: JSON.stringify(elements, null, 2),
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error al obtener informacion de elementos: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
)

server.tool(
  "export-elements-csv",
  "Exporta información completa de elementos específicos directamente a formato CSV. Similar a get-elements-info pero enfocado únicamente en exportación CSV.",
  {
    modelIdMap: z
      .record(z.array(z.number()))
      .describe("Mapa de modelos con sus localIds. Ejemplo: { 'mcp': [123, 456, 789] }"),
    outputPath: z
      .string()
      .optional()
      .default("elements_export.csv")
      .describe("Ruta del archivo CSV a crear (relativa a /exports/ o absoluta)"),
    formatPsets: z
      .boolean()
      .optional()
      .default(true)
      .describe("Si formatear los Property Sets a estructura legible (default: true)"),
    includeMetadata: z
      .boolean()
      .optional()
      .default(true)
      .describe("Si incluir metadatos adicionales como dimensiones y restricciones (default: true)")
  },
  async ({ modelIdMap, outputPath = "elements_export.csv", formatPsets = true, includeMetadata = true }) => {
    try {
      // Validar que hay clientes WebSocket conectados
      if (wss.clients.size === 0) {
        throw new Error("No hay visualizadores conectados. Asegúrate de que la aplicación web esté abierta en http://localhost:5173");
      }

      if (!modelIdMap) {
        throw new Error("No se proporcionaron localIds");
      }

      logInfo(` [export-elements-csv] Exportando elementos a CSV...`);
      logInfo(`   - Modelos: ${Object.keys(modelIdMap).join(', ')}`);
      logInfo(`   - Archivo: ${outputPath}`);
      
      // Primero obtener la información de los elementos
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              command: "getElementsInfo",
              payload: { modelIdMap, formatPsets },
            }),
          );
        }
      });

      // Esperar respuesta del cliente con timeout
      const response = await new Promise((resolve, reject) => {
        pendingResponse = {
          resolve,
          reject,
          timeout: setTimeout(() => {
            reject(new Error("Timeout esperando respuesta del visualizador"));
          }, 15000) // 15 segundos para procesar y exportar
        };
      });

      const { success, totalElements, elements, message } = response as any;

      if (!success) {
        console.error(` [export-elements-csv] Error del visualizador: ${message}`);
        return {
          content: [
            {
              type: "text",
              text: `Error al obtener informacion de elementos: ${message}`,
            },
          ],
        };
      }

      // Validar que se obtuvieron datos
      if (!elements || Object.keys(elements).length === 0) {
        console.error(` [export-elements-csv] No se obtuvieron elementos del visualizador`);
        return {
          content: [
            {
              type: "text",
              text: `Error: No se obtuvieron elementos del visualizador. Verifica que el modelo este cargado y que los localIds sean validos.`,
            },
          ],
        };
      }

      logInfo(` [export-elements-csv] Datos recibidos: ${totalElements} elementos de ${Object.keys(elements).length} modelo(s)`);

      // Procesar elementos y convertir a formato CSV
      const csvRows: string[] = [];
      const headers = new Set<string>();
      const processedElements: any[] = [];

      // Procesar todos los elementos para determinar todas las columnas posibles
      for (const [modelId, elementsList] of Object.entries(elements)) {
        const elementsArray = elementsList as any[];
        logInfo(` [export-elements-csv] Procesando modelo "${modelId}": ${elementsArray.length} elementos`);
        
        for (const element of elementsArray) {
          try {
            const flatElement: any = {
              ModelId: modelId,
              LocalId: element.localId,
              Name: element.name || '',
              GlobalId: element.globalId || '',
              Category: element.category || '',
              ObjectType: element.objectType || ''
            };

            // Agregar Property Sets como columnas planas
            if (element.propertySets && includeMetadata) {
              let psetCount = 0;
              for (const [psetName, psetData] of Object.entries(element.propertySets)) {
                if (typeof psetData === 'object' && psetData !== null) {
                  for (const [propName, propValue] of Object.entries(psetData as any)) {
                    const columnName = `${psetName}_${propName}`;
                    flatElement[columnName] = propValue;
                    headers.add(columnName);
                    psetCount++;
                  }
                }
              }
              if (psetCount > 0) {
                logInfo(`    Elemento ${element.localId}: ${psetCount} propiedades de Property Sets agregadas`);
              }
            }

            // Agregar headers básicos
            Object.keys(flatElement).forEach(key => headers.add(key));
            processedElements.push(flatElement);
          } catch (error) {
            console.error(` [export-elements-csv] Error procesando elemento ${element.localId}:`, error);
            // Continuar con el siguiente elemento
          }
        }
      }

      // Validar que se procesaron elementos
      if (processedElements.length === 0) {
        console.error(` [export-elements-csv] No se procesaron elementos correctamente`);
        return {
          content: [
            {
              type: "text",
              text: `Error: No se procesaron elementos correctamente. Verifica que los elementos tengan datos validos.`,
            },
          ],
        };
      }

      logInfo(` [export-elements-csv] Elementos procesados: ${processedElements.length}, Columnas: ${headers.size}`);

      // Crear header CSV
      const headerArray = Array.from(headers).sort();
      csvRows.push(headerArray.join(','));

      // Crear filas de datos
      for (const element of processedElements) {
        const row = headerArray.map(header => {
          const value = element[header];
          if (value === undefined || value === null) return '';
          
          // Normalizar números primero (convertir coma a punto)
          const normalizedValue = normalizeNumberForCSV(value);
          
          // Escapar comillas y comas en el valor
          const stringValue = String(normalizedValue);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');

      // Determinar ruta final del archivo usando la función helper existente
      const finalPath = getExportPath(outputPath);

      // Escribir archivo CSV
      try {
        fs.writeFileSync(finalPath, csvContent, 'utf-8');
        logInfo(` [export-elements-csv] Archivo CSV guardado: ${finalPath}`);
      } catch (error) {
        console.error(` [export-elements-csv] Error escribiendo archivo:`, error);
        throw new Error(`Error escribiendo archivo CSV: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }

      // Generar estadísticas
      let totalPsets = 0;
      let elementsWithPsets = 0;
      
      for (const element of processedElements) {
        const psetKeys = Object.keys(element).filter(key => key.includes('_') && !['ModelId', 'LocalId'].includes(key));
        if (psetKeys.length > 0) {
          elementsWithPsets++;
          totalPsets += psetKeys.length;
        }
      }

      const summary = `Exportacion CSV completada exitosamente

Estadisticas:
- Total de elementos exportados: ${totalElements}
- Modelos procesados: ${Object.keys(elements).length}
- Elementos con Property Sets: ${elementsWithPsets}
- Total de propiedades exportadas: ${headerArray.length}
- Columnas en CSV: ${headerArray.length}

Archivo guardado en:
${finalPath}

Tip: El archivo CSV incluye todas las propiedades como columnas separadas para facil analisis en Excel o herramientas similares.`;

      return {
        content: [
          {
            type: "text",
            text: summary,
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error al exportar elementos a CSV: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
)

// server.tool(
//   "test-property-sets",
//   "🧪 Herramienta de diagnóstico: Verifica si un modelo cargado tiene Property Sets. Útil para diagnosticar problemas con búsquedas en Psets.",
//   {
//     modelId: z.string().optional().default("mcp").describe("ID del modelo a probar (default: 'mcp')"),
//     sampleSize: z.number().optional().default(5).describe("Número de elementos de muestra a analizar (default: 5)")
//   },
//   async ({ modelId = "mcp", sampleSize = 5 }) => {
//     try {
//       // Validar que hay clientes WebSocket conectados
//       if (wss.clients.size === 0) {
//         throw new Error("No hay visualizadores conectados. Asegúrate de que la aplicación web esté abierta en http://localhost:5173");
//       }

//       console.log(`\n [SERVER] Iniciando test de Property Sets para modelo: ${modelId}`);
//       console.log(`   - Tamaño de muestra: ${sampleSize} elementos`);
      
//       // Enviar comando al visualizador para ejecutar el test
//       wss.clients.forEach((client: any) => {
//         if (client.readyState === 1) {
//           client.send(
//             JSON.stringify({
//               command: "testPropertySets",
//               payload: { modelId, sampleSize },
//             }),
//           );
//         }
//       });

//       return {
//         content: [
//           {
//             type: "text",
//             text: ` Test de Property Sets iniciado para modelo "${modelId}"\n\n Configuración:\n- Modelo: ${modelId}\n- Muestra: ${sampleSize} elementos\n\n Abre la consola del navegador (F12) para ver los resultados detallados del test.\n\n Este test te mostrará:\n✓ Cuántos elementos tienen Property Sets\n✓ Qué tipos de Property Sets contiene el modelo\n✓ Ejemplos de propiedades y sus valores\n\n Si no ves Property Sets:\n1. El modelo puede no contener Psets\n2. El modelo puede ser un .frags sin metadata completa\n3. Los archivos IFC nativos suelen tener más Psets que .frags`,
//           },
//         ],
//       };
//     } catch (error) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: ` Error al ejecutar test: ${error instanceof Error ? error.message : 'Error desconocido'}`,
//           },
//         ],
//       };
//     }
//   }
// )


// Definición recursiva del esquema de relación para soportar relaciones anidadas (Property Sets)
const relationQuerySchema: z.ZodType<any> = z.lazy(() => 
  z.object({
    categories: z.array(z.string()).optional().describe("Categorías IFC del elemento relacionado (ej: ['IFCPROPERTYSET', 'IFCPROPERTYSINGLEVALUE'])"),
    attributes: z.array(z.object({
      name: z.string().describe("Nombre del atributo a buscar (ej: 'Name', 'NominalValue')"),
      value: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Valor del atributo (opcional)")
    })).optional().describe("Array de criterios de atributos para filtrar"),
    relation: z.object({
      name: z.string().describe("Nombre de la relación IFC (ej: 'HasProperties', 'IsDefinedBy')"),
      query: relationQuerySchema
    }).optional().describe("Relación anidada (útil para Property Sets)")
  })
);

server.tool(
  "fast-find-elements",
  `Búsqueda rápida de elementos usando ItemsFinder del visualizador. Soporta búsquedas por categoría, atributos directos y Property Sets con relaciones anidadas.

 CASOS DE USO:
1. Búsqueda simple por categoría: Encuentra todos los muros, puertas, ventanas, etc.
2. Búsqueda por atributos directos: Encuentra elementos por Name, ObjectType, etc.
3. Búsqueda en Property Sets (Psets): Usa relaciones anidadas para buscar por propiedades en Psets.

 EJEMPLO PARA PROPERTY SETS:
Para buscar elementos con "Sector de Obra = S2" en el Pset "Texto de título":
{
  "queryName": "elementos_sector_s2",
  "categories": ["COLUMN", "WALL"],  // Opcional: limitar categorías
  "relation": {
    "name": "IsDefinedBy",
    "query": {
      "categories": ["IFCPROPERTYSET"],
      "attributes": [
        { "name": "Name", "value": "Texto de título" }
      ],
      "relation": {
        "name": "HasProperties",
        "query": {
          "categories": ["IFCPROPERTYSINGLEVALUE"],
          "attributes": [
            { "name": "Name", "value": "Sector de Obra" },
            { "name": "NominalValue", "value": "S2" }
          ]
        }
      }
    }
  }
}`,
  {
    queryName: z.string().describe("Nombre único para la consulta que se va a crear en ItemsFinder"),
    categories: z.array(z.string()).optional().describe("Array de categorías IFC a buscar (ej: ['WALL', 'DOOR', 'WINDOW']). Usa regex internamente."),
    attributes: z.array(z.object({
      name: z.string().describe("Nombre del atributo a buscar"),
      value: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Valor del atributo (opcional)")
    })).optional().describe("Array de criterios de atributos directos del elemento"),
    relation: z.object({
      name: z.string().describe("Nombre de la relación IFC (ej: 'IsDefinedBy' para Psets, 'ContainedInStructure' para jerarquía)"),
      query: relationQuerySchema
    }).optional().describe("Criterios de relación para búsquedas jerárquicas o en Property Sets"),
    execute: z.boolean().optional().default(true).describe("Si ejecutar y resaltar la consulta inmediatamente después de crearla")
  },
  async ({ queryName, categories, attributes, relation, execute = true }) => {
    try {
      // Validar que hay clientes WebSocket conectados
      if (wss.clients.size === 0) {
        throw new Error("No hay visualizadores conectados. Asegúrate de que la aplicación web esté abierta en http://localhost:5173");
      }
      // Función recursiva para procesar queries anidados
      const processQuery = (query: any): any => {
        const result: any = {};

        // Procesar categorías
        if (query.categories && query.categories.length > 0) {
          result.categories = query.categories.map((cat: string) => `/${cat}/i`);
        }

        // Procesar atributos
        if (query.attributes && query.attributes.length > 0) {
          result.attributes = {
            queries: query.attributes.map((attr: any) => {
              const attrQuery: any = {
                name: `/${attr.name}/i`
              };
              if (attr.value !== undefined) {
                // Si el valor es string, crear regex; si no, usar el valor directo
                if (typeof attr.value === 'string') {
                  attrQuery.value = `/${attr.value}/i`;
                } else {
                  attrQuery.value = attr.value;
                }
              }
              return attrQuery;
            })
          };
        }

        // Procesar relación recursivamente
        if (query.relation) {
          result.relation = {
            name: query.relation.name,
            query: processQuery(query.relation.query)
          };
        }

        return result;
      };

      // Construir los parámetros de la consulta
      const queryParams: any[] = [{}];

      // Agregar categorías principales
      if (categories && categories.length > 0) {
        queryParams[0].categories = categories.map(cat => `/${cat}/i`);
      }

      // Agregar atributos principales
      if (attributes && attributes.length > 0) {
        queryParams[0].attributes = {
          queries: attributes.map(attr => {
            const attrQuery: any = {
              name: `/${attr.name}/i`
            };
            if (attr.value !== undefined) {
              if (typeof attr.value === 'string') {
                attrQuery.value = `/${attr.value}/i`;
              } else {
                attrQuery.value = attr.value;
              }
            }
            return attrQuery;
          })
        };
      }

      // Agregar relación (puede ser anidada para Property Sets)
      if (relation) {
        queryParams[0].relation = {
          name: relation.name,
          query: processQuery(relation.query)
        };
      }

      // Enviar comando para crear la consulta en el visualizador
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              command: "createQuery",
              payload: { queryName, queryParams },
            }),
          );
        }
      });

      let executionResult = null;

      // Si se debe ejecutar inmediatamente
      if (execute) {
        // Esperar un poco para que la consulta se cree
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Enviar comando para ejecutar la consulta
        wss.clients.forEach((client: any) => {
          if (client.readyState === 1) {
            client.send(
              JSON.stringify({
                command: "executeQuery",
                payload: { queryName, highlightResults: true },
              }),
            );
          }
        });

        executionResult = "Consulta ejecutada y elementos resaltados en el visualizador";
      }

      // Determinar el tipo de búsqueda para el resumen
      let searchType = "Simple";
      if (relation) {
        if (relation.query.relation) {
          searchType = "Property Set (Pset) con relaciones anidadas";
        } else {
          searchType = "Relacional";
        }
      }

      const summary = ` Consulta ItemsFinder creada exitosamente:\n\n Detalles de la consulta:\n- Nombre: "${queryName}"\n- Tipo de búsqueda: ${searchType}\n- Categorías: ${categories ? categories.join(', ') : 'Todas'}\n- Atributos directos: ${attributes ? attributes.length : 0}\n- Relación principal: ${relation ? relation.name : 'Ninguna'}\n- Relaciones anidadas: ${relation?.query?.relation ? '✅ Sí (Property Set)' : 'No'}\n- Estado: ${execute ? ' Ejecutada y elementos resaltados' : ' Guardada sin ejecutar'}\n\n🔧 La consulta ha sido creada en el componente ItemsFinder del visualizador y puede ser reutilizada.\n\n Parámetros de la consulta:`;

      return {
        content: [
          {
            type: "text",
            text: summary,
          },
          {
            type: "text",
            text: JSON.stringify({ queryName, queryParams, executed: execute, executionResult }, null, 2),
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error al crear consulta ItemsFinder: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
)

server.tool(
  "execute-query",
  "Ejecuta una consulta previamente creada con ItemsFinder y opcionalmente resalta los resultados en el visualizador.",
  {
    queryName: z.string().describe("Nombre de la consulta a ejecutar"),
    highlightResults: z.boolean().optional().default(true).describe("Si resaltar los elementos encontrados en el visualizador")
  },
  async ({ queryName, highlightResults = true }) => {
    try {
      // Enviar comando para ejecutar la consulta
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              command: "executeQuery",
              payload: { queryName, highlightResults },
            }),
          );
        }
      });

      return {
        content: [
          {
            type: "text",
            text: ` Consulta "${queryName}" ejecutada exitosamente.\n${highlightResults ? ' Los elementos encontrados han sido resaltados en el visualizador.' : ' Resultados procesados sin resaltar.'}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error al ejecutar consulta: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
)

server.tool(
  "list-queries",
  "Lista todas las consultas creadas en ItemsFinder disponibles en el visualizador.",
  {},
  async () => {
    try {
      // Enviar comando para listar consultas
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              command: "listQueries",
              payload: {},
            }),
          );
        }
      });

      return {
        content: [
          {
            type: "text",
            text: ` Solicitando lista de consultas al visualizador...\n\nLas consultas disponibles se mostrarán en la consola del navegador.\n\nTip: Usa esta herramienta para ver qué consultas están disponibles antes de ejecutarlas.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error al listar consultas: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
)

server.tool(
  "delete-query",
  "Elimina una consulta previamente creada en ItemsFinder.",
  {
    queryName: z.string().describe("Nombre de la consulta a eliminar")
  },
  async ({ queryName }) => {
    try {
      // Enviar comando para eliminar la consulta
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              command: "deleteQuery",
              payload: { queryName },
            }),
          );
        }
      });

      return {
        content: [
          {
            type: "text",
            text: ` Consulta "${queryName}" eliminada del ItemsFinder.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error al eliminar consulta: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
)

server.tool(
  "export-queries",
  "Exporta todas las consultas de ItemsFinder a formato JSON para guardarlas o reutilizarlas.",
  {},
  async () => {
    try {
      // Enviar comando para exportar consultas
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              command: "exportQueries",
              payload: {},
            }),
          );
        }
      });

      return {
        content: [
          {
            type: "text",
            text: ` Exportando consultas del ItemsFinder...\n\nLos datos exportados se mostrarán en la consola del navegador.\n\n Tip: Puedes guardar estos datos y luego importarlos con 'import-queries' para restaurar tus consultas.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error al exportar consultas: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
)

server.tool(
  "import-queries",
  "Importa consultas previamente exportadas de ItemsFinder desde un JSON.",
  {
    data: z.any().describe("Datos JSON de las consultas exportadas previamente")
  },
  async ({ data }) => {
    try {
      // Enviar comando para importar consultas
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              command: "importQueries",
              payload: { data },
            }),
          );
        }
      });

      return {
        content: [
          {
            type: "text",
            text: ` Consultas importadas exitosamente al ItemsFinder.\n\n Ahora puedes ejecutar las consultas importadas usando 'execute-query'.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error al importar consultas: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
)


server.tool(
  "get-elements-measurements",
  "Extrae mediciones completas (volumen, area, longitud) de elementos BIM especificos. Optimizado para modelos grandes con procesamiento por lotes.",
  {
    modelIdMap: z
      .record(z.array(z.number()))
      .describe("Mapa de modelos con sus localIds. Ejemplo: { 'mcp': [123, 456, 789] }"),
    measurementTypes: z
      .array(z.enum(["volume", "area", "length", "all"]))
      .optional()
      .default(["all"])
      .describe("Tipos de mediciones a extraer (default: ['all'])"),
    includeCustom: z
      .boolean()
      .optional()
      .default(true)
      .describe("Incluir mediciones personalizadas de Property Sets (default: true)"),
    outputFormat: z
      .enum(["detailed", "summary", "csv"])
      .optional()
      .default("detailed")
      .describe("Formato de salida (default: 'detailed')"),
    batchSize: z
      .number()
      .optional()
      .default(100)
      .describe("Tamano de lote para procesamiento - optimizacion (default: 100)"),
    exportPath: z
      .string()
      .optional()
      .describe("Ruta para exportar CSV (solo si outputFormat es 'csv')")
  },
  async ({ 
    modelIdMap, 
    measurementTypes = ["all"], 
    includeCustom = true, 
    outputFormat = "detailed",
    batchSize = 100,
    exportPath
  }) => {
    try {
      // Validar que hay clientes WebSocket conectados
      if (wss.clients.size === 0) {
        throw new Error("No hay visualizadores conectados. Asegurate de que la aplicacion web este abierta en http://localhost:5173");
      }

      if (!modelIdMap) {
        throw new Error("No se proporcionaron localIds");
      }

      logInfo(` [get-elements-measurements] Iniciando extraccion de mediciones...`);
      logInfo(`   - Modelos: ${Object.keys(modelIdMap).join(', ')}`);
      logInfo(`   - Tipos: ${measurementTypes.join(', ')}`);
      logInfo(`   - Formato: ${outputFormat}`);
      logInfo(`   - Lote: ${batchSize} elementos`);
      
      // Enviar comando al visualizador para obtener mediciones
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              command: "getElementsMeasurements",
              payload: { 
                modelIdMap, 
                measurementTypes, 
                includeCustom, 
                batchSize 
              },
            }),
          );
        }
      });

      // Esperar respuesta del cliente con timeout extendido para modelos grandes
      const response = await new Promise((resolve, reject) => {
        pendingResponse = {
          resolve,
          reject,
          timeout: setTimeout(() => {
            reject(new Error("Timeout esperando respuesta del visualizador"));
          }, 30000) // 30 segundos para modelos grandes
        };
      });

      const { success, totalElements, measurements, summary, processingTime, message } = response as any;

      if (!success) {
        console.error(` [get-elements-measurements] Error del visualizador: ${message}`);
        return {
          content: [
            {
              type: "text",
              text: `Error al obtener mediciones: ${message}`,
            },
          ],
        };
      }

      logInfo(` [get-elements-measurements] Procesado: ${totalElements} elementos en ${processingTime}`);
      logInfo(` [get-elements-measurements] Formato solicitado: ${outputFormat}`);
      logInfo(` [get-elements-measurements] ExportPath: ${exportPath || 'default'}`);

      // Procesar según el formato de salida
      if (outputFormat === "csv") {
        logInfo(` [get-elements-measurements] Generando CSV...`);
        // Generar CSV
        const csvContent = generateMeasurementsCSV(measurements);
        const finalPath = getExportPath(exportPath || "measurements_export.csv");
        logInfo(` [get-elements-measurements] Ruta final: ${finalPath}`);
        
        try {
          fs.writeFileSync(finalPath, csvContent, 'utf-8');
          logInfo(` [get-elements-measurements] CSV guardado: ${finalPath}`);
        } catch (error) {
          throw new Error(`Error escribiendo archivo CSV: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `Mediciones extraidas y exportadas a CSV exitosamente

Estadisticas:
- Total de elementos procesados: ${totalElements}
- Elementos con mediciones: ${summary.elementsWithMeasurements}
- Tiempo de procesamiento: ${processingTime}
- Volumen total: ${summary.totalVolume || 'N/A'} m³
- Area total: ${summary.totalArea || 'N/A'} m²
- Longitud total: ${summary.totalLength || 'N/A'} m

Archivo guardado en: ${finalPath}`,
            },
          ],
        };
      } else if (outputFormat === "summary") {
        // Formato resumen
        return {
          content: [
            {
              type: "text",
              text: `Resumen de mediciones extraidas

Estadisticas generales:
- Total de elementos: ${totalElements}
- Elementos con mediciones: ${summary.elementsWithMeasurements}
- Tiempo de procesamiento: ${processingTime}

Totales por tipo:
- Volumen total: ${summary.totalVolume || 'N/A'} m³
- Area total: ${summary.totalArea || 'N/A'} m²
- Longitud total: ${summary.totalLength || 'N/A'} m

Para ver detalles completos, usa outputFormat: "detailed"`,
            },
          ],
        };
      } else {
        // Formato detallado (default)
        return {
          content: [
            {
              type: "text",
              text: `Mediciones extraidas exitosamente

Estadisticas:
- Total de elementos: ${totalElements}
- Elementos con mediciones: ${summary.elementsWithMeasurements}
- Tiempo de procesamiento: ${processingTime}

Resumen de totales:
- Volumen: ${summary.totalVolume || 'N/A'} m³
- Area: ${summary.totalArea || 'N/A'} m²
- Longitud: ${summary.totalLength || 'N/A'} m

Datos completos disponibles en formato JSON.`,
            },
            {
              type: "text",
              text: JSON.stringify(measurements, null, 2),
            },
          ],
        };
      }

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error al extraer mediciones: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
)

server.tool(
  "discover-measurement-properties",
  "Explora el modelo para descubrir en que Property Sets se encuentran las propiedades de medicion (Volume, Area, Length) por categoria de elemento. Analiza un elemento de muestra por categoria.",
  {
    modelId: z
      .string()
      .optional()
      .default("mcp")
      .describe("ID del modelo a analizar (default: 'mcp')"),
    categories: z
      .array(z.string())
      .optional()
      .describe("Categorias especificas a analizar (opcional, si no se especifica analiza todas las disponibles)"),
    sampleSize: z
      .number()
      .optional()
      .default(3)
      .describe("Numero de elementos por categoria a analizar (default: 3)"),
    outputFormat: z
      .enum(["detailed", "summary", "csv"])
      .optional()
      .default("detailed")
      .describe("Formato de salida (default: 'detailed')"),
    exportPath: z
      .string()
      .optional()
      .describe("Ruta para exportar CSV (solo si outputFormat es 'csv')")
  },
  async ({ 
    modelId = "mcp", 
    categories, 
    sampleSize = 3, 
    outputFormat = "detailed",
    exportPath
  }) => {
    try {
      // Validar que hay clientes WebSocket conectados
      if (wss.clients.size === 0) {
        throw new Error("No hay visualizadores conectados. Asegurate de que la aplicacion web este abierta en http://localhost:5173");
      }

      logInfo(` [discover-measurement-properties] Iniciando exploracion de propiedades...`);
      logInfo(`   - Modelo: ${modelId}`);
      logInfo(`   - Categorias: ${categories ? categories.join(', ') : 'Todas disponibles'}`);
      logInfo(`   - Muestra por categoria: ${sampleSize}`);
      logInfo(`   - Formato: ${outputFormat}`);
      
      // Enviar comando al visualizador para descubrir propiedades
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              command: "discoverMeasurementProperties",
              payload: { 
                modelId, 
                categories, 
                sampleSize 
              },
            }),
          );
        }
      });

      // Esperar respuesta del cliente con timeout
      const response = await new Promise((resolve, reject) => {
        pendingResponse = {
          resolve,
          reject,
          timeout: setTimeout(() => {
            reject(new Error("Timeout esperando respuesta del visualizador"));
          }, 20000) // 20 segundos para explorar
        };
      });

      const { success, totalCategories, categoryMap, measurementMap, processingTime, message } = response as any;

      if (!success) {
        console.error(` [discover-measurement-properties] Error del visualizador: ${message}`);
        return {
          content: [
            {
              type: "text",
              text: `Error al explorar propiedades: ${message}`,
            },
          ],
        };
      }

      logInfo(` [discover-measurement-properties] Exploracion completa: ${totalCategories} categorias en ${processingTime}`);

      // Procesar según el formato de salida
      if (outputFormat === "csv") {
        // Generar CSV con el mapeo de propiedades
        const csvContent = generateDiscoveryCSV(categoryMap, measurementMap);
        const finalPath = getExportPath(exportPath || "measurement_properties_discovery.csv");
        
        try {
          fs.writeFileSync(finalPath, csvContent, 'utf-8');
          logInfo(` [discover-measurement-properties] CSV guardado: ${finalPath}`);
        } catch (error) {
          throw new Error(`Error escribiendo archivo CSV: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `Exploracion de propiedades completada y exportada a CSV

Estadisticas:
- Total de categorias analizadas: ${totalCategories}
- Tiempo de procesamiento: ${processingTime}

Archivo guardado en: ${finalPath}

El CSV contiene el mapeo completo de donde se encuentran las propiedades de medicion por categoria.`,
            },
          ],
        };
      } else if (outputFormat === "summary") {
        // Formato resumen
        let summaryText = `Exploracion de propiedades de medicion completada

Estadisticas:
- Categorias analizadas: ${totalCategories}
- Tiempo de procesamiento: ${processingTime}

Resumen de propiedades encontradas:`;

        for (const [category, info] of Object.entries(categoryMap as any)) {
          const categoryInfo = info as any;
          summaryText += `\n\n ${category}:`;
          summaryText += `\n  - Elementos analizados: ${categoryInfo.elementsAnalyzed}`;
          summaryText += `\n  - Property Sets encontrados: ${categoryInfo.propertySetCount}`;
          if (categoryInfo.measurementProperties && categoryInfo.measurementProperties.length > 0) {
            summaryText += `\n  - Propiedades de medicion: ${categoryInfo.measurementProperties.join(', ')}`;
          } else {
            summaryText += `\n  - Propiedades de medicion: Ninguna encontrada`;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: summaryText,
            },
          ],
        };
      } else {
        // Formato detallado (default)
        return {
          content: [
            {
              type: "text",
              text: `Exploracion de propiedades completada exitosamente

Estadisticas:
- Total de categorias: ${totalCategories}
- Tiempo de procesamiento: ${processingTime}

Datos completos del mapeo de propiedades disponibles en formato JSON.`,
            },
            {
              type: "text",
              text: JSON.stringify({ categoryMap, measurementMap }, null, 2),
            },
          ],
        };
      }

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error al explorar propiedades: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
)

server.tool(
  "get-selected-elements",
  "Obtiene los IDs de los elementos actualmente seleccionados o resaltados en el visualizador. Opcionalmente puede exportar los datos a un archivo CSV.",
  {
    exportToCsv: z.boolean().optional().default(false).describe("Si exportar los elementos a un archivo CSV"),
    outputPath: z.string().optional().describe("Ruta donde guardar el archivo CSV (solo si exportToCsv es true). Por defecto se guarda en el directorio actual como 'selected_elements.csv'"),
    includeAttributes: z.boolean().optional().default(false).describe("Si incluir atributos adicionales de los elementos en el CSV (requiere que el modelo esté cargado como .frags)")
  },
  async ({ exportToCsv = false, outputPath = "selected_elements.csv", includeAttributes = false }) => {
    try {
      // Validar que hay clientes WebSocket conectados
      if (wss.clients.size === 0) {
        throw new Error("No hay visualizadores conectados. Asegúrate de que la aplicación web esté abierta en http://localhost:5173");
      }

      // Solicitar elementos seleccionados al cliente
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              command: "getSelectedElements",
              payload: {},
            }),
          );
        }
      });

      // Esperar respuesta del cliente con timeout
      const response = await new Promise((resolve, reject) => {
        pendingResponse = {
          resolve,
          reject,
          timeout: setTimeout(() => {
            reject(new Error("Timeout esperando respuesta del visualizador"));
          }, 5000) // 5 segundos de timeout
        };
      });

      const { success, totalElements, models, message } = response as any;

      if (!success || totalElements === 0) {
        return {
          content: [
            {
              type: "text",
              text: `ℹ ${message}\n\n Tip: Selecciona elementos en el visualizador haciendo clic en ellos o usa herramientas como 'fast-find-elements' para resaltarlos.`,
            },
          ],
        };
      }

      // Generar resumen de elementos
      let summary = ` Elementos seleccionados obtenidos exitosamente\n\n Resumen:\n- Total de elementos: ${totalElements}\n- Modelos: ${Object.keys(models).length}\n\n Desglose por modelo:`;

      for (const [modelId, ids] of Object.entries(models as { [key: string]: number[] })) {
        summary += `\n- Modelo "${modelId}": ${ids.length} elementos`;
      }

      // Si se solicita exportar a CSV
      if (exportToCsv) {
        let csvContent = "ModelID,LocalID";
        
        // Si se deben incluir atributos, agregar columnas
        if (includeAttributes && filePath) {
          csvContent += ",Name,GlobalId,Category,ObjectType\n";
          
          // Cargar el modelo si es necesario
          if (!fragments) {
            const fileBuffer: Buffer = fs.readFileSync(filePath);
            fragments = new FRAGS.SingleThreadedFragmentsModel("mcp", new Uint8Array(fileBuffer));
          }

          // Generar filas con atributos
          for (const [modelId, ids] of Object.entries(models as { [key: string]: number[] })) {
            for (const localId of ids) {
              try {
                const itemsData = await fragments.getItemsData([localId], {
                  attributes: ["Name", "GlobalId", "ObjectType"],
                  attributesDefault: true
                });
                
                const itemData = itemsData[0];
                
                const name = ((itemData?.Name as any)?.value || "").replace(/,/g, ";");
                const globalId = (itemData?.GlobalId as any)?.value || "";
                const category = itemData?.type || "";
                const objectType = ((itemData?.ObjectType as any)?.value || "").replace(/,/g, ";");
                
                csvContent += `${modelId},${localId},"${name}",${globalId},${category},"${objectType}"\n`;
              } catch (error) {
                // Si falla obtener atributos de un elemento, solo incluir IDs
                csvContent += `${modelId},${localId},,,"Error al obtener atributos"\n`;
              }
            }
          }
        } else {
          // CSV simple solo con IDs
          csvContent += "\n";
          for (const [modelId, ids] of Object.entries(models as { [key: string]: number[] })) {
            for (const localId of ids) {
              csvContent += `${modelId},${localId}\n`;
            }
          }
        }

        // Obtener ruta absoluta para el archivo CSV usando la función helper
        const absolutePath = getExportPath(outputPath);
        
        // Guardar archivo CSV
        fs.writeFileSync(absolutePath, csvContent, 'utf-8');
        
        summary += `\n\n Archivo CSV generado exitosamente`;
        summary += `\n Ubicación: ${absolutePath}`;
        summary += `\n Columnas: ${includeAttributes ? "ModelID, LocalID, Name, GlobalId, Category, ObjectType" : "ModelID, LocalID"}`;
      }

      // Generar vista previa de los primeros elementos
      summary += `\n\n Vista previa (primeros 10 elementos):`;
      let count = 0;
      for (const [modelId, ids] of Object.entries(models as { [key: string]: number[] })) {
        for (const localId of ids) {
          if (count >= 10) break;
          summary += `\n  - Modelo: ${modelId}, ID: ${localId}`;
          count++;
        }
        if (count >= 10) break;
      }

      if (totalElements > 10) {
        summary += `\n  ... y ${totalElements - 10} elementos más`;
      }

      return {
        content: [
          {
            type: "text",
            text: summary,
          },
          {
            type: "text",
            text: `\n Datos completos en JSON:\n${JSON.stringify(models, null, 2)}`,
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error al obtener elementos seleccionados: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
      };
    }
  }
)

const transport = new StdioServerTransport();
await server.connect(transport);
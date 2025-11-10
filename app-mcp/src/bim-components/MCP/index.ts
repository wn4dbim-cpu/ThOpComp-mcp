import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";

export class MCP extends OBC.Component {
  static uuid = "939bb2bc-7d31-4a44-811d-68e4dd286c35" as const;
  enabled = true;

  constructor(components: OBC.Components) {
    super(components);
    components.add(MCP.uuid, this);
  }

  async highlight(ids: { [modelId: string]: number[] }) {
    const highlighter = this.components.get(OBF.Highlighter);
    highlighter.setup();

    const modelIdMap: { [modelId: string]: Set<number> } = Object.fromEntries(
      Object.entries(ids).map(([key, arr]) => [key, new Set(arr)]),
    );

    await highlighter.highlightByID("select", modelIdMap);
  }

  // Crea una nueva consulta en ItemsFinder
  createQuery(queryName: string, queryParams: any[]) {
    const finder = this.components.get(OBC.ItemsFinder);
    
    // Procesar los parámetros para convertir strings de regex a RegExp reales
    const processedParams = this.processQueryParams(queryParams);
    
    finder.create(queryName, processedParams);
    return {
      success: true,
      message: `Consulta '${queryName}' creada exitosamente`,
      queryName,
    };
  }

  // Procesa los parámetros de consulta para convertir strings de regex a RegExp
  private processQueryParams(params: any[]): any[] {
    return params.map((param) => {
      return this.processQueryObject(param);
    });
  }

  // Procesa recursivamente un objeto de consulta (para soportar relaciones anidadas)
  private processQueryObject(param: any): any {
    const processed: any = {};

    // Procesar categorías (convertir strings de regex a RegExp)
    if (param.categories) {
      processed.categories = param.categories.map((cat: string) => {
        if (typeof cat === "string" && cat.startsWith("/")) {
          // Es un string de regex, convertirlo
          const match = cat.match(/^\/(.+)\/([gimuy]*)$/);
          if (match) {
            return new RegExp(match[1], match[2]);
          }
        }
        return cat;
      });
    }

    // Procesar atributos
    if (param.attributes) {
      processed.attributes = {
        queries: param.attributes.queries.map((query: any) => {
          const processedQuery: any = {};
          if (query.name) {
            if (
              typeof query.name === "string" &&
              query.name.startsWith("/")
            ) {
              const match = query.name.match(/^\/(.+)\/([gimuy]*)$/);
              if (match) {
                processedQuery.name = new RegExp(match[1], match[2]);
              }
            } else {
              processedQuery.name = query.name;
            }
          }
          if (query.value !== undefined) {
            // Si el valor es un string de regex, convertirlo
            if (typeof query.value === "string" && query.value.startsWith("/")) {
              const match = query.value.match(/^\/(.+)\/([gimuy]*)$/);
              if (match) {
                processedQuery.value = new RegExp(match[1], match[2]);
              } else {
                processedQuery.value = query.value;
              }
            } else {
              processedQuery.value = query.value;
            }
          }
          return processedQuery;
        }),
      };
    }

    // Procesar relación (RECURSIVAMENTE para soportar relaciones anidadas)
    if (param.relation) {
      processed.relation = {
        name: param.relation.name,
        query: this.processQueryObject(param.relation.query), // ¡RECURSIÓN!
      };
    }

    return processed;
  }

  // Ejecuta una consulta y opcionalmente resalta los resultados
  async executeQuery(queryName: string, highlightResults = true) {
    const finder = this.components.get(OBC.ItemsFinder);
    const query = finder.list.get(queryName);

    if (!query) {
      throw new Error(`La consulta '${queryName}' no existe`);
    }

    const results = await query.test();

    let totalElements = 0;
    if (results) {
      for (const ids of Object.values(results)) {
        totalElements += ids.size;
      }
    }

    if (highlightResults && totalElements > 0) {
      const highlighter = this.components.get(OBF.Highlighter);
      await highlighter.highlightByID("select", results);
    }

    return {
      success: true,
      queryName,
      totalElements,
      results: this.convertModelIdMapToArray(results),
    };
  }

  // Lista todas las consultas disponibles
  listQueries() {
    const finder = this.components.get(OBC.ItemsFinder);
    const queries = Array.from(finder.list.keys());
    return {
      success: true,
      totalQueries: queries.length,
      queries,
    };
  }

  // Elimina una consulta
  deleteQuery(queryName: string) {
    const finder = this.components.get(OBC.ItemsFinder);
    const existed = finder.list.has(queryName);
    if (existed) {
      finder.list.delete(queryName);
    }
    return {
      success: existed,
      message: existed
        ? `Consulta '${queryName}' eliminada`
        : `La consulta '${queryName}' no existe`,
    };
  }

  // Exporta todas las consultas
  exportQueries() {
    const finder = this.components.get(OBC.ItemsFinder);
    const data = finder.export();
    return {
      success: true,
      data,
    };
  }

  // Importa consultas desde datos JSON
  importQueries(data: any) {
    const finder = this.components.get(OBC.ItemsFinder);
    finder.import(data);
    return {
      success: true,
      message: "Consultas importadas exitosamente",
    };
  }

  // Convierte ModelIdMap con Sets a arrays para serialización
  private convertModelIdMapToArray(
    modelIdMap: { [modelId: string]: Set<number> } | null,
  ): { [modelId: string]: number[] } {
    if (!modelIdMap) return {};
    const result: { [modelId: string]: number[] } = {};
    for (const [modelId, ids] of Object.entries(modelIdMap)) {
      result[modelId] = Array.from(ids);
    }
    return result;
  }

  // Obtiene los elementos seleccionados/resaltados actuales
  getSelectedElements() {
    const highlighter = this.components.get(OBF.Highlighter);
    
    // Obtener la selección actual del highlighter
    const selection = highlighter.selection.select;
    
    if (!selection || Object.keys(selection).length === 0) {
      return {
        success: true,
        totalElements: 0,
        models: {},
        message: "No hay elementos seleccionados actualmente",
      };
    }

    // Convertir Sets a arrays y contar elementos
    const models: { [modelId: string]: number[] } = {};
    let totalElements = 0;

    for (const [modelId, idsSet] of Object.entries(selection)) {
      const idsArray = Array.from(idsSet);
      models[modelId] = idsArray;
      totalElements += idsArray.length;
    }

    return {
      success: true,
      totalElements,
      models,
      message: `Se encontraron ${totalElements} elementos seleccionados`,
    };
  }

  // Obtiene información completa de elementos: atributos + Property Sets + propiedades
  async getElementsInfo(
    modelIdMap: { [modelId: string]: number[] },
    formatPsets = true
  ) {
    try {
      console.log(`📊 Iniciando extracción de información de elementos...`);
      console.log(`   - Modelos a procesar: ${Object.keys(modelIdMap).length}`);
      console.log(`   - Formato Property Sets: ${formatPsets ? 'estructurado' : 'raw'}`);
      
      const fragments = this.components.get(OBC.FragmentsManager);
      const elements: { [modelId: string]: any[] } = {};
      let totalElements = 0;

      for (const [modelId, localIds] of Object.entries(modelIdMap)) {
        if (!localIds || localIds.length === 0) continue;

        // Obtener el modelo
        const model = fragments.list.get(modelId);
        if (!model) {
          console.warn(`Modelo "${modelId}" no encontrado`);
          continue;
        }

        console.log(`🔍 Modelo "${modelId}": Procesando ${localIds.length} elementos...`);
        elements[modelId] = [];

        // Procesar cada elemento
        for (const localId of localIds) {
          try {
            // Obtener datos del elemento con relaciones para Property Sets
            const [data] = await model.getItemsData([localId], {
              attributesDefault: false, // ✅ CRÍTICO: Debe ser false para Property Sets
              attributes: ["Name", "GlobalId", "ObjectType", "NominalValue"], // Atributos específicos
              relations: {
                IsDefinedBy: { 
                  attributes: true, 
                  relations: true  // Para obtener HasProperties
                },
              },
            });

            if (!data) {
              console.warn(`No se pudo obtener datos para localId ${localId}`);
              continue;
            }

            // Extraer atributos básicos
            const elementInfo: any = {
              localId,
              name: this.extractValue(data.Name),
              globalId: this.extractValue(data.GlobalId),
              category: data.type || null,
              objectType: this.extractValue(data.ObjectType),
              propertySets: {},
            };

            // Procesar Property Sets si existen
            if (data.IsDefinedBy && Array.isArray(data.IsDefinedBy)) {
              if (formatPsets) {
                // Formato estructurado y legible
                elementInfo.propertySets = this.formatPropertySets(data.IsDefinedBy);
              } else {
                // Formato raw para análisis avanzado
                elementInfo.propertySetsRaw = data.IsDefinedBy;
              }
            }

            elements[modelId].push(elementInfo);
            totalElements++;
          } catch (error) {
            console.error(`Error procesando localId ${localId}:`, error);
          }
        }
        
        console.log(`   ✅ Modelo "${modelId}": ${elements[modelId].length} elementos procesados correctamente`);
      }

      if (totalElements === 0) {
        console.warn(`⚠️ No se pudo obtener información de ningún elemento`);
        return {
          success: false,
          totalElements: 0,
          elements: {},
          message: "No se pudo obtener información de ningún elemento",
        };
      }

      console.log(`✅ Extracción completa: ${totalElements} elementos con información detallada`);
      
      return {
        success: true,
        totalElements,
        elements,
        message: `Información obtenida de ${totalElements} elementos`,
      };
    } catch (error) {
      console.error("Error en getElementsInfo:", error);
      return {
        success: false,
        totalElements: 0,
        elements: {},
        message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

  // Helper: Extrae el valor de un atributo IFC
  private extractValue(attr: any): any {
    if (!attr) return null;
    if (typeof attr === "object" && "value" in attr) {
      return attr.value;
    }
    return attr;
  }

  // Helper: Formatea Property Sets a estructura legible
  private formatPropertySets(rawPsets: any[]): { [psetName: string]: { [propName: string]: any } } {
    const result: { [psetName: string]: { [propName: string]: any } } = {};

    for (const pset of rawPsets) {
      // Extraer nombre del Property Set
      const psetName = this.extractValue(pset.Name);
      if (!psetName) continue;

      // ✅ VALIDACIÓN CRÍTICA: Verificar HasProperties (patrón de details-table)
      if (!("HasProperties" in pset)) {
        console.log(`   ⚠️ PropertySet "${psetName}" sin HasProperties`);
        continue;
      }

      // Verificar si tiene propiedades
      const hasProperties = pset.HasProperties;
      if (!hasProperties || !Array.isArray(hasProperties)) {
        console.log(`   ⚠️ PropertySet "${psetName}" con HasProperties nulo`);
        continue;
      }

      const props: { [propName: string]: any } = {};

      // Procesar cada propiedad
      for (const prop of hasProperties) {
        const propName = this.extractValue(prop.Name);
        const propValue = this.extractValue(prop.NominalValue);

        if (propName && propValue !== undefined && propValue !== null) {
          props[propName] = propValue;
        }
      }

      // Solo agregar el Pset si tiene propiedades
      if (Object.keys(props).length > 0) {
        result[psetName] = props;
      }
    }

    return result;
  }

  // 📏 Obtiene mediciones completas (volumen, área, longitud) de elementos específicos
  async getElementsMeasurements(
    modelIdMap: { [modelId: string]: number[] },
    measurementTypes: string[] = ["all"],
    includeCustom: boolean = true,
    batchSize: number = 100
  ) {
    try {
      const startTime = performance.now();
      console.log(`📏 Iniciando extracción de mediciones de ${Object.keys(modelIdMap).length} modelo(s)`);
      console.log(`   - Tipos solicitados: ${measurementTypes.join(', ')}`);
      console.log(`   - Incluir custom: ${includeCustom}`);
      console.log(`   - Tamaño de lote: ${batchSize}`);
      
      const fragments = this.components.get(OBC.FragmentsManager);
      const measurements: { [modelId: string]: any[] } = {};
      let totalElements = 0;
      let elementsWithMeasurements = 0;
      let totalVolume = 0;
      let totalArea = 0;
      let totalLength = 0;

      // Definir mediciones IFC estándar
      const IFC_MEASUREMENTS: { [key: string]: string[] } = {
        volume: ["Volume", "GrossVolume", "NetVolume", "NominalVolume"],
        area: ["Area", "GrossArea", "NetArea", "GrossFloorArea", "NetFloorArea", "GrossSideArea", "NetSideArea"],
        length: ["Length", "Width", "Height", "Depth", "OverallHeight", "OverallWidth", "NominalLength", "Perimeter"]
      };

      for (const [modelId, localIds] of Object.entries(modelIdMap)) {
        if (!localIds || localIds.length === 0) continue;

        // Obtener el modelo
        const model = fragments.list.get(modelId);
        if (!model) {
          console.warn(`Modelo "${modelId}" no encontrado`);
          continue;
        }

        console.log(`🔍 Modelo "${modelId}": Procesando ${localIds.length} elementos...`);
        measurements[modelId] = [];

        // Procesar por lotes para eficiencia
        for (let i = 0; i < localIds.length; i += batchSize) {
          const batch = localIds.slice(i, i + batchSize);
          console.log(`   📦 Procesando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(localIds.length/batchSize)}: ${batch.length} elementos`);

          try {
            // Obtener datos del lote con Property Sets para mediciones
            const batchData = await model.getItemsData(batch, {
              attributesDefault: false,
              attributes: ["Name", "GlobalId", "ObjectType", "NominalValue"],
              relations: {
                IsDefinedBy: { 
                  attributes: true, 
                  relations: true
                },
              },
            });

            // Procesar cada elemento del lote
            for (let j = 0; j < batch.length; j++) {
              const localId = batch[j];
              const data = batchData[j];
              
              if (!data) {
                console.warn(`   ⚠️ No se pudo obtener datos para localId ${localId}`);
                continue;
              }

              // Información básica del elemento
              const elementInfo: any = {
                localId,
                name: this.extractValue(data.Name),
                globalId: this.extractValue(data.GlobalId),
                category: data.type || null,
                objectType: this.extractValue(data.ObjectType),
                measurements: {
                  volume: null,
                  area: null,
                  length: null,
                  custom: {}
                }
              };

              // Extraer mediciones de Property Sets
              if (data.IsDefinedBy && Array.isArray(data.IsDefinedBy)) {
                const extractedMeasurements = this.extractMeasurementsFromPsets(
                  data.IsDefinedBy, 
                  measurementTypes, 
                  includeCustom,
                  IFC_MEASUREMENTS
                );
                
                elementInfo.measurements = extractedMeasurements;

                // Acumular totales
                if (extractedMeasurements.volume?.value) {
                  totalVolume += parseFloat(extractedMeasurements.volume.value) || 0;
                }
                if (extractedMeasurements.area?.value) {
                  totalArea += parseFloat(extractedMeasurements.area.value) || 0;
                }
                if (extractedMeasurements.length?.value) {
                  totalLength += parseFloat(extractedMeasurements.length.value) || 0;
                }

                // Contar elementos con mediciones
                if (extractedMeasurements.volume || extractedMeasurements.area || 
                    extractedMeasurements.length || Object.keys(extractedMeasurements.custom).length > 0) {
                  elementsWithMeasurements++;
                }
              }

              measurements[modelId].push(elementInfo);
              totalElements++;
            }
          } catch (error) {
            console.error(`   ❌ Error procesando lote ${Math.floor(i/batchSize) + 1}:`, error);
            // Continuar con el siguiente lote
          }
        }
        
        console.log(`   ✅ Modelo "${modelId}": ${measurements[modelId].length} elementos procesados`);
      }

      const endTime = performance.now();
      const processingTime = `${((endTime - startTime) / 1000).toFixed(2)}s`;

      if (totalElements === 0) {
        console.warn(`⚠️ No se pudo obtener información de ningún elemento`);
        return {
          success: false,
          totalElements: 0,
          measurements: {},
          summary: {},
          processingTime,
          message: "No se pudo obtener información de ningún elemento",
        };
      }

      console.log(`✅ Extracción de mediciones completa: ${totalElements} elementos en ${processingTime}`);
      console.log(`   📊 Elementos con mediciones: ${elementsWithMeasurements}`);
      console.log(`   📏 Totales - Volumen: ${totalVolume.toFixed(2)}m³, Área: ${totalArea.toFixed(2)}m², Longitud: ${totalLength.toFixed(2)}m`);
      
      return {
        success: true,
        totalElements,
        measurements,
        summary: {
          elementsWithMeasurements,
          totalVolume: totalVolume.toFixed(2),
          totalArea: totalArea.toFixed(2),
          totalLength: totalLength.toFixed(2)
        },
        processingTime,
        message: `Mediciones extraídas de ${totalElements} elementos`,
      };
    } catch (error) {
      console.error("Error en getElementsMeasurements:", error);
      return {
        success: false,
        totalElements: 0,
        measurements: {},
        summary: {},
        processingTime: "0s",
        message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

  // Helper: Extrae mediciones de Property Sets
  private extractMeasurementsFromPsets(
    rawPsets: any[], 
    measurementTypes: string[], 
    includeCustom: boolean,
    IFC_MEASUREMENTS: { [key: string]: string[] }
  ): any {
    const result: any = {
      volume: null,
      area: null,
      length: null,
      custom: {}
    };

    for (const pset of rawPsets) {
      const psetName = this.extractValue(pset.Name);
      if (!psetName) continue;

      if (!("HasProperties" in pset) || !pset.HasProperties || !Array.isArray(pset.HasProperties)) {
        continue;
      }

      // Procesar cada propiedad
      for (const prop of pset.HasProperties) {
        const propName = this.extractValue(prop.Name);
        const propValue = this.extractValue(prop.NominalValue);

        if (!propName || propValue === undefined || propValue === null) continue;

        // Verificar si es una medición estándar
        let foundInStandard = false;
        
        for (const type of measurementTypes) {
          if (type === 'all') {
            // Verificar todos los tipos
            for (const [stdType, stdProps] of Object.entries(IFC_MEASUREMENTS)) {
              if (stdProps.includes(propName)) {
                if (!result[stdType]) {
                  result[stdType] = {
                    value: propValue,
                    unit: this.determineUnit(propName, stdType),
                    source: psetName,
                    property: propName
                  };
                }
                foundInStandard = true;
                break;
              }
            }
          } else if (IFC_MEASUREMENTS[type]?.includes(propName)) {
            if (!result[type]) {
              result[type] = {
                value: propValue,
                unit: this.determineUnit(propName, type),
                source: psetName,
                property: propName
              };
            }
            foundInStandard = true;
          }
        }

        // Si no es estándar y se incluyen custom, agregar a custom
        if (!foundInStandard && includeCustom && this.isNumericMeasurement(propName, propValue)) {
          result.custom[propName] = {
            value: propValue,
            unit: this.determineUnit(propName, 'custom'),
            source: psetName
          };
        }
      }
    }

    return result;
  }

  // Helper: Determina la unidad de medida
  private determineUnit(propName: string, type: string): string {
    const name = propName.toLowerCase();
    
    if (type === 'volume' || name.includes('volume')) return 'm³';
    if (type === 'area' || name.includes('area')) return 'm²';
    if (type === 'length' || name.includes('length') || name.includes('width') || 
        name.includes('height') || name.includes('depth') || name.includes('perimeter')) return 'm';
    if (name.includes('weight') || name.includes('mass')) return 'kg';
    
    return 'units';
  }

  // Helper: Detecta si una propiedad es una medición numérica
  private isNumericMeasurement(propName: string, propValue: any): boolean {
    const measurementKeywords = [
      'area', 'volume', 'length', 'width', 'height', 'depth',
      'perimeter', 'thickness', 'diameter', 'radius', 'weight',
      'mass', 'density', 'capacity', 'flow', 'size'
    ];
    
    return typeof propValue === 'number' && 
           measurementKeywords.some(keyword => 
             propName.toLowerCase().includes(keyword)
           );
  }

  // 🔍 Explora el modelo para descubrir dónde están las propiedades de medición por categoría
  async discoverMeasurementProperties(
    modelId: string = "mcp",
    categories?: string[],
    sampleSize: number = 3
  ) {
    try {
      const startTime = performance.now();
      console.log(`🔍 Iniciando exploración de propiedades de medición en modelo "${modelId}"`);
      console.log(`   - Categorías específicas: ${categories ? categories.join(', ') : 'Todas disponibles'}`);
      console.log(`   - Muestra por categoría: ${sampleSize}`);
      
      const fragments = this.components.get(OBC.FragmentsManager);
      const model = fragments.list.get(modelId);
      
      if (!model) {
        return {
          success: false,
          totalCategories: 0,
          categoryMap: {},
          measurementMap: {},
          processingTime: "0s",
          message: `Modelo "${modelId}" no encontrado`,
        };
      }

      // Definir propiedades de medición a buscar
      const MEASUREMENT_PROPERTIES: { [key: string]: string[] } = {
        volume: ["Volume", "GrossVolume", "NetVolume", "NominalVolume", "OuterSurfaceArea"],
        area: ["Area", "GrossArea", "NetArea", "GrossFloorArea", "NetFloorArea", "GrossSideArea", "NetSideArea", "CrossSectionArea"],
        length: ["Length", "Width", "Height", "Depth", "OverallHeight", "OverallWidth", "NominalLength", "Perimeter", "Thickness"]
      };

      // Obtener todas las categorías disponibles si no se especificaron
      const allItems = model.getItemsOfCategories([/.*/]); // Usar regex que coincida con todo
      const availableCategories = categories || Object.keys(allItems);
      
      console.log(`📋 Categorías a analizar: ${availableCategories.length}`);

      const categoryMap: { [category: string]: any } = {};
      const measurementMap: { [measurementType: string]: any } = {
        volume: {},
        area: {},
        length: {},
        custom: {}
      };

      let totalCategoriesProcessed = 0;

      for (const category of availableCategories) {
        try {
          console.log(`🔍 Analizando categoría: ${category}`);
          
          // Obtener elementos de esta categoría
          const categoryItems = model.getItemsOfCategories([new RegExp(category, 'i')]);
          const elementIds = Object.values(categoryItems).flat();
          
          if (elementIds.length === 0) {
            console.log(`   ⚠️ No se encontraron elementos para ${category}`);
            categoryMap[category] = {
              elementsAnalyzed: 0,
              propertySetCount: 0,
              measurementProperties: [],
              measurementPropertySets: {}
            };
            continue;
          }

          // Tomar muestra de elementos
          const sampleIds = elementIds.slice(0, Math.min(sampleSize, elementIds.length));
          console.log(`   📦 Analizando ${sampleIds.length} elementos de muestra de ${elementIds.length} disponibles`);

          const categoryInfo = {
            elementsAnalyzed: sampleIds.length,
            propertySetCount: 0,
            measurementProperties: [] as string[],
            measurementPropertySets: {} as any
          };

          // Analizar cada elemento de la muestra
          for (const localId of sampleIds) {
            try {
              const [data] = await model.getItemsData([localId], {
                attributesDefault: false,
                attributes: ["Name", "GlobalId", "ObjectType", "NominalValue"],
                relations: {
                  IsDefinedBy: { 
                    attributes: true, 
                    relations: true
                  },
                },
              });

              if (!data || !data.IsDefinedBy) continue;

              // Analizar Property Sets
              const isDefinedByArray = Array.isArray(data.IsDefinedBy) ? data.IsDefinedBy : [data.IsDefinedBy];
              for (const pset of isDefinedByArray) {
                // Verificar que el pset tiene las propiedades necesarias
                if (!pset || typeof pset !== 'object' || !('Name' in pset)) continue;
                
                const psetName = this.extractValue((pset as any).Name);
                if (!psetName || !('HasProperties' in pset) || !(pset as any).HasProperties) continue;

                categoryInfo.propertySetCount++;

                // Analizar propiedades dentro del Property Set
                const hasProperties = (pset as any).HasProperties;
                if (!Array.isArray(hasProperties)) continue;
                
                for (const prop of hasProperties) {
                  const propName = this.extractValue(prop.Name);
                  const propValue = this.extractValue(prop.NominalValue);

                  if (!propName) continue;

                  // Verificar si es una propiedad de medición
                  let measurementType = 'custom';
                  let isKnownMeasurement = false;

                  for (const [type, properties] of Object.entries(MEASUREMENT_PROPERTIES)) {
                    if (properties.includes(propName)) {
                      measurementType = type;
                      isKnownMeasurement = true;
                      break;
                    }
                  }

                  // Si no es conocida, verificar si parece ser una medición por el nombre
                  if (!isKnownMeasurement && this.isNumericMeasurement(propName, propValue)) {
                    measurementType = 'custom';
                    isKnownMeasurement = true;
                  }

                  if (isKnownMeasurement) {
                    // Inicializar estructuras si no existen
                    if (!categoryInfo.measurementPropertySets[psetName]) {
                      categoryInfo.measurementPropertySets[psetName] = {};
                    }

                    if (!measurementMap[measurementType][category]) {
                      measurementMap[measurementType][category] = {};
                    }

                    // Guardar información de la propiedad
                    const propertyInfo = {
                      measurementType,
                      sampleValue: propValue,
                      frequency: 1,
                      confidence: isKnownMeasurement && measurementType !== 'custom' ? 'high' : 'medium'
                    };

                    categoryInfo.measurementPropertySets[psetName][propName] = propertyInfo;
                    measurementMap[measurementType][category][propName] = {
                      propertySet: psetName,
                      ...propertyInfo
                    };

                    // Agregar a la lista de propiedades encontradas
                    if (!categoryInfo.measurementProperties.includes(propName)) {
                      categoryInfo.measurementProperties.push(propName);
                    }
                  }
                }
              }
            } catch (error) {
              console.warn(`   ⚠️ Error analizando elemento ${localId}:`, error);
            }
          }

          categoryMap[category] = categoryInfo;
          totalCategoriesProcessed++;
          
          console.log(`   ✅ ${category}: ${categoryInfo.measurementProperties.length} propiedades de medición encontradas`);

        } catch (error) {
          console.error(`❌ Error procesando categoría ${category}:`, error);
          categoryMap[category] = {
            elementsAnalyzed: 0,
            propertySetCount: 0,
            measurementProperties: [],
            measurementPropertySets: {},
            error: error instanceof Error ? error.message : 'Error desconocido'
          };
        }
      }

      const endTime = performance.now();
      const processingTime = `${((endTime - startTime) / 1000).toFixed(2)}s`;

      console.log(`✅ Exploración completada: ${totalCategoriesProcessed} categorías en ${processingTime}`);
      
      // Generar resumen
      let totalMeasurementProperties = 0;
      for (const categoryInfo of Object.values(categoryMap)) {
        const info = categoryInfo as any;
        totalMeasurementProperties += info.measurementProperties?.length || 0;
      }

      console.log(`📊 Resumen: ${totalMeasurementProperties} propiedades de medición encontradas en total`);
      
      return {
        success: true,
        totalCategories: totalCategoriesProcessed,
        categoryMap,
        measurementMap,
        processingTime,
        message: `Exploración completada: ${totalCategoriesProcessed} categorías, ${totalMeasurementProperties} propiedades de medición encontradas`,
      };
    } catch (error) {
      console.error("Error en discoverMeasurementProperties:", error);
      return {
        success: false,
        totalCategories: 0,
        categoryMap: {},
        measurementMap: {},
        processingTime: "0s",
        message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

}
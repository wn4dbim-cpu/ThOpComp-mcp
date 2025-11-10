import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import * as TEMPLATES from "./ui-templates";
import { appIcons, CONTENT_GRID_ID } from "./globals";
import { viewportSettingsTemplate } from "./ui-templates/buttons/viewport-settings";
import { MCP } from "./bim-components";

BUI.Manager.init();

// Components Setup

const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);

const world = worlds.create<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBF.PostproductionRenderer
>();

world.name = "Main";
world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = new THREE.Color(0x1a1d23);

const viewport = BUI.Component.create<BUI.Viewport>(() => {
  return BUI.html`<bim-viewport></bim-viewport>`;
});

world.renderer = new OBF.PostproductionRenderer(components, viewport);
world.camera = new OBC.OrthoPerspectiveCamera(components);
world.camera.threePersp.near = 0.01;
world.camera.threePersp.updateProjectionMatrix();
world.camera.controls.restThreshold = 0.05;

const worldGrid = components.get(OBC.Grids).create(world);
worldGrid.material.uniforms.uColor.value = new THREE.Color(0x494b50);
worldGrid.material.uniforms.uSize1.value = 2;
worldGrid.material.uniforms.uSize2.value = 8;

const resizeWorld = () => {
  world.renderer?.resize();
  world.camera.updateAspect();
};

viewport.addEventListener("resize", resizeWorld);

world.dynamicAnchor = false;

components.init();

components.get(OBC.Raycasters).get(world);

const { postproduction } = world.renderer;
postproduction.enabled = true;
postproduction.style = OBF.PostproductionAspect.COLOR_SHADOWS;

const { aoPass, edgesPass } = world.renderer.postproduction;

edgesPass.color = new THREE.Color(0x494b50);

const aoParameters = {
  radius: 0.25,
  distanceExponent: 1,
  thickness: 1,
  scale: 1,
  samples: 16,
  distanceFallOff: 1,
  screenSpaceRadius: true,
};

const pdParameters = {
  lumaPhi: 10,
  depthPhi: 2,
  normalPhi: 3,
  radius: 4,
  radiusExponent: 1,
  rings: 2,
  samples: 16,
};

aoPass.updateGtaoMaterial(aoParameters);
aoPass.updatePdMaterial(pdParameters);

const fragments = components.get(OBC.FragmentsManager);
fragments.init("/node_modules/@thatopen/fragments/dist/Worker/worker.mjs");

fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
  const isLod = "isLodMaterial" in material && material.isLodMaterial;
  if (isLod) {
    world.renderer!.postproduction.basePass.isolatedMaterials.push(material);
  }
});

world.camera.projection.onChanged.add(() => {
  for (const [_, model] of fragments.list) {
    model.useCamera(world.camera.three);
  }
});

world.camera.controls.addEventListener("rest", () => {
  fragments.core.update(true);
});

const ifcLoader = components.get(OBC.IfcLoader);
await ifcLoader.setup({
  autoSetWasm: false,
  wasm: { absolute: true, path: "https://unpkg.com/web-ifc@0.0.69/" },
});

const highlighter = components.get(OBF.Highlighter);
highlighter.setup({
  world,
  selectMaterialDefinition: {
    color: new THREE.Color("#bcf124"),
    renderedFaces: 1,
    opacity: 1,
    transparent: false,
  },
});

// Clipper Setup
const clipper = components.get(OBC.Clipper);
viewport.ondblclick = () => {
  if (clipper.enabled) clipper.create(world);
};

window.addEventListener("keydown", (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    clipper.delete(world);
  }
});

// Length Measurement Setup
const lengthMeasurer = components.get(OBF.LengthMeasurement);
lengthMeasurer.world = world;
lengthMeasurer.color = new THREE.Color("#6528d7");

lengthMeasurer.list.onItemAdded.add((line) => {
  const center = new THREE.Vector3();
  line.getCenter(center);
  const radius = line.distance() / 3;
  const sphere = new THREE.Sphere(center, radius);
  world.camera.controls.fitToSphere(sphere, true);
});

viewport.addEventListener("dblclick", () => lengthMeasurer.create());

window.addEventListener("keydown", (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    lengthMeasurer.delete();
  }
});

// Area Measurement Setup
const areaMeasurer = components.get(OBF.AreaMeasurement);
areaMeasurer.world = world;
areaMeasurer.color = new THREE.Color("#6528d7");

areaMeasurer.list.onItemAdded.add((area) => {
  if (!area.boundingBox) return;
  const sphere = new THREE.Sphere();
  area.boundingBox.getBoundingSphere(sphere);
  world.camera.controls.fitToSphere(sphere, true);
});

viewport.addEventListener("dblclick", () => {
  areaMeasurer.create();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Enter" || event.code === "NumpadEnter") {
    areaMeasurer.endCreation();
  }
});

// Define what happens when a fragments model has been loaded
fragments.list.onItemSet.add(async ({ value: model }) => {
  model.useCamera(world.camera.three);
  model.getClippingPlanesEvent = () => {
    return Array.from(world.renderer!.three.clippingPlanes) || [];
  };
  world.scene.three.add(model.object);
  await fragments.core.update(true);
});

const mcp = components.get(MCP);
const ws = new WebSocket("ws://localhost:3001");

ws.binaryType = "arraybuffer";

// Estado para rastrear si el próximo buffer es un archivo IFC
let pendingIfcLoad: { modelId: string; fileName: string; fileSize: string } | null = null;

ws.onmessage = async (event) => {
  if (event.data instanceof ArrayBuffer) {
    // Verificar si es un archivo IFC pendiente de carga
    if (pendingIfcLoad) {
      try {
        console.log(`🔄 Cargando archivo IFC: ${pendingIfcLoad.fileName} (${pendingIfcLoad.fileSize} MB)`);
        
        // Convertir ArrayBuffer a Uint8Array
        const uint8Array = new Uint8Array(event.data);
        
        // Extraer el nombre del modelo sin extensión
        const modelName = pendingIfcLoad.fileName.replace(".ifc", "").replace(".IFC", "");
        
        // Cargar el archivo IFC usando IfcLoader
        // Parámetros: (bytes, coordinar, nombre del modelo)
        await ifcLoader.load(uint8Array, true, modelName);
        
        console.log(`✅ Archivo IFC cargado exitosamente: ${pendingIfcLoad.fileName}`);
        console.log(`📊 ModelId: ${modelName}`);
        
        pendingIfcLoad = null;
      } catch (error) {
        console.error("❌ Error al cargar archivo IFC:", error);
        pendingIfcLoad = null;
      }
    } else {
      // Es un archivo .frags normal
      await fragments.core.load(event.data, { modelId: "mcp" });
    }
  } else {
    const { command, payload } = JSON.parse(event.data);

    if (command === "highlight") {
      const { modelIdMap } = payload;
      await mcp.highlight(modelIdMap);
    } else if (command === "loadIfc") {
      // Preparar para recibir el archivo IFC en el próximo mensaje
      const { modelId, fileName, fileSize } = payload;
      pendingIfcLoad = { modelId, fileName, fileSize };
      console.log(`📥 Preparando para recibir archivo IFC: ${fileName} (${fileSize} MB)`);
    } else if (command === "createQuery") {
      const { queryName, queryParams } = payload;
      const result = mcp.createQuery(queryName, queryParams);
      console.log("Query created:", result);
    } else if (command === "executeQuery") {
      const { queryName, highlightResults } = payload;
      const result = await mcp.executeQuery(queryName, highlightResults);
      console.log("Query executed:", result);
    } else if (command === "listQueries") {
      const result = mcp.listQueries();
      console.log("Queries list:", result);
    } else if (command === "deleteQuery") {
      const { queryName } = payload;
      const result = mcp.deleteQuery(queryName);
      console.log("Query deleted:", result);
    } else if (command === "exportQueries") {
      const result = mcp.exportQueries();
      console.log("Queries exported:", result);
    } else if (command === "importQueries") {
      const { data } = payload;
      const result = mcp.importQueries(data);
      console.log("Queries imported:", result);
    } else if (command === "getSelectedElements") {
      // Obtener elementos seleccionados y responder al servidor
      const result = mcp.getSelectedElements();
      ws.send(JSON.stringify({
        command: "selectedElementsResult",
        payload: result
      }));
    } else if (command === "getElementsInfo") {
      // Obtener información completa de elementos específicos
      const { modelIdMap, formatPsets } = payload;
      const result = await mcp.getElementsInfo(modelIdMap, formatPsets);
      ws.send(JSON.stringify({
        command: "elementsInfoResult",
        payload: result
      }));
    } else if (command === "getElementsMeasurements") {
      // Obtener mediciones completas de elementos específicos
      const { modelIdMap, measurementTypes, includeCustom, batchSize } = payload;
      const result = await mcp.getElementsMeasurements(modelIdMap, measurementTypes, includeCustom, batchSize);
      ws.send(JSON.stringify({
        command: "elementsMeasurementsResult",
        payload: result
      }));
    } else if (command === "discoverMeasurementProperties") {
      // Explorar propiedades de medición por categoría
      const { modelId, categories, sampleSize } = payload;
      const result = await mcp.discoverMeasurementProperties(modelId, categories, sampleSize);
      ws.send(JSON.stringify({
        command: "discoveryResult",
        payload: result
      }));
    }
  }
};

// Viewport Layouts
const [viewportSettings] = BUI.Component.create(viewportSettingsTemplate, {
  components,
  world,
});

viewport.append(viewportSettings);

const [viewportGrid] = BUI.Component.create(TEMPLATES.viewportGridTemplate, {
  components,
  world,
});

viewport.append(viewportGrid);

// Content Grid Setup
const viewportCardTemplate = () => BUI.html`
  <div class="dashboard-card" style="padding: 0px;">
    ${viewport}
  </div>
`;

const [contentGrid] = BUI.Component.create<
  BUI.Grid<TEMPLATES.ContentGridLayouts, TEMPLATES.ContentGridElements>,
  TEMPLATES.ContentGridState
>(TEMPLATES.contentGridTemplate, {
  components,
  id: CONTENT_GRID_ID,
  viewportTemplate: viewportCardTemplate,
});

const setInitialLayout = () => {
  if (window.location.hash) {
    const hash = window.location.hash.slice(
      1,
    ) as TEMPLATES.ContentGridLayouts[number];
    if (Object.keys(contentGrid.layouts).includes(hash)) {
      contentGrid.layout = hash;
    } else {
      contentGrid.layout = "Viewer";
      window.location.hash = "Viewer";
    }
  } else {
    window.location.hash = "Viewer";
    contentGrid.layout = "Viewer";
  }
};

setInitialLayout();

contentGrid.addEventListener("layoutchange", () => {
  window.location.hash = contentGrid.layout as string;
});

const contentGridIcons: Record<TEMPLATES.ContentGridLayouts[number], string> = {
  Viewer: appIcons.MODEL,
};

// App Grid Setup
type AppLayouts = ["App"];

type Sidebar = {
  name: "sidebar";
  state: TEMPLATES.GridSidebarState;
};

type ContentGrid = { name: "contentGrid"; state: TEMPLATES.ContentGridState };

type AppGridElements = [Sidebar, ContentGrid];

const app = document.getElementById("app") as BUI.Grid<
  AppLayouts,
  AppGridElements
>;

app.elements = {
  sidebar: {
    template: TEMPLATES.gridSidebarTemplate,
    initialState: {
      grid: contentGrid,
      compact: true,
      layoutIcons: contentGridIcons,
    },
  },
  contentGrid,
};

contentGrid.addEventListener("layoutchange", () =>
  app.updateComponent.sidebar(),
);

app.layouts = {
  App: {
    template: `
      "sidebar contentGrid" 1fr
      /auto 1fr
    `,
  },
};

app.layout = "App";

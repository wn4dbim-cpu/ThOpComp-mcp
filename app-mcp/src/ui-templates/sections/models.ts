import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";

export interface ModelsPanelState {
  components: OBC.Components;
}

export const modelsPanelTemplate: BUI.StatefullComponent<ModelsPanelState> = (
  state,
) => {
  const { components } = state;

  const ifcLoader = components.get(OBC.IfcLoader);
  const fragments = components.get(OBC.FragmentsManager);

  const [modelsList] = CUI.tables.modelsList({
    components,
    actions: { download: false },
  });

  const onAddIfcModel = async ({ target }: { target: BUI.Button }) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.accept = ".ifc";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      target.loading = true;
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await ifcLoader.load(bytes, true, file.name.replace(".ifc", ""));
      target.loading = false;
      BUI.ContextMenu.removeMenus();
    });

    input.addEventListener("cancel", () => (target.loading = false));

    input.click();
  };

  const onAddFragmentsModel = async ({ target }: { target: BUI.Button }) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.accept = ".frag";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      target.loading = true;
      const buffer = await file.arrayBuffer();
      await fragments.core.load(buffer, {
        modelId: file.name.replace(".frag", ""),
      });
      target.loading = false;
      BUI.ContextMenu.removeMenus();
    });

    input.addEventListener("cancel", () => (target.loading = false));

    input.click();
  };

  const onExportAsFragments = async ({ target }: { target: BUI.Button }) => {
    const modelEntries = Array.from(fragments.list);
    if (modelEntries.length === 0) {
      alert("No hay modelos cargados para exportar");
      return;
    }

    target.loading = true;

    try {
      for (const [modelId, model] of modelEntries) {
        // Obtener el buffer del modelo
        const exportedBuffer = await model.getBuffer();
        const exportedBytes = new Uint8Array(exportedBuffer);
        
        // Crear un blob con los datos
        const blob = new Blob([exportedBytes], { type: "application/octet-stream" });
        
        // Crear un enlace de descarga
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${modelId}.frag`;
        
        // Disparar la descarga
        document.body.appendChild(link);
        link.click();
        
        // Limpiar
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error al exportar fragmentos:", error);
      alert("Error al exportar el modelo");
    } finally {
      target.loading = false;
      BUI.ContextMenu.removeMenus();
    }
  };

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    modelsList.queryString = input.value;
  };

  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.MODEL} label="Models">
      <div style="display: flex; gap: 0.5rem;">
        <bim-text-input @input=${onSearch} vertical placeholder="Search..." debounce="200"></bim-text-input>
        <bim-button style="flex: 0;" icon=${appIcons.ADD}>
          <bim-context-menu style="gap: 0.25rem;">
            <bim-button label="IFC" @click=${onAddIfcModel}></bim-button>
            <bim-button label="Fragments" @click=${onAddFragmentsModel}></bim-button>
          </bim-context-menu> 
        </bim-button>
        <bim-button 
          style="flex: 0;" 
          icon=${appIcons.EXPORT} 
          label="Exportar .frag"
          @click=${onExportAsFragments}
        ></bim-button>
      </div>
      ${modelsList}
    </bim-panel-section> 
  `;
};
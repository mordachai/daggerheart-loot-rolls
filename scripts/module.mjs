import { DaggerheartTableDialog } from "../applications/DaggerheartTableDialog.mjs";
import { DaggerheartFolderTablesDialog } from "../applications/DaggerheartFolderTablesDialog.mjs";

const MODULE_ID = "daggerheart-loot-rolls";

// Defaults (keep your existing ones)
const DEFAULT_LOOT_UUID = "Compendium.daggerheart-extra-content.loot-and-consumable-tables.RollTable.lRO8ZMi00IUNUXeU";
const DEFAULT_CONS_UUID = "Compendium.daggerheart-extra-content.loot-and-consumable-tables.RollTable.wr9bwWvnkuKLE77C";

// Discovery rule: only RollTable packs whose *label* ends with "_tables" (case-insensitive)
const GROUP_SUFFIX_RE = /_tables\s*$/i;

function isGroupablePackByLabel(pack) {
  const lbl = pack?.metadata?.label ?? pack?.title ?? "";
  return typeof lbl === "string" && GROUP_SUFFIX_RE.test(lbl.trim());
}

function deriveGroupLabelFromPack(pack) {
  const lbl = (pack?.metadata?.label ?? pack?.title ?? "").trim();
  return lbl.replace(GROUP_SUFFIX_RE, "").trim(); // what we show on the tool button
}


// ---- Settings ----
Hooks.once("init", () => {
  // Existing settings
  game.settings.register(MODULE_ID, "lootTableUuid", {
    name: "DH_TABLES.LootTableUUID",
    hint: "DH_TABLES.LootTableUUIDHint",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_LOOT_UUID
  });

  game.settings.register(MODULE_ID, "consumablesTableUuid", {
    name: "DH_TABLES.ConsumablesTableUUID",
    hint: "DH_TABLES.ConsumablesTableUUIDHint",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_CONS_UUID
  });

  // New: extra folder tables (packs or RollTable UUIDs)
  game.settings.register(MODULE_ID, "extraFolderTables", {
    name: "Extra Folder Tables",
    hint: "Comma/space separated list of packIds and/or RollTable UUIDs to include in Folder Tables.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    onChange: () => rebuildFolderIndex()
  });
});

// ---- Discovery Index ----
/** @type {Array<{id:string,label:string,source:'folder'|'extra',tables:Array<{name:string,uuid:string,img?:string}>}>} */
let FOLDER_GROUPS = [];

function getFolderChainNamesFromId(folderId) {
  const names = [];
  let f = folderId ? game.folders.get(folderId) : null; // look up the Folder object
  while (f) {
    names.push(f.name);
    f = f.parent ? game.folders.get(f.parent) : null;
  }
  return names.reverse(); // root -> leaf
}

function isInTargetTablesFolder(pack) {
  // Compendium packs have pack.folder as a folder ID
  const names = getFolderChainNamesFromId(pack.folder);
  if (names.length < 2) return false;
  const last = names[names.length - 1];
  const prev = names[names.length - 2];
  return last === "Tables" && prev === "Daggerheart Loot Rolls";
}

async function loadRollTablesFromPackId(packId) {
  const pack = game.packs.get(packId);
  if (!pack || pack.metadata.type !== "RollTable") return [];
  const docs = await pack.getDocuments();
  return docs.map(rt => ({
    name: rt.name,
    uuid: rt.uuid,
    img: rt.img || rt.thumbnail || "icons/svg/d20-black.svg"
  }));
}

async function rebuildFolderIndex() {
  const groups = [];

  // 1) Auto-discover packs by label suffix (ignore folders)
  for (const pack of game.packs) {
    try {
      if (pack.metadata.type !== "RollTable") continue;
      if (!isGroupablePackByLabel(pack)) continue;

      const tables = await loadRollTablesFromPackId(pack.collection);
      if (!tables.length) continue;

      groups.push({
        id: pack.collection,                          // e.g., "daggerheart-loot-rolls.motherboard-tables"
        label: deriveGroupLabelFromPack(pack),        // e.g., "Motherboard Loot"
        source: "folder",                              // keep the tag name; it's our "auto" source
        tables
      });
    } catch (e) {
      console.warn("Label-suffix discovery failed for pack", pack?.collection, e);
    }
  }

  // 2) Extras from settings: packs and/or RollTable UUIDs (unchanged)
  const extra = String(game.settings.get(MODULE_ID, "extraFolderTables") || "");
  const tokens = extra.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);

  /** @type {Map<string, {id:string,label:string,source:'extra',tables:Array<{name:string,uuid:string,img?:string}>}>} */
  const extraMap = new Map();

  for (const token of tokens) {
    try {
      if (token.startsWith("Compendium.")) {
        // Specific RollTable UUID
        const doc = await fromUuid(token);
        if (!doc || doc.documentName !== "RollTable") continue;
        const packId = doc.pack;
        const pack = game.packs.get(packId);
        const label = pack ? deriveGroupLabelFromPack(pack) || (pack.metadata?.label ?? "Extra Tables") : "Extra Tables";
        const entry = extraMap.get(packId) || { id: packId, label, source: "extra", tables: [] };
        entry.tables.push({ name: doc.name, uuid: doc.uuid, img: doc.img || "icons/svg/d20-black.svg" });
        extraMap.set(packId, entry);
      } else {
        // Treat as a packId
        const pack = game.packs.get(token);
        if (!pack || pack.metadata.type !== "RollTable") continue;
        const tables = await loadRollTablesFromPackId(token);
        if (!tables.length) continue;
        const label = deriveGroupLabelFromPack(pack) || pack.metadata?.label || "Extra Tables";
        extraMap.set(token, { id: token, label, source: "extra", tables });
      }
    } catch (e) {
      console.warn("Extra token failed to resolve:", token, e);
    }
  }

  for (const entry of extraMap.values()) groups.push(entry);

  FOLDER_GROUPS = groups;

  // Force toolbar to rebuild with new tools
  ui.controls?.render(true);
}

function addToolCompat(control, key, tool) {
  // tools pode ser objeto OU array. Inserir dos dois jeitos sem quebrar nada.
  if (Array.isArray(control.tools)) {
    // Evita duplicata pelo name
    if (!control.tools.some(t => t?.name === tool.name)) control.tools.push(tool);
  } else if (control.tools && typeof control.tools === "object") {
    control.tools[key] = tool;
  }
}

function getDaggerheartControl(controls) {
  if (Array.isArray(controls)) {
    let ctrl = controls.find(c => c?.name === "daggerheart");
    if (!ctrl) {
      ctrl = { name: "daggerheart", title: "Daggerheart tools", icon: "fas fa-dagger", tools: [] };
      controls.push(ctrl);
    } else if (ctrl.tools == null) {
      ctrl.tools = [];
    }
    return ctrl;
  }
  controls["daggerheart"] ??= { name: "daggerheart", title: "Daggerheart tools", icon: "fas fa-dagger", tools: {} };
  return controls["daggerheart"];
}

function discoverGroupsLabelsSync() {
  const groups = [];
  for (const pack of game.packs) {
    try {
      if (pack?.metadata?.type !== "RollTable") continue;
      if (!isGroupablePackByLabel(pack)) continue;
      groups.push({
        id: pack.collection,
        label: deriveGroupLabelFromPack(pack),
        source: "folder",
        tables: [] // carregamos on-demand ao abrir o diálogo
      });
    } catch (_) {}
  }
  return groups;
}






// Build index at ready
Hooks.once("ready", () => rebuildFolderIndex());

// ---- API ----
Hooks.once("ready", () => {
  const api = {
    /** Open loot/consumables (existing) */
    openLoot: () => new DaggerheartTableDialog("loot").render(true),
    openConsumables: () => new DaggerheartTableDialog("consumables").render(true),

    /** Folder tables API */
    listFolderPacks: () => FOLDER_GROUPS.map(g => ({ id: g.id, label: g.label, source: g.source, tables: g.tables })),
    openPack: (packId) => {
      const g = FOLDER_GROUPS.find(x => x.id === packId);
      if (!g) return ui.notifications?.warn?.("Folder pack not found.");
      return new DaggerheartFolderTablesDialog({ packId: g.id, label: g.label, tables: g.tables }).render(true);
    },
    rollFromPack: async (packId, tableName) => {
      const g = FOLDER_GROUPS.find(x => x.id === packId);
      const t = g?.tables?.find(tt => tt.name === tableName);
      if (!t) return console.warn("Table not found in group:", packId, tableName);
      // open a transient dialog instance to reuse chat rendering logic
      const dlg = new DaggerheartFolderTablesDialog({ packId: g.id, label: g.label, tables: g.tables });
      await dlg._rollSelectedTable(t);
    }
  };
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = api;

  api.refresh = async () => { await rebuildFolderIndex(); };

  openPack: async (packId) => {
  let g = FOLDER_GROUPS.find(x => x.id === packId);

  // Carrega tabelas se ainda não houver
  let tables = g?.tables?.length ? g.tables : await loadRollTablesFromPackId(packId);

  // Deriva label mesmo sem grupo cacheado
  const pack = game.packs.get(packId);
  const label = g?.label ?? (pack ? deriveGroupLabelFromPack(pack) : "Tables");

  const dlg = new DaggerheartFolderTablesDialog({ packId, label, tables });
  dlg.render(true);
}


});

// ---- Scene Controls: add to existing group ----
Hooks.on("getSceneControlButtons", (controls) => {
  // Ensure our base group exists (same as your current)
  controls["daggerheart"] ??= {
    name: "daggerheart",
    title: "Daggerheart tools",
    icon: "fas fa-dagger",
    tools: {}
  };

  // Keep your existing buttons
  controls["daggerheart"].tools["loot"] ??= {
    name: "loot",
    title: "Loot Tables",
    icon: "fas fa-treasure-chest",
    button: true,
    visible: true,
    onChange: () => game.modules.get(MODULE_ID)?.api?.openLoot()
  };

  controls["daggerheart"].tools["consumables"] ??= {
    name: "consumables",
    title: "Consumables",
    icon: "fas fa-flask",
    button: true,
    visible: true,
    onChange: () => game.modules.get(MODULE_ID)?.api?.openConsumables()
  };

  // Dynamically append a tool per discovered/extra group
  const dhCtrl = getDaggerheartControl(controls);

  // Usa cache se já existir, senão faz descoberta rápida
  const groups = FOLDER_GROUPS.length ? FOLDER_GROUPS : discoverGroupsLabelsSync();

  for (const g of groups) {
    const toolName = sanitizeToolName(g.id);
    addToolCompat(dhCtrl, toolName, {
      name: toolName,
      title: g.label,
      icon: "fas fa-list",
      button: true,
      visible: true,
      onChange: () => game.modules.get(MODULE_ID)?.api?.openPack(g.id)
    });
  }


  
});



function sanitizeToolName(id) {
  return String(id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

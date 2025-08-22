import { DaggerheartTableDialog } from "../applications/DaggerheartTableDialog.mjs";

const MODULE_ID = "daggerheart-loot-rolls";

// Defaults
const DEFAULT_LOOT_UUID = "Compendium.daggerheart-loot-rolls.daggerheart-loot-tables.RollTable.x88evqtghTai9cGu";
const DEFAULT_CONS_UUID = "Compendium.daggerheart-loot-rolls.daggerheart-loot-tables.RollTable.vbw7RWt7VuLztqws";

Hooks.once("init", () => {
  // World settings
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
});

// Expose a public API so UI buttons and macros share the same functions
Hooks.once("ready", () => {
  const api = {
    /** Open the dialog for a given table type ('loot' | 'consumables' | future types) */
    openDialog: (tableType) => new DaggerheartTableDialog(tableType).render(true),

    /** Convenience helpers */
    openLoot: () => new DaggerheartTableDialog("loot").render(true),
    openConsumables: () => new DaggerheartTableDialog("consumables").render(true),

    /** Direct roll without showing the dialog */
    roll: (tableType, formula) => {
      const dlg = new DaggerheartTableDialog(tableType);
      // Fire-and-forget so UI remains responsive
      Promise.resolve().then(() => dlg.rollTable(formula)).catch(console.error);
    }
  };

  // Attach API to the module for easy macro access
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = api;
});

// Scene Controls: Daggerheart Tools group
Hooks.on("getSceneControlButtons", (controls) => {
  controls["daggerheart"] = {
    name: "daggerheart",
    title: "Daggerheart tools",
    icon: "fas fa-dagger", // or: "modules/daggerheart-loot-rolls/ui/dh-icn.svg"
    tools: {}
  };

  // Simple re-entry guard to avoid double-fires
  let _dhToolBusy = false;
  const guard = async (fn) => {
    if (_dhToolBusy) return;
    _dhToolBusy = true;
    try { await fn(); }
    finally { setTimeout(() => (_dhToolBusy = false), 250); }
  };

  controls["daggerheart"].tools["loot"] = {
    name: "loot",
    title: "Loot Tables",
    icon: "fas fa-treasure-chest",
    button: true,
    visible: true,
    onChange: () => guard(() => game.modules.get(MODULE_ID)?.api?.openLoot())
  };

  controls["daggerheart"].tools["consumables"] = {
    name: "consumables",
    title: "Consumables",
    icon: "fas fa-flask",
    button: true,
    visible: true,
    onChange: () => guard(() => game.modules.get(MODULE_ID)?.api?.openConsumables())
  };
});

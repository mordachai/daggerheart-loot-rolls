import { DaggerheartTableDialog } from "../applications/DaggerheartTableDialog.mjs";

const MODULE_ID = "daggerheart-loot-rolls";

// Defaults from your guide
const DEFAULT_LOOT_UUID = "Compendium.daggerheart-extra-content.loot-and-consumable-tables.RollTable.lRO8ZMi00IUNUXeU";
const DEFAULT_CONS_UUID = "Compendium.daggerheart-extra-content.loot-and-consumable-tables.RollTable.wr9bwWvnkuKLE77C";

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

// Scene Controls: create our own group (v13 object-style) and use onChange (not onClick)
Hooks.on("getSceneControlButtons", (controls) => {
  controls["daggerheart"] = {
    name: "daggerheart",
    title: "Daggerheart tools",
    // Use your FA dagger or replace with custom SVG path:
    // icon: "modules/daggerheart-loot-rolls/ui/dh-icn.svg",
    icon: "fas fa-dagger",
    tools: {}
  };

  // simple re-entry guard to avoid double-fires
  let _dhToolBusy = false;

  controls["daggerheart"].tools["loot"] = {
    name: "loot",
    title: "Loot Tables",
    icon: "fas fa-treasure-chest",
    button: true,
    visible: true,
    onChange: async () => {
      if (_dhToolBusy) return;
      _dhToolBusy = true;
      try { await new DaggerheartTableDialog("loot").render(true); }
      finally { setTimeout(() => (_dhToolBusy = false), 250); }
    }
  };

  controls["daggerheart"].tools["consumables"] = {
    name: "consumables",
    title: "Consumables",
    icon: "fas fa-flask",
    button: true,
    visible: true,
    onChange: async () => {
      if (_dhToolBusy) return;
      _dhToolBusy = true;
      try { await new DaggerheartTableDialog("consumables").render(true); }
      finally { setTimeout(() => (_dhToolBusy = false), 250); }
    }
  };
});

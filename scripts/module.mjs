import { DaggerheartTableDialog } from "../applications/DaggerheartTableDialog.mjs";

const MODULE_ID = "daggerheart-loot-macros";
const DEFAULT_LOOT_UUID = "Compendium.daggerheart-extra-content.loot-and-consumable-tables.RollTable.lRO8ZMi00IUNUXeU";
const DEFAULT_CONS_UUID = "Compendium.daggerheart-extra-content.loot-and-consumable-tables.RollTable.wr9bwWvnkuKLE77C";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "lootTableUuid", {
    name: "DH_TABLES.LootTableUUID",
    hint: "DH_TABLES.LootTableUUIDHint",
    scope: "world", config: true, type: String, default: DEFAULT_LOOT_UUID
  });
  game.settings.register(MODULE_ID, "consumablesTableUuid", {
    name: "DH_TABLES.ConsumablesTableUUID",
    hint: "DH_TABLES.ConsumablesTableUUIDHint",
    scope: "world", config: true, type: String, default: DEFAULT_CONS_UUID
  });
});

/** v13: controls is an object. Create a new group and add tools as properties with onClick. */
Hooks.on("getSceneControlButtons", (controls) => {
  controls["daggerheart"] = {
    name: "daggerheart",
    title: "Daggerheart tools",
    icon: "fa-solid fa-dagger",
    tools: {}
  };

  controls["daggerheart"].tools["loot"] = {
    name: "loot",
    title: "Loot Tables",
    icon: "fas fa-treasure-chest",
    button: true,
    visible: true,
    onClick: () => new DaggerheartTableDialog("loot").render(true)
  };

  controls["daggerheart"].tools["consumables"] = {
    name: "consumables",
    title: "Consumables",
    icon: "fas fa-flask",
    button: true,
    visible: true,
    onClick: () => new DaggerheartTableDialog("consumables").render(true)
  };
});

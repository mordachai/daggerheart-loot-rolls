// NO imports of "foundry.js" or client-esm paths

const MODULE_ID = "daggerheart-loot-macros";

/** Rarity configuration */
export const RARITY_CONFIG = {
  common:    { name: "Common",    dice: ["1d12", "2d12"], color: "#8B8B8B" },
  uncommon:  { name: "Uncommon",  dice: ["2d12", "3d12"], color: "#1EFF00" },
  rare:      { name: "Rare",      dice: ["3d12", "4d12"], color: "#0070DD" },
  legendary: { name: "Legendary", dice: ["4d12", "5d12"], color: "#FF8000" }
};

/** i18n keys, localized at runtime */
export const RARITY_RULE_KEYS = {
  Common: "DH_TABLES.CommonTooltip",
  Uncommon: "DH_TABLES.UncommonTooltip",
  Rare: "DH_TABLES.RareTooltip",
  Legendary: "DH_TABLES.LegendaryTooltip"
};

/** Use the global class path in v13 */
export class DaggerheartTableDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /** @param {'loot'|'consumables'} type */
  constructor(type = "loot", options = {}) {
    super(options);
    this.tableType = type === "consumables" ? "consumables" : "loot";
    this.selectedRarity = "common";
  }

  static DEFAULT_OPTIONS = {
    id: "daggerheart-table-dialog",
    classes: ["daggerheart-dialog", "loot-dialog"],
    window: { title: "Daggerheart", contentTag: "form" },
    position: { width: 560, height: "auto" }
  };

  static PARTS = {
    form: {
      template: "modules/daggerheart-loot-macros/templates/daggerheart-table-dialog.hbs"
    }
  };

  _prepareContext() {
    const isLoot = this.tableType === "loot";
    const rarityRules = Object.fromEntries(
      Object.entries(RARITY_RULE_KEYS).map(([k, key]) => [k, game.i18n.localize(key)])
    );

    const rarityConfigEntries = Object.entries(RARITY_CONFIG).map(([key, v]) => ({
      key, ...v, isActive: key === this.selectedRarity
    }));

    return {
      isLoot,
      isConsumables: !isLoot,
      dialogTitle: game.i18n.localize(isLoot ? "DH_TABLES.LootTableRoller" : "DH_TABLES.ConsumablesTableRoller"),
      headerText:  game.i18n.localize(isLoot ? "DH_TABLES.SelectItemRarity" : "DH_TABLES.SelectConsumableRarity"),
      rarityConfig: rarityConfigEntries,
      rarityRules,
      selectedRarity: this.selectedRarity,
      dicePair: RARITY_CONFIG[this.selectedRarity].dice,
      rarityColor: RARITY_CONFIG[this.selectedRarity].color
    };
  }

  async _onRender() {
    const el = this.element;
    if (!el) return;

    el.querySelectorAll("[data-action='select-rarity']").forEach(btn => {
      btn.addEventListener("click", (ev) => {
        const rarity = ev.currentTarget.dataset.rarity;
        if (RARITY_CONFIG[rarity]) {
          this.selectedRarity = rarity;
          this.render(); // re-render to update dice & header color
        }
      });
    });

    el.querySelectorAll("[data-action='roll-dice']").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        const formula = ev.currentTarget.dataset.formula;
        await this.rollTable(formula);
        this.close();
      });
    });

    el.querySelector("[data-action='close']")?.addEventListener("click", () => this.close());
  }

  getTableUuid() {
    return this.tableType === "consumables"
      ? game.settings.get(MODULE_ID, "consumablesTableUuid")
      : game.settings.get(MODULE_ID, "lootTableUuid");
  }

  async rollTable(diceFormula) {
    const isLoot = this.tableType === "loot";
    const rollingKey = isLoot ? "DH_TABLES.RollingForLoot" : "DH_TABLES.RollingForConsumables";
    const errKey     = isLoot ? "DH_TABLES.ErrorRollingLoot" : "DH_TABLES.ErrorRollingConsumables";

    try {
      const uuid = this.getTableUuid();
      const table = await fromUuid(uuid);
      if (!table) {
        ui.notifications.error(game.i18n.format("DH_TABLES.TableNotFound", { uuid }));
        return;
      }

      const roll = new Roll(diceFormula);
      await roll.evaluate({ async: true });

      if (game.modules.get("dice-so-nice")?.active && game.dice3d?.showForRoll) {
        await game.dice3d.showForRoll(roll, game.user, true);
      } else {
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker(),
          flavor: game.i18n.format(rollingKey, { formula: diceFormula })
        });
      }

        // Get individual dice results
        const diceResults = roll.dice
        .map(die => die.results.map(r => r.result).join(", "))
        .join(" | ");

        // Localize the tooltip, inserting results
        const diceTooltip = game.i18n.format("DH_TABLES.DiceTooltip", {
        results: diceResults
        });

      const { total } = roll;
      const tableRoll = await (new Roll(`${total}`)).evaluate({ async: true });
      const draw = await table.draw({ displayChat: false, roll: tableRoll });
      const result = draw.results?.[0];
      if (!result) {
        ui.notifications.warn(game.i18n.format("DH_TABLES.NoResultFound", { total }));
        return;
      }

      let itemDoc = null;
      try {
        if (result.documentUuid)       itemDoc = await fromUuid(result.documentUuid);
        else if (result.getDocument)   itemDoc = await result.getDocument();
      } catch (e) { console.warn("Result document load failed:", e); }

      // v13 TableResult text fields changed; prefer description/name over old text. :contentReference[oaicite:3]{index=3}
      const nameFromResult =
        result.name ?? result.description ?? result.text ?? itemDoc?.name ?? "Unknown";

      const cleanName = String(nameFromResult).replace(/^_\d+_/, "");
      const { rarity, color } = this._determineRarityFromRoll(diceFormula, total);
      const typeIcon = isLoot ? `<i class="fas fa-treasure-chest"></i>` : `<i class="fas fa-flask"></i>`;

      const getDesc = (doc) =>
        doc?.system?.description?.value ?? doc?.system?.description ??
        doc?.data?.description?.value  ?? doc?.data?.description  ?? "No description available";

// Build context for chat card
const context = {
itemImg: itemDoc?.img || "icons/svg/item-bag.svg",
typeIcon,
itemName: foundry.utils.escapeHTML(cleanName),
rarity,
rarityColor: color,
rarityTooltip: game.i18n.localize(RARITY_RULE_KEYS[rarity]) || "",
diceFormula,
diceTotal: total,
iceTooltip: foundry.utils.escapeHTML(diceTooltip),
itemDescription: getDesc(itemDoc),
itemUuid: itemDoc?.uuid
};

// Render from Handlebars template
const html = await renderTemplate("modules/daggerheart-loot-macros/templates/dh-loot-chat.hbs", context);

// Send result to chat
await ChatMessage.create({
  content: html,
  speaker: ChatMessage.getSpeaker()
});


      await ChatMessage.create({ content: html, speaker: ChatMessage.getSpeaker() });
      ui.notifications.info(`${game.i18n.localize("DH_TABLES.Found")}: ${cleanName} (${rarity})`);
    } catch (err) {
      console.error(err);
      ui.notifications.error(game.i18n.localize(errKey));
    }
  }

  _determineRarityFromRoll(diceFormula, total) {
    let rarity = "Common", color = "#8B8B8B";
    const includes = n => diceFormula.includes(`${n}d12`);
    if (includes(5))           { rarity = "Legendary"; color = "#FF8000"; }
    else if (includes(4))      { rarity = total >= 40 ? "Legendary" : "Rare"; color = total >= 40 ? "#FF8000" : "#0070DD"; }
    else if (includes(3))      { rarity = total >= 30 ? "Rare" : "Uncommon"; color = total >= 30 ? "#0070DD" : "#1EFF00"; }
    else if (includes(2))      { rarity = total >= 20 ? "Uncommon" : "Common"; color = total >= 20 ? "#1EFF00" : "#8B8B8B"; }
    return { rarity, color };
  }
}

const MODULE_ID = "daggerheart-loot-rolls";

/** Rarity configuration (same as original) */
export const RARITY_CONFIG = {
  common:    { name: "Common",    dice: ["1d12", "2d12"], color: "#8B8B8B" },
  uncommon:  { name: "Uncommon",  dice: ["2d12", "3d12"], color: "#1EFF00" },
  rare:      { name: "Rare",      dice: ["3d12", "4d12"], color: "#0070DD" },
  legendary: { name: "Legendary", dice: ["4d12", "5d12"], color: "#FF8000" }
};

/** i18n keys (localized at runtime) */
export const RARITY_RULE_KEYS = {
  Common: "DH_TABLES.CommonTooltip",
  Uncommon: "DH_TABLES.UncommonTooltip",
  Rare: "DH_TABLES.RareTooltip",
  Legendary: "DH_TABLES.LegendaryTooltip"
};

/** ApplicationV2 + Handlebars mixin (v13) */
export class DaggerheartTableDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
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
      template: "modules/daggerheart-loot-rolls/templates/daggerheart-table-dialog.hbs"
    }
  };

  _prepareContext() {
    const rarityRules = Object.fromEntries(
      Object.entries(RARITY_RULE_KEYS).map(([k, key]) => [k, game.i18n.localize(key)])
    );
    const rarityConfigEntries = Object.entries(RARITY_CONFIG).map(([key, v]) => ({
      key, ...v, isActive: key === this.selectedRarity
    }));

    return {
      dialogTitle: game.i18n.localize(
        this.tableType === "loot"
          ? "DH_TABLES.LootTableRoller"
          : this.tableType === "consumables"
          ? "DH_TABLES.ConsumablesTableRoller"
          : "DH_TABLES.LootTableRoller" // fallback if you add more later
      ),
      headerText: game.i18n.localize(
        this.tableType === "loot"
          ? "DH_TABLES.SelectItemRarity"
          : this.tableType === "consumables"
          ? "DH_TABLES.SelectConsumableRarity"
          : "DH_TABLES.SelectItemRarity"
      ),
      rarityConfig: rarityConfigEntries,
      rarityRules,
      selectedRarity: this.selectedRarity,
      dicePair: RARITY_CONFIG[this.selectedRarity].dice,
      rarityColor: RARITY_CONFIG[this.selectedRarity].color,
      selectDiceText: "DH_TABLES.SelectDiceText",
      tableType: this.tableType
    };
  }

  async _onRender() {
    const el = this.element;
    if (!el) return;

    // Rarity buttons
    el.querySelectorAll("[data-action='select-rarity']").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        const rarity = ev.currentTarget.dataset.rarity;
        if (RARITY_CONFIG[rarity]) {
          this.selectedRarity = rarity;
          this.render(); // update dice & header color
        }
      });
    });

    // Dice buttons: close immediately, roll on next tick
    el.querySelectorAll("[data-action='roll-dice']").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        const formula = ev.currentTarget.dataset.formula;
        this.close(); // close right away

        // Defer the roll so the DOM can paint the close first
        setTimeout(() => {
          this.rollTable(formula).catch(console.error);
        }, 0);
      });
    });

    // Explicit close button (if present)
    const closeBtn = el.querySelector("[data-action='close']");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.close());
    }
  }

  getTableUuid() {
    return this.tableType === "consumables"
      ? game.settings.get(MODULE_ID, "consumablesTableUuid")
      : game.settings.get(MODULE_ID, "lootTableUuid");
  }

  /** Roll the configured table using a formula and output a styled chat card */
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

      // Evaluate the roll using the async-capable API (no deprecated options)
      const roll = new Roll(diceFormula);
      await roll.evaluate(); // supports async terms if any

      // Optional Dice So Nice animation; do NOT post the roll to chat (avoids duplicates)
      if (game.modules.get("dice-so-nice")?.active && game.dice3d?.showForRoll) {
        await game.dice3d.showForRoll(roll, game.user, true);
      }
      // If you want a basic chat roll too, uncomment:
      // else {
      //   await roll.toMessage({
      //     speaker: ChatMessage.getSpeaker(),
      //     flavor: game.i18n.format(rollingKey, { formula: diceFormula })
      //   });
      // }

      // Dice tooltip (localized)
      const diceResults = roll.dice.map(d => d.results.map(r => r.result).join(", ")).join(" | ");
      const diceTooltip = game.i18n.format("DH_TABLES.DiceTooltip", { results: diceResults });

      // Draw from table using a fixed-value roll that matches total
      const { total } = roll;
      const tableRoll = Roll.fromTotal ? Roll.fromTotal(total) : (new Roll(String(total))).evaluateSync();
      const draw = await table.draw({ displayChat: false, roll: tableRoll });
      const result = draw.results?.[0];

      if (!result) {
        ui.notifications.warn(game.i18n.format("DH_TABLES.NoResultFound", { total }));
        return;
      }

      // Resolve item document if present
      let itemDoc = null;
      try {
        if (result.documentUuid)       itemDoc = await fromUuid(result.documentUuid);
        else if (result.getDocument)   itemDoc = await result.getDocument();
      } catch (e) { console.warn("Result document load failed:", e); }

      // Prefer modern fields
      const nameFromResult =
        result.name ?? result.description ?? result.text ?? itemDoc?.name ?? "Unknown";
      const cleanName = String(nameFromResult).replace(/^_\d+_/, "");

      const { rarity, color } = this._determineRarityFromRoll(diceFormula, total);
      const typeIcon = isLoot ? `<i class="fas fa-treasure-chest"></i>` : `<i class="fas fa-flask"></i>`;

      const getDesc = (doc) =>
        doc?.system?.description?.value ?? doc?.system?.description ??
        doc?.data?.description?.value  ?? doc?.data?.description  ?? "No description available";

      // Chat card context
      const context = {
        itemImg: itemDoc?.img || "icons/svg/item-bag.svg",
        typeIcon,                                // raw HTML for icon
        itemName: foundry.utils.escapeHTML(cleanName),
        rarity,
        rarityColor: color,
        rarityTooltip: game.i18n.localize(RARITY_RULE_KEYS[rarity]) || "",
        diceFormula,
        diceTotal: total,
        diceTooltip: foundry.utils.escapeHTML(diceTooltip),
        itemDescription: getDesc(itemDoc),
        itemUuid: itemDoc?.uuid
      };

      // Render from Handlebars template (namespaced API)
      const html = await foundry.applications.handlebars.renderTemplate(
        "modules/daggerheart-loot-rolls/templates/dh-loot-chat.hbs",
        context
      );

      // Send result to chat
      await ChatMessage.create({
        content: html,
        speaker: ChatMessage.getSpeaker()
      });

      //ui.notifications.info(`${game.i18n.localize("DH_TABLES.Found")}: ${cleanName} (${rarity})`);
    } catch (err) {
      console.error(err);
      ui.notifications.error(game.i18n.localize(errKey));
    }
  }

  _determineRarityFromRoll(diceFormula, total) {
    let rarity = "Common", color = "#8B8B8B";
    const includes = n => diceFormula.includes(`${n}d12`);
    if (includes(5)) {
      rarity = "Legendary"; color = "#FF8000";
    } else if (includes(4)) {
      if (total >= 40) { rarity = "Legendary"; color = "#FF8000"; }
      else { rarity = "Rare"; color = "#0070DD"; }
    } else if (includes(3)) {
      if (total >= 30) { rarity = "Rare"; color = "#0070DD"; }
      else { rarity = "Uncommon"; color = "#1EFF00"; }
    } else if (includes(2)) {
      if (total >= 20) { rarity = "Uncommon"; color = "#1EFF00"; }
      else { rarity = "Common"; color = "#8B8B8B"; }
    }
    return { rarity, color };
  }
}

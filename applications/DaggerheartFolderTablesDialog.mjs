const MODULE_ID = "daggerheart-loot-rolls";

/**
 * Dialog for a single RollTable pack "group" (e.g., Motherboard),
 * listing its tables and providing a single "Loot Roll" button.
 * Reuses the same look&feel as your main dialog.
 */
export class DaggerheartFolderTablesDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  /**
   * @param {Object} opts
   * @param {string} opts.packId   e.g. "daggerheart-loot-rolls.motherboard-tables"
   * @param {string} opts.label    e.g. "Motherboard"
   * @param {Array<{name:string, uuid:string, img?:string}>} opts.tables
   */
  constructor({ packId, label, tables }, options = {}) {
    super(options);
    this.packId = packId;
    this.label = label;
    this.tables = Array.isArray(tables) ? tables : [];
    this.selectedName = this.tables[0]?.name ?? null;
  }

  static DEFAULT_OPTIONS = {
    id: "daggerheart-folder-tables-dialog",
    classes: ["daggerheart-table-dialog"],
    window: { title: "Daggerheart", contentTag: "form" },
    position: { width: 560, height: "auto" }
  };

  static PARTS = {
    form: { template: "modules/daggerheart-loot-rolls/templates/daggerheart-folder-dialog.hbs" }
  };

  _prepareContext() {
    const tableButtons = this.tables.map(t => ({
      name: t.name,
      uuid: t.uuid,
      img: t.img || "icons/svg/d20-black.svg",
      isActive: t.name === this.selectedName
    }));

    return {
      dialogTitle: this.label,
      selectTableText: "DH_TABLES.SelectTableText",   // add a key if you want localized text
      rollButtonText: "DH_TABLES.RollButtonText",     // add a key if you want localized text
      tableButtons,
      hasSelection: !!this.selectedName
    };
  }

  async _onRender() {
    const el = this.element;
    if (!el) return;

    // Click: select table
    el.querySelectorAll("[data-action='select-table']").forEach(btn => {
      btn.addEventListener("click", (ev) => {
        const name = ev.currentTarget.dataset.name;
        if (!name) return;
        this.selectedName = name;
        this.render(); // refresh active state
      });
    });

    // Click: roll
    const rollBtn = el.querySelector("[data-action='roll-selected']");
    if (rollBtn) {
      rollBtn.addEventListener("click", () => {
        const table = this.tables.find(t => t.name === this.selectedName);
        if (!table) return;
        this.close(); // close immediately
        // fire-and-forget the roll
        setTimeout(() => this._rollSelectedTable(table).catch(console.error), 0);
      });
    }

    // Update dialog background to selected table image
    this._updateDialogBg();
  }

  _updateDialogBg() {
    const el = this.element;
    if (!el) return;
    const tbl = this.tables.find(t => t.name === this.selectedName);
    const img = tbl?.img || "icons/svg/d20-black.svg";
    const bg = el.querySelector(".dialog-bg");
    if (bg) bg.style.backgroundImage = `url("${img}")`;
  }

  /** Draw from the selected table and post the chat card using your existing template */
  async _rollSelectedTable(tableInfo) {
    try {
      // Resolve the RollTable document from the provided UUID
      const table = await fromUuid(tableInfo.uuid);
      if (!table) return;

      // Try the table's own draw() first (some tables include an internal roll)
      let draw = null;
      let result = null;
      let drawRoll = null;

      try {
        draw = await table.draw({ displayChat: false });
        result = draw?.results?.[0] ?? null;
        drawRoll = draw?.roll ?? null;
      } catch (e) {
        console.warn("Table draw failed, falling back to manual roll:", e);
      }

      // If draw() produced a roll, animate it (Dice So Nice)
      if (drawRoll && game.modules.get("dice-so-nice")?.active && game.dice3d?.showForRoll) {
        try { await game.dice3d.showForRoll(drawRoll, game.user, true); } catch (e) { console.warn(e); }
      }

      // Fallback: if no roll or no result, roll manually and resolve by range
      if (!drawRoll || !result) {
        const formula = table.formula || table.data?.formula || "1d100";
        const manualRoll = new Roll(formula);
        await manualRoll.evaluate();

        if (game.modules.get("dice-so-nice")?.active && game.dice3d?.showForRoll) {
          try { await game.dice3d.showForRoll(manualRoll, game.user, true); } catch (e) { console.warn(e); }
        }

        let results = [];
        if (typeof table.getResultsForRoll === "function") {
          results = table.getResultsForRoll(manualRoll.total) ?? [];
        }
        if (!results?.length) {
          const all = table.results?.contents ?? [];
          results = all.filter(r => {
            const range = r.range ?? r.data?.range ?? [];
            const min = Array.isArray(range) ? range[0] : undefined;
            const max = Array.isArray(range) ? range[1] : undefined;
            return typeof min === "number" && typeof max === "number"
                && manualRoll.total >= min && manualRoll.total <= max;
          });
        }

        result = results?.[0] ?? null;
        drawRoll = manualRoll;
      }

      // --- Resolve the linked document, PREFERRING Items ---
      let itemDoc = null;

      // 1) Modern: documentUuid
      try {
        if (result?.documentUuid) {
          const doc = await fromUuid(result.documentUuid);
          if (doc?.documentName === "Item" || (typeof Item !== "undefined" && doc instanceof Item)) {
            itemDoc = doc;
          }
        }
      } catch (e) { console.warn("UUID resolution failed:", e); }

      // 2) Compat helper: result.getDocument()
      if (!itemDoc && result?.getDocument) {
        try {
          const doc = await result.getDocument();
          if (doc?.documentName === "Item" || (typeof Item !== "undefined" && doc instanceof Item)) {
            itemDoc = doc;
          }
        } catch (e) { console.warn("getDocument() resolution failed:", e); }
      }

      // 3) Legacy v10-style: documentCollection + resultId (or documentId)
      if (!itemDoc) {
        const coll = result?.documentCollection || result?.collection;
        const resId = result?.resultId || result?.documentId || result?._id;
        if (coll && resId) {
          try {
            const pack = game.packs.get(coll);
            const doc = pack ? await pack.getDocument(resId) : null;
            if (doc?.documentName === "Item" || (typeof Item !== "undefined" && doc instanceof Item)) {
              itemDoc = doc;
            }
          } catch (e) { console.warn("Legacy pack resolution failed:", e); }
        }
      }

      // Derive display fields
      const nameFromResult =
        result?.name ?? result?.description ?? result?.text ?? itemDoc?.name ?? "Unknown";
      const cleanName = String(nameFromResult).replace(/^_\d+_/, "");

      const diceFormula = drawRoll?.formula ?? "—";
      const diceTotal = (typeof drawRoll?.total === "number") ? drawRoll.total : "—";
      const diceResults = (drawRoll?.terms?.length && drawRoll?.dice?.length)
        ? drawRoll.dice.map(d => d.results.map(r => r.result).join(", ")).join(" | ")
        : "";
      const diceTooltip = diceResults
        ? foundry.utils.escapeHTML(
            game.i18n?.format?.("DH_TABLES.DiceTooltip", { results: diceResults }) ??
            `Results: [${diceResults}]`
          )
        : "";

      // Header icon (small): TABLE icon (correct and unchanged)
      const typeIconHTML = tableInfo.img
        ? `<img class="dhl-type-icon" src="${tableInfo.img}" alt="">`
        : `<i class="fas fa-list"></i>`;

      // Card image (big): ONLY the Item image (or neutral bag if no Item)
      const getDesc = (doc) =>
        doc?.system?.description?.value ?? doc?.system?.description ??
        doc?.data?.description?.value  ?? doc?.data?.description  ?? "";

      const itemImg = itemDoc?.img || "icons/svg/item-bag.svg";
      const itemDesc = itemDoc ? getDesc(itemDoc) : (result?.description || result?.text || "");

      const context = {
        itemImg,
        typeIcon: "",
        itemName: foundry.utils.escapeHTML(cleanName),
        rarity: tableInfo.name,        // chip shows the table name (Components, etc.)
        rarityColor: "#c0c0c0",
        rarityTooltip: "",
        diceFormula,
        diceTotal,
        diceTooltip,
        itemDescription: itemDesc,
        itemUuid: itemDoc?.uuid
      };

      const html = await foundry.applications.handlebars.renderTemplate(
        "modules/daggerheart-loot-rolls/templates/dh-loot-chat.hbs",
        context
      );

      await ChatMessage.create({
        content: html,
        speaker: ChatMessage.getSpeaker()
      });
    } catch (err) {
      console.error(err);
    }
  }

}

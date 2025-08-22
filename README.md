![Static Badge](https://img.shields.io/badge/Foundry_VTT-13-blue?style=for-the-badge) ![Github All Releases](https://img.shields.io/github/downloads/mordachai/daggerheart-loot-rolls/total.svg?style=for-the-badge) ![GitHub Release](https://img.shields.io/github/v/release/mordachai/daggerheart-loot-rolls?display_name=release&style=for-the-badge&label=Current%20version)

---

https://github.com/user-attachments/assets/16e335b6-e017-41eb-829b-55c496dd7d9b

---

# Daggerheart Loot Rolls

A simple module for Foundry VTT v13 that rolls results from **Loot** and **Consumables** tables for the Daggerheart system.

It adds a new group in the **Scene Controls** called **Daggerheart Tools**, with two buttons:

* Loot Tables
* Consumables Tables

<img width="619" height="455" alt="image" src="https://github.com/user-attachments/assets/501d3ff3-90ad-46c4-bbf2-1f99af50db1a" />

Each opens a dialog where you choose rarity (Common, Uncommon, Rare, Legendary), select dice, and get a chat result with item info and a drag-and-drop UUID.

---

## Recommended

Install [Daggerheart Extra Content](https://github.com/brunocalado/daggerheart-extra-content).
It provides ready-to-use Loot and Consumables tables. No import needed, only the module installed and active.

***If you want to play with other tables, in the module settings, you can paste any table UUID from any compendium, and it should work fine.***

---

## Installation

1. In Foundry VTT, go to **Add-on Modules** → **Install Module**
2. Paste this Manifest URL:

   ```
   https://github.com/mordachai/daggerheart-loot-rolls/raw/main/module.json
   ```
3. Install and enable under **Manage Modules**

---

## Usage

Open **Daggerheart Tools** in the scene controls, pick Loot or Consumables, choose rarity and dice, and roll.

<img width="1372" height="867" alt="image" src="https://github.com/user-attachments/assets/ae3500d8-3827-498d-95bb-5bbaa6ec9cd5" />

The item will appear in the chat after the roll, and you'll be able to drag and drop it directly into your inventory.

Hovering over the text and buttons will provide you with extra information.


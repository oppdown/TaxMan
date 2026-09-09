'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApplicationMenuTemplate } = require('../src/menu.cjs');

test('native application menu contains the former in-app menu contents once', () => {
  const actions = [];
  const menu = createApplicationMenuTemplate((action) => actions.push(action));
  assert.deepEqual(menu.map((item) => item.label), ['File', 'Edit', 'View', 'Help']);
  assert.deepEqual(menu[0].submenu.filter((item) => item.label).map((item) => item.label), ['Save', 'Save As…', 'Exit']);
  assert.deepEqual(menu[1].submenu.map((item) => item.label), ['Add income', 'Add expense']);
  assert.deepEqual(menu[2].submenu.map((item) => item.label), ['Dashboard', 'Transactions', 'Companies & Sources', 'Reports & Backup']);
  assert.deepEqual(menu[3].submenu.map((item) => item.label), ['About', 'Keyboard shortcuts']);
  menu[3].submenu[0].click();
  assert.deepEqual(actions, ['show-about']);
});

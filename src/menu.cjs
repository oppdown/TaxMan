'use strict';

function createApplicationMenuTemplate(dispatch) {
  const send = (action) => () => dispatch(action);
  return [
    {
      label: 'File',
      submenu: [
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: send('file-save') },
        { label: 'Save As…', click: send('file-save-as') },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Add income', click: send('show-add-income') },
        { label: 'Add expense', accelerator: 'CmdOrCtrl+N', click: send('show-add') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: send('view-dashboard') },
        { label: 'Transactions', accelerator: 'CmdOrCtrl+2', click: send('view-transactions') },
        { label: 'Companies & Sources', accelerator: 'CmdOrCtrl+3', click: send('view-companies') },
        { label: 'Reports & Backup', accelerator: 'CmdOrCtrl+4', click: send('view-reports') }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About', click: send('show-about') },
        { label: 'Keyboard shortcuts', click: send('show-shortcuts') }
      ]
    }
  ];
}

module.exports = { createApplicationMenuTemplate };

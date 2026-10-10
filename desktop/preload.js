// Bridge for the platform page: signs lecture requests so the server knows they come from this app.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('AcademicApp', {
  sign: msg => ipcRenderer.invoke('academic-sign', String(msg))
});

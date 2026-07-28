/**
 * SIO-K9 — BACKUP AUTOMÁTICO NO GOOGLE DRIVE
 * Google Apps Script
 *
 * FUNÇÕES:
 * 1) Recebe backups enviados pelo SIO-K9.
 * 2) Cria/localiza a pasta SIO-K9_BACKUPS no Google Drive.
 * 3) Mantém um arquivo principal: SIO-K9_BACKUP_ATUAL.json.
 * 4) Guarda cópias históricas com data e hora.
 * 5) Permite consultar e restaurar o backup mais recente.
 */

const CONFIG = Object.freeze({
  FOLDER_NAME: 'SIO-K9_BACKUPS',
  CURRENT_BACKUP_NAME: 'SIO-K9_BACKUP_ATUAL.json',
  API_TOKEN: 'TROQUE_ESTA_SENHA_POR_UMA_SENHA_FORTE',
  MAX_HISTORY_FILES: 100,
  MAX_PAYLOAD_BYTES: 40 * 1024 * 1024,
  MEDIA_FOLDER_NAME: 'SIO-K9_MIDIAS'
});

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    validateToken_(params.token);
    const action = String(params.action || 'status').toLowerCase();

    if (action === 'status') {
      return output_({
        ok: true,
        app: 'SIO-K9 Backup Drive',
        status: 'online',
        folder: CONFIG.FOLDER_NAME,
        timestamp: new Date().toISOString()
      }, params.callback);
    }

    if (action === 'latest') {
      const latest = readLatestBackup_();
      return output_({
        ok: true,
        found: latest !== null,
        backup: latest,
        timestamp: new Date().toISOString()
      }, params.callback);
    }

    if (action === 'media') {
      const media = listMedia_(params.bouId);
      return output_({
        ok: true,
        media: media,
        count: media.length,
        timestamp: new Date().toISOString()
      }, params.callback);
    }

    return output_({
      ok: false,
      error: 'Ação inválida.',
      allowedActions: ['status', 'latest', 'media']
    }, params.callback);
  } catch (error) {
    return output_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    }, e && e.parameter ? e.parameter.callback : '');
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    if (!e || !e.postData || typeof e.postData.contents !== 'string') {
      throw new Error('Nenhum conteúdo foi enviado.');
    }

    const rawBody = e.postData.contents;
    if (Utilities.newBlob(rawBody).getBytes().length > CONFIG.MAX_PAYLOAD_BYTES) {
      throw new Error('O backup excedeu o tamanho máximo permitido.');
    }

    const request = parseRequestBody_(e, rawBody);
    validateToken_(request.token);
    const action = String(request.action || 'backup').toLowerCase();

    if (action === 'uploadmedia') {
      const mediaResult = saveMedia_(request);
      return output_({
        ok: true,
        message: 'Mídia salva no Google Drive.',
        fileId: mediaResult.fileId,
        fileName: mediaResult.fileName,
        folderId: mediaResult.folderId,
        savedAt: mediaResult.savedAt
      });
    }

    const backup = normalizeBackup_(request);
    const result = saveBackup_(backup);

    return output_({
      ok: true,
      message: 'Backup salvo no Google Drive.',
      currentFileId: result.currentFileId,
      historyFileId: result.historyFileId,
      savedAt: result.savedAt,
      recordCount: result.recordCount
    });
  } catch (error) {
    return output_({
      ok: false,
      error: String(error && error.message ? error.message : error),
      timestamp: new Date().toISOString()
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function configurarSioK9() {
  validateConfiguration_();
  const folder = getOrCreateFolder_();
  const result = {
    ok: true,
    message: 'Configuração concluída.',
    folderName: folder.getName(),
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
    timestamp: new Date().toISOString()
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function testarBackupSioK9() {
  validateConfiguration_();
  const testBackup = {
    app: 'SIO-K9',
    version: 'TESTE',
    exportedAt: new Date().toISOString(),
    device: 'Google Apps Script',
    registros: [{
      id: 'teste-' + Date.now(),
      tipo: 'teste',
      data: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      descricao: 'Arquivo de teste do backup automático.'
    }]
  };
  const result = saveBackup_(testBackup);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function limparHistoricoAntigo() {
  const folder = getOrCreateFolder_();
  const historicalFiles = [];
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    if (name !== CONFIG.CURRENT_BACKUP_NAME && name.indexOf('SIO-K9_BACKUP_') === 0 && name.endsWith('.json')) {
      historicalFiles.push({ file: file, created: file.getDateCreated().getTime() });
    }
  }

  historicalFiles.sort(function(a, b) { return b.created - a.created; });
  const filesToTrash = historicalFiles.slice(CONFIG.MAX_HISTORY_FILES);
  filesToTrash.forEach(function(item) { item.file.setTrashed(true); });

  const result = {
    ok: true,
    kept: Math.min(historicalFiles.length, CONFIG.MAX_HISTORY_FILES),
    trashed: filesToTrash.length
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function validateConfiguration_() {
  if (!CONFIG.API_TOKEN || CONFIG.API_TOKEN === 'TROQUE_ESTA_SENHA_POR_UMA_SENHA_FORTE' || CONFIG.API_TOKEN.length < 16) {
    throw new Error('Altere CONFIG.API_TOKEN para uma senha forte com pelo menos 16 caracteres.');
  }
}

function validateToken_(receivedToken) {
  validateConfiguration_();
  const received = String(receivedToken || '');
  const expected = String(CONFIG.API_TOKEN);
  if (!safeEquals_(received, expected)) throw new Error('Token de acesso inválido.');
}

function safeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function parseRequestBody_(e, rawBody) {
  const contentType = String((e.postData && e.postData.type) || '').toLowerCase();

  if (contentType.indexOf('application/json') >= 0 || rawBody.trim().charAt(0) === '{') {
    try { return JSON.parse(rawBody); }
    catch (_) { throw new Error('O conteúdo JSON enviado é inválido.'); }
  }

  if (e.parameter && e.parameter.payload) {
    try {
      const parsed = JSON.parse(e.parameter.payload);
      if (!parsed.token && e.parameter.token) parsed.token = e.parameter.token;
      return parsed;
    } catch (_) {
      throw new Error('O campo payload não contém um JSON válido.');
    }
  }

  if (e.parameter) return Object.assign({}, e.parameter);
  throw new Error('Formato de envio não reconhecido.');
}

function normalizeBackup_(request) {
  let registros = request.registros;
  if (typeof registros === 'string') {
    try { registros = JSON.parse(registros); }
    catch (_) { throw new Error('O campo registros não contém um JSON válido.'); }
  }
  if (!Array.isArray(registros)) throw new Error('O backup precisa conter um campo registros em formato de lista.');

  return {
    app: 'SIO-K9',
    version: String(request.version || 'não informada'),
    exportedAt: String(request.exportedAt || new Date().toISOString()),
    receivedAt: new Date().toISOString(),
    device: String(request.device || 'não informado'),
    recordCount: registros.length,
    registros: registros
  };
}

function saveBackup_(backup) {
  const folder = getOrCreateFolder_();
  const jsonContent = JSON.stringify(backup, null, 2);
  const savedAt = new Date();
  const currentFiles = folder.getFilesByName(CONFIG.CURRENT_BACKUP_NAME);
  let currentFile;

  if (currentFiles.hasNext()) {
    currentFile = currentFiles.next();
    currentFile.setContent(jsonContent);
    while (currentFiles.hasNext()) currentFiles.next().setTrashed(true);
  } else {
    currentFile = folder.createFile(CONFIG.CURRENT_BACKUP_NAME, jsonContent, MimeType.PLAIN_TEXT);
  }

  currentFile.setDescription('Backup principal atualizado automaticamente pelo SIO-K9 em ' + formatDateTime_(savedAt));

  const historyName = 'SIO-K9_BACKUP_' + formatFileDate_(savedAt) + '.json';
  const historyFile = folder.createFile(historyName, jsonContent, MimeType.PLAIN_TEXT);
  historyFile.setDescription('Cópia histórica automática do SIO-K9.');

  trimHistory_(folder);

  return {
    currentFileId: currentFile.getId(),
    historyFileId: historyFile.getId(),
    savedAt: savedAt.toISOString(),
    recordCount: backup.registros.length
  };
}

function readLatestBackup_() {
  const folder = getOrCreateFolder_();
  const files = folder.getFilesByName(CONFIG.CURRENT_BACKUP_NAME);
  if (!files.hasNext()) return null;

  const file = files.next();
  const text = file.getBlob().getDataAsString('UTF-8');
  try { return JSON.parse(text); }
  catch (_) { throw new Error('O arquivo de backup atual está corrompido.'); }
}

function getOrCreateFolder_() {
  const folders = DriveApp.getFoldersByName(CONFIG.FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.getRootFolder().createFolder(CONFIG.FOLDER_NAME);
}

function trimHistory_(folder) {
  const historicalFiles = [];
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    if (name !== CONFIG.CURRENT_BACKUP_NAME && name.indexOf('SIO-K9_BACKUP_') === 0 && name.endsWith('.json')) {
      historicalFiles.push({ file: file, created: file.getDateCreated().getTime() });
    }
  }

  historicalFiles.sort(function(a, b) { return b.created - a.created; });
  historicalFiles.slice(CONFIG.MAX_HISTORY_FILES).forEach(function(item) { item.file.setTrashed(true); });
}

function formatFileDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
}

function formatDateTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
}


function getOrCreateMediaRoot_() {
  const folders = DriveApp.getFoldersByName(CONFIG.MEDIA_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(CONFIG.MEDIA_FOLDER_NAME);
}

function sanitizeFolderName_(value) {
  return String(value || 'SEM_NUMERO').trim().replace(/[\\/:*?"<>|#%{}~&]/g, '_').replace(/\s+/g, ' ').slice(0, 100) || 'SEM_NUMERO';
}

function getOrCreateBouMediaFolder_(bouId, bouNum) {
  const root = getOrCreateMediaRoot_();
  const folderName = 'BOU_' + sanitizeFolderName_(bouNum) + '__' + sanitizeFolderName_(bouId);
  const folders = root.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  const folder = root.createFolder(folderName);
  folder.setDescription('Mídias vinculadas ao BOU ' + String(bouNum || '') + ' | ID interno: ' + String(bouId || ''));
  return folder;
}

function saveMedia_(request) {
  const bouId = String(request.bouId || '').trim();
  const bouNum = String(request.bouNum || '').trim();
  const mediaType = String(request.mediaType || '').toLowerCase();
  const fileName = sanitizeFolderName_(request.fileName || ('midia_' + Date.now()));
  const mimeType = String(request.mimeType || 'application/octet-stream');
  const base64 = String(request.dataBase64 || '');
  if (!bouId) throw new Error('BOU não informado para a mídia.');
  if (mediaType !== 'foto' && mediaType !== 'video') throw new Error('Tipo de mídia inválido.');
  if (!base64) throw new Error('Arquivo de mídia vazio.');

  const bytes = Utilities.base64Decode(base64);
  if (bytes.length > 25 * 1024 * 1024) throw new Error('O arquivo excede o limite de 25 MB.');
  const folder = getOrCreateBouMediaFolder_(bouId, bouNum);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = folder.createFile(blob);
  const metadata = {
    app: 'SIO-K9',
    bouId: bouId,
    bouNum: bouNum,
    mediaId: String(request.mediaId || ''),
    mediaType: mediaType,
    descricao: String(request.descricao || ''),
    uploadedAt: new Date().toISOString()
  };
  file.setDescription('SIOK9_META:' + JSON.stringify(metadata));
  return {fileId:file.getId(),fileName:file.getName(),folderId:folder.getId(),savedAt:new Date().toISOString()};
}

function listMedia_(bouId) {
  const id = String(bouId || '').trim();
  if (!id) throw new Error('BOU não informado.');
  const root = getOrCreateMediaRoot_();
  const folders = root.getFolders();
  let target = null;
  while (folders.hasNext()) {
    const folder = folders.next();
    if (folder.getName().endsWith('__' + sanitizeFolderName_(id))) { target = folder; break; }
  }
  if (!target) return [];
  const result = [];
  const files = target.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    let meta = {};
    const description = String(file.getDescription() || '');
    if (description.indexOf('SIOK9_META:') === 0) {
      try { meta = JSON.parse(description.slice('SIOK9_META:'.length)); } catch (_) {}
    }
    const fileId = file.getId();
    result.push({
      id: fileId,
      name: file.getName(),
      mimeType: file.getMimeType(),
      mediaType: meta.mediaType || (file.getMimeType().indexOf('image/') === 0 ? 'foto' : 'video'),
      descricao: meta.descricao || '',
      createdAt: file.getDateCreated().toISOString(),
      viewUrl: 'https://drive.google.com/file/d/' + fileId + '/view',
      previewUrl: 'https://drive.google.com/file/d/' + fileId + '/preview',
      thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w600'
    });
  }
  result.sort(function(a,b){ return String(a.createdAt).localeCompare(String(b.createdAt)); });
  return result;
}

function output_(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    const safeCallback = sanitizeCallback_(callback);
    return ContentService.createTextOutput(safeCallback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function sanitizeCallback_(callback) {
  const value = String(callback || '');
  if (!/^[a-zA-Z_$][0-9a-zA-Z_$\.\[\]]*$/.test(value)) throw new Error('Nome de callback inválido.');
  return value;
}

/**
 * Recovery EHR + SAP Backend
 *
 * Required Script Properties:
 * - SPREADSHEET_ID
 * - DRIVE_FOLDER_ID
 *
 * Required Sheets:
 * - Clients
 * - Notes
 * - Plans
 * - Documents
 * - SapEvaluations
 *
 * DEPLOYMENT:
 * - Execute as: User accessing the web app
 * - Who has access: Anyone within Addiction Recovery Solutions, PLLC
 */

const ALLOWED_DOMAIN = 'addictionrecoverysolutions.org';

function requireAuth_() {
  const email = Session.getActiveUser().getEmail();

  if (!email) {
    throw new Error('Unauthorized: No signed-in Google Workspace user detected.');
  }

  const domain = (email.split('@')[1] || '').toLowerCase();
  if (domain !== ALLOWED_DOMAIN.toLowerCase()) {
    throw new Error('Access denied: Invalid domain.');
  }

  return email;
}

function doGet() {
  requireAuth_();
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Recovery EHR + Integrated SAP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function doPost(e) {
  try {
    requireAuth_();

    const body = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};

    const action = body.action || '';
    const payload = body.payload || {};
    let result = null;

    switch (action) {
      case 'ping':
        result = pingServer();
        break;
      case 'getAllData':
        result = getBootstrapData();
        break;
      case 'saveClient':
        result = saveClient(payload);
        break;
      case 'saveNote':
        result = saveNote(payload);
        break;
      case 'savePlan':
        result = savePlan(payload);
        break;
      case 'saveDocument':
        result = saveDocument(payload);
        break;
      case 'saveSapEvaluation':
        result = saveSapEvaluation(payload);
        break;
      case 'deleteClient':
        result = deleteClient(payload);
        break;
      case 'deleteNote':
        result = deleteNote(payload);
        break;
      case 'deletePlan':
        result = deletePlan(payload);
        break;
      case 'deleteDocument':
        result = deleteDocument(payload);
        break;
      case 'deleteSapEvaluation':
        result = deleteSapEvaluation(payload);
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, result: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        error: err && err.message ? err.message : String(err)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getBootstrapData() {
  const email = requireAuth_();
  validateHeaders_();

  return {
    ok: true,
    userEmail: email,
    data: getAllData_()
  };
}

function pingServer() {
  const email = requireAuth_();
  return {
    ok: true,
    message: 'Backend is running.',
    userEmail: email
  };
}

function saveClient(payload) {
  const userEmail = requireAuth_();
  validateHeaders_();
  return saveClientRecord_(payload || {}, userEmail);
}

function saveNote(payload) {
  const userEmail = requireAuth_();
  validateHeaders_();
  return saveNoteRecord_(payload || {}, userEmail);
}

function savePlan(payload) {
  const userEmail = requireAuth_();
  validateHeaders_();
  return savePlanRecord_(payload || {}, userEmail);
}

function saveDocument(payload) {
  const userEmail = requireAuth_();
  validateHeaders_();
  return saveDocumentRecord_(payload || {}, userEmail);
}

function saveSapEvaluation(payload) {
  const userEmail = requireAuth_();
  validateHeaders_();
  return saveSapEvaluationRecord_(payload || {}, userEmail);
}

function deleteClient(payload) {
  requireAuth_();
  validateHeaders_();
  return deleteClientRecord_(payload || {});
}

function deleteNote(payload) {
  requireAuth_();
  validateHeaders_();
  return deleteNoteRecord_(payload || {});
}

function deletePlan(payload) {
  requireAuth_();
  validateHeaders_();
  return deletePlanRecord_(payload || {});
}

function deleteDocument(payload) {
  requireAuth_();
  validateHeaders_();
  return deleteDocumentRecord_(payload || {});
}

function deleteSapEvaluation(payload) {
  requireAuth_();
  validateHeaders_();
  return deleteSapEvaluationRecord_(payload || {});
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty('SPREADSHEET_ID');
  const driveFolderId = props.getProperty('DRIVE_FOLDER_ID');

  if (!spreadsheetId) throw new Error('Missing SPREADSHEET_ID script property.');

  return {
    spreadsheetId: spreadsheetId,
    driveFolderId: driveFolderId || ''
  };
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(getConfig_().spreadsheetId);
}

function getSheet_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  return sheet;
}

function nowIso_() {
  return new Date().toISOString();
}

function makeId_(prefix) {
  return (prefix || 'id') + '-' + new Date().getTime() + '-' + Math.random().toString(36).slice(2, 10);
}

function normalizeValue_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function parseJsonIfPossible_(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (
    (trimmed.charAt(0) === '{' && trimmed.charAt(trimmed.length - 1) === '}') ||
    (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']')
  ) {
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      return value;
    }
  }

  return value;
}

function getRequiredHeaders_() {
  return {
    Clients: [
      'id',
      'createdAt',
      'updatedAt',
      'name',
      'mrn',
      'dob',
      'phone',
      'email',
      'admissionDate',
      'primarySubstance',
      'secondarySubstance',
      'diagnosis',
      'stageOfChange',
      'riskLevel',
      'status',
      'presentingProblem',
      'goals',
      'supports',
      'alerts',
      'clientSignature',
      'clientSignatureDate',
      'counselorSignature',
      'counselorSignatureDate',
      'savedBy'
    ],
    Notes: [
      'id',
      'createdAt',
      'updatedAt',
      'clientId',
      'date',
      'type',
      'data',
      'assessment',
      'plan',
      'signature',
      'signatureDate',
      'savedBy'
    ],
    Plans: [
      'id',
      'createdAt',
      'updatedAt',
      'clientId',
      'reviewDate',
      'problem',
      'goal',
      'objectives',
      'interventions',
      'clientSignature',
      'clientSignatureDate',
      'counselorSignature',
      'counselorSignatureDate',
      'savedBy'
    ],
    Documents: [
      'id',
      'createdAt',
      'updatedAt',
      'clientId',
      'type',
      'date',
      'title',
      'notes',
      'fileName',
      'mimeType',
      'fileId',
      'fileUrl',
      'savedBy'
    ],
    SapEvaluations: [
      'id',
      'createdAt',
      'updatedAt',
      'clientId',
      'status',
      'evalDate',
      'dotType',
      'sapName',
      'sapCredentials',
      'sapPhone',
      'sapEmail',
      'sapSignature',
      'sapSignatureDate',
      'derName',
      'derContact',
      'company',
      'companyAddress1',
      'companyAddress2',
      'employeeName',
      'employeeAddress1',
      'employeeAddress2',
      'ssnLast4',
      'dob',
      'phone',
      'email',
      'reasonForAssessment',
      'testType',
      'dateOfViolation',
      'violationText',
      'agency',
      'mastScore',
      'mastSeverity',
      'dastScore',
      'dastSeverity',
      'mastAnswers',
      'dastAnswers',
      'educationHours',
      'groupCount',
      'sessionCount',
      'recommendations',
      'customRecommendationText',
      'clinicalNotes',
      'reportHtml',
      'reportText',
      'savedBy'
    ]
  };
}

function ensureSheetHasHeaders_(sheetName, expectedHeaders) {
  const sheet = getSheet_(sheetName);
  const lastColumn = Math.max(sheet.getLastColumn(), expectedHeaders.length);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  const hasAnyHeader = currentHeaders.some(function(v) {
    return String(v || '').trim() !== '';
  });

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    sheet.setFrozenRows(1);
    return;
  }

  const currentTrimmed = currentHeaders.slice(0, expectedHeaders.length).map(function(v) {
    return String(v || '').trim();
  });

  const mismatch = expectedHeaders.some(function(h, i) {
    return currentTrimmed[i] !== h;
  });

  if (mismatch) {
    throw new Error('Header mismatch in sheet "' + sheetName + '". Update row 1 to the required headers.');
  }
}

function validateHeaders_() {
  const defs = getRequiredHeaders_();
  Object.keys(defs).forEach(function(sheetName) {
    ensureSheetHasHeaders_(sheetName, defs[sheetName]);
  });
}

function readSheetObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function(h) { return String(h || '').trim(); });

  return values.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(header, i) {
      obj[header] = parseJsonIfPossible_(row[i]);
    });
    return obj;
  });
}

function findRowById_(sheetName, id) {
  if (!id) return -1;
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function getRecordById_(sheetName, id) {
  const list = readSheetObjects_(sheetName);
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].id) === String(id)) return list[i];
  }
  return null;
}

function mapPayloadToRow_(headers, payload) {
  return headers.map(function(header) {
    if (header === 'id') return normalizeValue_(payload.id || '');
    if (header === 'createdAt') return normalizeValue_(payload.createdAt || '');
    if (header === 'updatedAt') return normalizeValue_(payload.updatedAt || '');
    return normalizeValue_(payload[header]);
  });
}

function upsertRecordByHeaders_(sheetName, payload, options) {
  options = options || {};
  const headers = getRequiredHeaders_()[sheetName];
  const sheet = getSheet_(sheetName);
  const now = nowIso_();
  const id = payload.id || makeId_(options.idPrefix || 'id');
  const rowNumber = findRowById_(sheetName, id);

  const finalPayload = Object.assign({}, payload, {
    id: id,
    updatedAt: now
  });

  if (rowNumber === -1) {
    finalPayload.createdAt = now;
  } else {
    const existing = getRecordById_(sheetName, id);
    finalPayload.createdAt = existing && existing.createdAt ? existing.createdAt : now;
  }

  const rowValues = mapPayloadToRow_(headers, finalPayload);

  if (rowNumber === -1) {
    sheet.appendRow(rowValues);
  } else {
    sheet.getRange(rowNumber, 1, 1, rowValues.length).setValues([rowValues]);
  }

  return { id: id, isNew: rowNumber === -1 };
}

function deleteRowsByMatch_(sheetName, columnIndexZeroBased, matchValue) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();

  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][columnIndexZeroBased]) === String(matchValue)) {
      sheet.deleteRow(i + 1);
    }
  }
}

function getAllData_() {
  validateHeaders_();
  return {
    clients: readSheetObjects_('Clients'),
    notes: readSheetObjects_('Notes'),
    plans: readSheetObjects_('Plans'),
    documents: readSheetObjects_('Documents'),
    sapEvaluations: readSheetObjects_('SapEvaluations')
  };
}

function saveClientRecord_(client, userEmail) {
  return upsertRecordByHeaders_('Clients', {
    id: client.id || '',
    name: client.name || '',
    mrn: client.mrn || '',
    dob: client.dob || '',
    phone: client.phone || '',
    email: client.email || '',
    admissionDate: client.admissionDate || '',
    primarySubstance: client.primarySubstance || '',
    secondarySubstance: client.secondarySubstance || '',
    diagnosis: client.diagnosis || '',
    stageOfChange: client.stageOfChange || '',
    riskLevel: client.riskLevel || '',
    status: client.status || '',
    presentingProblem: client.presentingProblem || '',
    goals: client.goals || '',
    supports: client.supports || '',
    alerts: client.alerts || '',
    clientSignature: client.clientSignature || '',
    clientSignatureDate: client.clientSignatureDate || '',
    counselorSignature: client.counselorSignature || '',
    counselorSignatureDate: client.counselorSignatureDate || '',
    savedBy: userEmail || ''
  }, { idPrefix: 'client' });
}

function saveNoteRecord_(note, userEmail) {
  if (!note.clientId) throw new Error('Missing clientId for note.');

  return upsertRecordByHeaders_('Notes', {
    id: note.id || '',
    clientId: note.clientId || '',
    date: note.date || '',
    type: note.type || '',
    data: note.data || '',
    assessment: note.assessment || '',
    plan: note.plan || '',
    signature: note.signature || '',
    signatureDate: note.signatureDate || '',
    savedBy: userEmail || ''
  }, { idPrefix: 'note' });
}

function savePlanRecord_(plan, userEmail) {
  if (!plan.clientId) throw new Error('Missing clientId for plan.');

  return upsertRecordByHeaders_('Plans', {
    id: plan.id || '',
    clientId: plan.clientId || '',
    reviewDate: plan.reviewDate || '',
    problem: plan.problem || '',
    goal: plan.goal || '',
    objectives: plan.objectives || '',
    interventions: plan.interventions || '',
    clientSignature: plan.clientSignature || '',
    clientSignatureDate: plan.clientSignatureDate || '',
    counselorSignature: plan.counselorSignature || '',
    counselorSignatureDate: plan.counselorSignatureDate || '',
    savedBy: userEmail || ''
  }, { idPrefix: 'plan' });
}

function saveDocumentRecord_(doc, userEmail) {
  const cfg = getConfig_();
  if (!cfg.driveFolderId) throw new Error('Missing DRIVE_FOLDER_ID script property.');
  if (!doc.base64) throw new Error('Missing document base64.');

  const folder = DriveApp.getFolderById(cfg.driveFolderId);
  const bytes = Utilities.base64Decode(doc.base64);
  const blob = Utilities.newBlob(
    bytes,
    doc.mimeType || 'application/octet-stream',
    doc.fileName || 'document'
  );

  const file = folder.createFile(blob);

  const result = upsertRecordByHeaders_('Documents', {
    id: doc.id || '',
    clientId: doc.clientId || '',
    type: doc.type || '',
    date: doc.date || '',
    title: doc.title || '',
    notes: doc.notes || '',
    fileName: doc.fileName || '',
    mimeType: doc.mimeType || '',
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    savedBy: userEmail || ''
  }, { idPrefix: 'doc' });

  return {
    id: result.id,
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    isNew: result.isNew
  };
}

function saveSapEvaluationRecord_(data, userEmail) {
  if (!data.clientId) throw new Error('Missing clientId for SAP evaluation.');

  return upsertRecordByHeaders_('SapEvaluations', {
    id: data.id || '',
    clientId: data.clientId || '',
    status: data.status || 'Completed',
    evalDate: data.evalDate || '',
    dotType: data.dotType || '',
    sapName: data.sapName || '',
    sapCredentials: data.sapCredentials || '',
    sapPhone: data.sapPhone || '',
    sapEmail: data.sapEmail || '',
    sapSignature: data.sapSignature || '',
    sapSignatureDate: data.sapSignatureDate || '',
    derName: data.derName || '',
    derContact: data.derContact || '',
    company: data.company || '',
    companyAddress1: data.companyAddress1 || '',
    companyAddress2: data.companyAddress2 || '',
    employeeName: data.employeeName || '',
    employeeAddress1: data.employeeAddress1 || '',
    employeeAddress2: data.employeeAddress2 || '',
    ssnLast4: data.ssnLast4 || '',
    dob: data.dob || '',
    phone: data.phone || '',
    email: data.email || '',
    reasonForAssessment: data.reasonForAssessment || '',
    testType: data.testType || '',
    dateOfViolation: data.dateOfViolation || '',
    violationText: data.violationText || '',
    agency: data.agency || '',
    mastScore: data.mastScore || '',
    mastSeverity: data.mastSeverity || '',
    dastScore: data.dastScore || '',
    dastSeverity: data.dastSeverity || '',
    mastAnswers: data.mastAnswers || {},
    dastAnswers: data.dastAnswers || {},
    educationHours: data.educationHours || '',
    groupCount: data.groupCount || '',
    sessionCount: data.sessionCount || '',
    recommendations: data.recommendations || {},
    customRecommendationText: data.customRecommendationText || '',
    clinicalNotes: data.clinicalNotes || '',
    reportHtml: data.reportHtml || '',
    reportText: data.reportText || '',
    savedBy: userEmail || ''
  }, { idPrefix: 'sap' });
}

function deleteClientRecord_(payload) {
  const clientId = payload && payload.id ? payload.id : '';
  if (!clientId) throw new Error('Missing client id.');

  const docs = readSheetObjects_('Documents').filter(function(d) {
    return String(d.clientId) === String(clientId);
  });

  docs.forEach(function(doc) {
    if (doc.fileId) {
      try { DriveApp.getFileById(doc.fileId).setTrashed(true); } catch (e) {}
    }
  });

  deleteRowsByMatch_('Clients', 0, clientId);
  deleteRowsByMatch_('Notes', 3, clientId);
  deleteRowsByMatch_('Plans', 3, clientId);
  deleteRowsByMatch_('Documents', 3, clientId);
  deleteRowsByMatch_('SapEvaluations', 3, clientId);

  return { deleted: true, id: clientId };
}

function deleteNoteRecord_(payload) {
  const id = payload && payload.id ? payload.id : '';
  if (!id) throw new Error('Missing note id.');
  const row = findRowById_('Notes', id);
  if (row === -1) throw new Error('Note not found.');
  getSheet_('Notes').deleteRow(row);
  return { deleted: true, id: id };
}

function deletePlanRecord_(payload) {
  const id = payload && payload.id ? payload.id : '';
  if (!id) throw new Error('Missing plan id.');
  const row = findRowById_('Plans', id);
  if (row === -1) throw new Error('Plan not found.');
  getSheet_('Plans').deleteRow(row);
  return { deleted: true, id: id };
}

function deleteDocumentRecord_(payload) {
  const id = payload && payload.id ? payload.id : '';
  if (!id) throw new Error('Missing document id.');

  const doc = getRecordById_('Documents', id);
  if (!doc) throw new Error('Document not found.');

  if (doc.fileId) {
    try { DriveApp.getFileById(doc.fileId).setTrashed(true); } catch (e) {}
  }

  const row = findRowById_('Documents', id);
  if (row === -1) throw new Error('Document row not found.');
  getSheet_('Documents').deleteRow(row);

  return { deleted: true, id: id };
}

function deleteSapEvaluationRecord_(payload) {
  const id = payload && payload.id ? payload.id : '';
  if (!id) throw new Error('Missing SAP evaluation id.');
  const row = findRowById_('SapEvaluations', id);
  if (row === -1) throw new Error('SAP evaluation not found.');
  getSheet_('SapEvaluations').deleteRow(row);
  return { deleted: true, id: id };
}

function setupSheets_() {
  const ss = getSpreadsheet_();
  const defs = getRequiredHeaders_();

  Object.keys(defs).forEach(function(sheetName) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    sheet.clearContents();
    sheet.getRange(1, 1, 1, defs[sheetName].length).setValues([defs[sheetName]]);
    sheet.setFrozenRows(1);
  });

  return { ok: true };
}

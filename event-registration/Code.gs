// מחברים את הקוד הזה לגיליון Google דרך Extensions > Apps Script,
// ואז Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).

const HEADERS = ["תאריך ושעה", "שם מלא", "חברה / ארגון", "תפקיד", "טלפון", "דוא\"ל"];

function doPost(e) {
  const p = (e && e.parameter) || {};

  // שדה פיתיון נגד בוטים: אם מולא, מתעלמים
  if (p.website) return ContentService.createTextOutput("ok");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setRightToLeft(true);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([
      Utilities.formatDate(new Date(), "Asia/Jerusalem", "dd/MM/yyyy HH:mm:ss"),
      p.name || "",
      p.company || "",
      p.role || "",
      "'" + (p.phone || ""), // גרש מקדים כדי שהאפס לא יימחק
      p.email || ""
    ]);
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput("ok");
}

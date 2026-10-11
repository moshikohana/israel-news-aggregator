// מחברים את הקוד הזה לגיליון Google דרך Extensions > Apps Script,
// ואז Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).

const HEADERS = ["מס'", "תאריך ושעה", "שם מלא", "חברה / ארגון", "תפקיד", "טלפון", "דוא\"ל", "הגיע"];
const WIDTHS  = [60, 150, 190, 220, 170, 130, 260, 80];
const PHONE_COL = 6;
const ARRIVED_COL = 8;
const NAVY = "#0b2a55";

function doPost(e) {
  const p = (e && e.parameter) || {};

  // שדה פיתיון נגד בוטים: אם מולא, מתעלמים
  if (p.website) return ContentService.createTextOutput("ok");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) setupSheet(sheet);

    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, ARRIVED_COL - 1).setValues([[
      "",
      Utilities.formatDate(new Date(), "Asia/Jerusalem", "dd/MM/yyyy HH:mm:ss"),
      p.name || "",
      p.company || "",
      p.role || "",
      "'" + (p.phone || ""), // גרש מקדים כדי שהאפס לא יימחק
      p.email || ""
    ]]);
    sheet.getRange(row, 1).setFormula("=ROW()-1");          // מספר רץ שנשאר תקין גם אחרי מיון או מחיקה
    sheet.getRange(row, ARRIVED_COL).insertCheckboxes();    // סימון הגעה בכניסה לכנס
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput("ok");
}

// עיצוב הטבלה. אפשר להריץ גם ידנית מהעורך (בחרו setupSheet ולחצו Run).
function setupSheet(sheet) {
  sheet = sheet || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const n = HEADERS.length;

  sheet.setRightToLeft(true);
  sheet.getRange(1, 1, 1, n).setValues([HEADERS])
    .setBackground(NAVY).setFontColor("#ffffff").setFontWeight("bold").setFontSize(11)
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);

  WIDTHS.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // שורות לסירוגין וגבולות עד שורה 1000
  const body = sheet.getRange(2, 1, 999, n);
  body.setVerticalAlignment("middle").setHorizontalAlignment("right");
  if (sheet.getBandings().length === 0) {
    body.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
  }
  sheet.getRange(2, 1, 999, 1).setHorizontalAlignment("center");
  sheet.getRange(2, ARRIVED_COL, 999, 1).setHorizontalAlignment("center");
  sheet.getRange(2, PHONE_COL, 999, 2).setHorizontalAlignment("left"); // טלפון ומייל מוצגים משמאל לימין
  sheet.getRange(1, 1, 1000, n).setBorder(true, true, true, true, true, true, "#d3e0ea", SpreadsheetApp.BorderStyle.SOLID);

  // מסנן, כדי שאפשר יהיה לסנן ולמיין לפי כל עמודה
  if (!sheet.getFilter()) sheet.getRange(1, 1, 1000, n).createFilter();
}

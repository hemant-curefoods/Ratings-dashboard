/**
 * Zomato Store Timing Automation - Instant Trigger Logic (Text Version)
 * 
 * Paste this code into Extensions > Apps Script.
 * Make sure your sheet tab is named "Visible_Sheet".
 * Columns: A:kitchen_id, B:swiggy, C:Zomato, D:Opening_time, E:Closing_time, F:Sync_Status, G:Reset
 */

// RUN THIS FUNCTION ONCE FROM THE EDITOR!
function setupTrigger() {
  var sheet = SpreadsheetApp.getActive();
  
  // First, delete any old triggers so we don't make duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  
  // Create the new trigger automatically
  ScriptApp.newTrigger("processCheckboxClick")
    .forSpreadsheet(sheet)
    .onEdit()
    .create();
    
  SpreadsheetApp.getActiveSpreadsheet().toast("System is fully ready! You can now go to your sheet and type reset.", "Success", 5);
}

function processCheckboxClick(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  
  if (sheet.getName() !== "Visible_Sheet") return;

  var row = e.range.getRow();
  var col = e.range.getColumn();

  // Column G is index 7 (Reset column)
  if (col === 7 && row > 1) {
    var val = e.range.getValue();
    
    // Check if the user typed or pasted "reset" (ignoring uppercase/lowercase)
    if (typeof val === "string" && val.toLowerCase().trim() === "reset") {
      // 1. Instantly clear the cell
      e.range.setValue("");
      
      // 2. Set the Sync_Status (Column F, index 6) to 'Pending'
      sheet.getRange(row, 6).setValue("Pending");
      
      // 3. Show a small popup message at the bottom of the screen
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "Signal sent to the cloud. The server is booting up and will process your changes in about 30 seconds!", 
        "Automation Triggered", 
        8
      );
      
      // 4. Instantly trigger GitHub Actions to wake up the server!
      triggerGitHubAction();
    }
  }
}

function triggerGitHubAction() {
  // PASTE YOUR GITHUB TOKEN BELOW inside the quotes
  var GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE"; 
  
  // The exact URL to trigger your specific repository's workflow
  var url = "https://api.github.com/repos/ajelhenry-office/zomato-store-timing/actions/workflows/sync.yml/dispatches";
  
  var options = {
    "method": "post",
    "headers": {
      "Authorization": "Bearer " + GITHUB_TOKEN,
      "Accept": "application/vnd.github.v3+json"
    },
    "payload": JSON.stringify({
      "ref": "main"
    }),
    "muteHttpExceptions": true
  };
  
  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    // If it fails, ignore so it doesn't break the spreadsheet UI
  }
}

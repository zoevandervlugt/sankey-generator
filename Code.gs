/**
 * @fileoverview A script to generate SankeyDiagrams for various sheets.
 * @author Zoe Van Der Vlugt
 * @date 5/14/25
 * @lastmodified 5/15/25
 *
 * @description The generateSankeyData() function makes or fills in a sheet with Sankey data
 * from the sheetName sheet. The functions at the top hardcode sheetNames, so that buttons on
 * Google Sheets can be assigned functions to run the program for the proper sheet.
 */

function generateJobsSankey() {
  generateSankeyData("Jobs");
}

function generateLabsSankey() {
  generateSankeyData("Labs");
}

function generateInternshipsSankey() {
  generateSankeyData("Internships");
}

function generateSankeyData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const currentSheet = sheet.getSheetByName(sheetName);
  const sankeySheetName = `${sheetName} Sankey Table`;
  let sankeySheet = sheet.getSheetByName(sankeySheetName) || sheet.insertSheet(sankeySheetName);

  // Only take data from necessary rows
  const headerRow = 5;
  const lastRow = currentSheet.getLastRow();
  const numRows = lastRow - headerRow;
  if (numRows <= 0) return;

  const dataRange = currentSheet.getRange(headerRow + 1, 1, numRows, currentSheet.getLastColumn());
  const data = dataRange.getValues();
  const headers = currentSheet.getRange(headerRow, 1, 1, currentSheet.getLastColumn()).getValues()[0];

  // Get indices of columns
  const statusIndex = headers.indexOf("Status");
  const platformIndex = headers.indexOf("Applied Through")
  const initialCallDateIndex = headers.indexOf("Initial Call Date");
  const screeningDateIndex = headers.indexOf("Screening Date");
  const technicalDateIndex = headers.indexOf("Technical Date");
  const behavioralDateIndex = headers.indexOf("Behavioral Date");

  let transitions = {};

  // Count status transitions
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const status = row[statusIndex];
    if(!status || status === "Interested") continue // Skip if status isn't set or only interested

    if (!row || row.length === 0) continue;    // Skip if row is empty
    let platform = row[platformIndex];
    if(!platform) platform = "Other";

    const hasCall = !!data[i][initialCallDateIndex];
    const hasScreening = !!data[i][screeningDateIndex];
    const hasTechnical = !!data[i][technicalDateIndex];
    const hasBehavioral = !!data[i][behavioralDateIndex];
    
    const stages = [];
    stages.push(platform); // Always from "Applied" to platform

    if (hasCall) stages.push("Initial Call");
    if (hasScreening) stages.push("Screening");
    if (hasTechnical) stages.push("Technical");
    if (hasBehavioral) stages.push("Behavioral");

    // Final status stages
    if (["Offered", "Accepted", "Declined"].includes(status))   stages.push("Offered");
    if (status === "Accepted")                                  stages.push("Accepted");
    if (status === "Declined")                                  stages.push("Declined");
    if (status === "Rejected")                                  stages.push("Rejected");
    if (status === "No Reply")                                  stages.push("No Reply");

    // Now record all transitions
    let prev = "Applied";
    for (let stage of stages) {
      const key = `${prev}->${stage}`;
      transitions[key] = (transitions[key] || 0) + 1;
      prev = stage;
    }
  }

  // Clear the Sankey Table tab and label the headers
  sankeySheet.clear();
  sankeySheet.getRange(1, 1, 1, 3).setValues([["From", "To", "Count"]]);

  // Set rows based on the transitions
  const rows = Object.entries(transitions).map(([key, count]) => {
    const [from, to] = key.split("->");
    return [from, to, count];
  });

  // Sort the rows alphabetically
  rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  
  // Write to the sheet
  if (rows.length > 0) {
    sankeySheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }
  
  // Trigger the next function
  makeSankeyDiagram(sheetName);
}

function makeSankeyDiagram(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const sankeySheet = sheet.getSheetByName(`${sheetName} Sankey Table`);
  const data = sankeySheet.getDataRange().getValues();

  if (data.length <= 1) {
    SpreadsheetApp.getUi().alert("No data available to display the Sankey diagram.");
    return;
  }

  const jsonData = [];
  for (let i = 1; i < data.length; i++) {
    const [from, to, count] = data[i];
    jsonData.push({ source: from, target: to, value: count });
  }

  const template = HtmlService.createTemplateFromFile("SankeyDiagram");
  template.sankeyData = JSON.stringify(jsonData);

  const html = template.evaluate().setWidth(900).setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, `${sheetName} Sankey Diagram`);
}
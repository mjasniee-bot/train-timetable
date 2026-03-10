const XLSX = require("xlsx");
const fs = require("fs");

// Load Excel file
const workbook = XLSX.readFile("Timetable_Master v1.xlsx");

// Read sheet
const timetable = XLSX.utils.sheet_to_json(
  workbook.Sheets["Timetable_Master v1"]
);

const locations = XLSX.utils.sheet_to_json(
  workbook.Sheets["Location"]
);

// Map location code to name
const locationMap = {};
locations.forEach(loc => {
  locationMap[loc.LCN_CODE] = loc.LCN_NAME;
});

// Format time
function formatTime(value) {
  if (!value) return null;
  const str = value.toString().padStart(4, "0");
  return str.slice(0, 2) + ":" + str.slice(2);
}

// Build JSON
const data = timetable.map(row => ({
  train_no: row.TMT_TNM_NUMBER,
  station_code: row.TMT_LCN_CODE,
  station_name: locationMap[row.TMT_LCN_CODE] || "Unknown",
  arrival: formatTime(row.TMT_ARRIVAL_TIME),
  departure: formatTime(row.TMT_DEPARTURE_TIME),
  valid_from: row.TMT_VALID_FROM,
  valid_to: row.TMT_VALID_TO
}));

// Save JSON
fs.writeFileSync("data.json", JSON.stringify(data, null, 2));

console.log("✅ data.json berjaya dibuat");
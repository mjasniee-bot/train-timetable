const XLSX = require("xlsx");
const fs = require("fs");

const workbook = XLSX.readFile("Timetable_Master v1.xlsx");

// read sheets
const timetable = XLSX.utils.sheet_to_json(
  workbook.Sheets["Timetable_Master v1"],
  { defval: null }
);

const trains = XLSX.utils.sheet_to_json(
  workbook.Sheets["Train_Master"],
  { defval: null }
);

const locations = XLSX.utils.sheet_to_json(
  workbook.Sheets["Location"],
  { defval: null }
);


// =========================
// BUILD LOOKUP TABLE
// =========================

// train lookup
const trainMap = {};

trains.forEach(t => {

trainMap[String(t.TNM_NUMBER).trim()] = {

train_service: t.Train_service || "N",
train_running: t.Train_Running || "R"

};

});

// location lookup
const locationMap = {};

locations.forEach(l => {

locationMap[String(l.LCN_CODE).trim()] = l.LCN_NAME;

});


// =========================
// FORMAT FUNCTIONS
// =========================

function formatTime(value){

if(value === null || value === "") return null;

const str = value.toString().padStart(4,"0");

return str.slice(0,2)+":"+str.slice(2);

}

function formatDate(value){

if(!value) return null;

const d = XLSX.SSF.parse_date_code(value);

return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;

}


// =========================
// MAIN LOOP
// =========================

const data = [];

timetable.forEach(row => {

const trainNo = String(row.TMT_TNM_NUMBER).trim();

const stationCode = String(row.TMT_LCN_CODE).trim();

const trainInfo = trainMap[trainNo] || {};

data.push({

train_no: trainNo,

station_code: stationCode,

station_name: locationMap[stationCode] || "Unknown",

arrival: formatTime(row.TMT_ARRIVAL_TIME),

departure: formatTime(row.TMT_DEPARTURE_TIME),

train_service: trainInfo.train_service || "N",

train_running: trainInfo.train_running || "R",

valid_from: formatDate(row.TMT_VALID_FROM),

valid_to: formatDate(row.TMT_VALID_TO)

});

});


// =========================
// EXPORT JSON
// =========================

fs.writeFileSync(
"data.json",
JSON.stringify(data, null, 2)
);

console.log("✅ JSON generated successfully");
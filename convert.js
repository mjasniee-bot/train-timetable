const XLSX = require("xlsx");
const fs = require("fs");

const workbook = XLSX.readFile("Timetable_Master v1.xlsx");

const timetable = XLSX.utils.sheet_to_json(
workbook.Sheets["Timetable_Master v1"],
{defval:null}
);

const trains = XLSX.utils.sheet_to_json(
workbook.Sheets["Train_Master"],
{defval:null}
);

const locations = XLSX.utils.sheet_to_json(
workbook.Sheets["Location"],
{defval:null}
);


// TRAIN MAP
const trainMap={}

trains.forEach(t=>{

trainMap[String(t.TNM_NUMBER).trim()]={

train_service:t.Train_service || "N",
train_running:t.Train_Running || "R"

}

})


// LOCATION MAP
const locationMap={}

locations.forEach(l=>{

locationMap[String(l.LCN_CODE).trim()]=l.LCN_NAME

})


// FORMAT TIME
function formatTime(v){

if(v===null || v==="") return null

const s=v.toString().padStart(4,"0")

return s.slice(0,2)+":"+s.slice(2)

}


// FORMAT DATE
function formatDate(v){

if(!v) return null

const d=XLSX.SSF.parse_date_code(v)

return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`

}


const data=[]

timetable.forEach(row=>{

const trainNo=String(row.TMT_TNM_NUMBER).trim()
const stationCode=String(row.TMT_LCN_CODE).trim()

const trainInfo=trainMap[trainNo] || {}

data.push({

train_no:trainNo,

tmt_seq_no:row.TMT_SEQ_NO,   // ⭐ IMPORTANT

station_code:stationCode,

station_name:locationMap[stationCode] || "Unknown",

arrival:formatTime(row.TMT_ARRIVAL_TIME),

departure:formatTime(row.TMT_DEPARTURE_TIME),

train_service:trainInfo.train_service || "N",

train_running:trainInfo.train_running || "R",

valid_from:formatDate(row.TMT_VALID_FROM),

valid_to:formatDate(row.TMT_VALID_TO)

})

})


fs.writeFileSync(
"data.json",
JSON.stringify(data,null,2)
)

console.log("✅ data.json generated with sequence")
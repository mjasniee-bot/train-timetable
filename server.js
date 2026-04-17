const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = 3000;

// =============================
// CONFIG
// =============================
const KTMB_UID = "NSSIT";
const KTMB_PASSWORD = "abc123";
const KTMB_BASE =
  "https://webapi.ktmb.com.my/SPOTMRT/Api/Train/GetAllTimetable";

// =============================
// HELPERS
// =============================
function pad(n) {
  return String(n).padStart(2, "0");
}

function normalizeTime(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") {
    const s = value.trim();

    // HH:mm[:ss]
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
      const [h, m] = s.split(":");
      return `${pad(h)}:${pad(m)}`;
    }

    // 4-digit HHmm
    if (/^\d{4}$/.test(s)) {
      return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
    }
  }

  return String(value);
}

function normalizeDateInput(dateStr) {
  // expect "17-Apr-2026" from user / existing API style
  return dateStr;
}

function pick(obj, keys, fallback = null) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
      return obj[k];
    }
  }
  return fallback;
}

function mapApiRow(row) {
  // Flexible mapping sebab response field name mungkin berbeza ikut endpoint sebenar
  const trainNo = String(
    pick(row, [
      "train_no",
      "TrainNo",
      "TRAIN_NO",
      "trainnum",
      "TrainNum",
      "TRAINNUM",
      "tnm_number",
      "TMT_TNM_NUMBER",
    ], "")
  );

  const stationCode = String(
    pick(row, [
      "station_code",
      "StationCode",
      "STATION_CODE",
      "lcn_code",
      "LCN_CODE",
      "TMT_LCN_CODE",
    ], "")
  );

  const stationName = String(
    pick(row, [
      "station_name",
      "StationName",
      "STATION_NAME",
      "lcn_name",
      "LCN_NAME",
      "LocationName",
    ], "Unknown")
  );

  const seqNo = Number(
    pick(row, [
      "tmt_seq_no",
      "TMT_SEQ_NO",
      "seq_no",
      "SeqNo",
      "SEQ_NO",
      "sequence",
    ], 0)
  );

  const arrival = normalizeTime(
    pick(row, [
      "arrival",
      "Arrival",
      "ARRIVAL",
      "arrival_time",
      "ArrivalTime",
      "TMT_ARRIVAL_TIME",
    ], null)
  );

  const departure = normalizeTime(
    pick(row, [
      "departure",
      "Departure",
      "DEPARTURE",
      "departure_time",
      "DepartureTime",
      "TMT_DEPARTURE_TIME",
    ], null)
  );

  const trainService = String(
    pick(row, [
      "train_service",
      "TrainService",
      "TRAIN_SERVICE",
      "service",
    ], "N")
  );

  const trainRunning = String(
    pick(row, [
      "train_running",
      "TrainRunning",
      "TRAIN_RUNNING",
      "running",
      "status",
    ], "R")
  );

  const validFrom = String(
    pick(row, [
      "valid_from",
      "ValidFrom",
      "VALID_FROM",
      "TMT_VALID_FROM",
    ], "")
  );

  const validTo = String(
    pick(row, [
      "valid_to",
      "ValidTo",
      "VALID_TO",
      "TMT_VALID_TO",
    ], "")
  );

  return {
    train_no: trainNo,
    tmt_seq_no: seqNo,
    station_code: stationCode,
    station_name: stationName || "Unknown",
    arrival,
    departure,
    train_service: trainService || "N",
    train_running: trainRunning || "R",
    valid_from: validFrom || null,
    valid_to: validTo || null,
  };
}

function getMinutes(time) {
  if (!time) return null;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m - cur;
}

// =============================
// API PROXY
// =============================

// Raw proxy
app.get("/api/ktmb/raw", async (req, res) => {
  try {
    const trainnum = req.query.trainnum || "";
    const TrainDate = normalizeDateInput(req.query.TrainDate);

    const response = await axios.get(KTMB_BASE, {
      params: { trainnum, TrainDate },
      auth: {
        username: KTMB_UID,
        password: KTMB_PASSWORD,
      },
      timeout: 20000,
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch KTMB API",
      details: error.response?.data || error.message,
    });
  }
});

// Normalized timetable by train/date
app.get("/api/timetable", async (req, res) => {
  try {
    const trainnum = req.query.trainnum || "";
    const TrainDate = normalizeDateInput(req.query.TrainDate);

    if (!TrainDate) {
      return res.status(400).json({ error: "TrainDate is required" });
    }

    const response = await axios.get(KTMB_BASE, {
      params: { trainnum, TrainDate },
      auth: {
        username: KTMB_UID,
        password: KTMB_PASSWORD,
      },
      timeout: 20000,
    });

    const payload = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.data)
      ? response.data.data
      : Array.isArray(response.data?.result)
      ? response.data.result
      : [];

    const rows = payload.map(mapApiRow).filter(r => r.train_no);

    rows.sort((a, b) => a.tmt_seq_no - b.tmt_seq_no);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch normalized timetable",
      details: error.response?.data || error.message,
    });
  }
});

// Station board from API results across selected train list
// User still needs known train list for the day
app.post("/api/station-board", async (req, res) => {
  try {
    const { station, TrainDate, trainList = [] } = req.body;

    if (!station || !TrainDate || !Array.isArray(trainList)) {
      return res.status(400).json({
        error: "station, TrainDate and trainList are required",
      });
    }

    const requests = trainList.map(trainnum =>
      axios.get(KTMB_BASE, {
        params: { trainnum, TrainDate },
        auth: { username: KTMB_UID, password: KTMB_PASSWORD },
        timeout: 20000,
      })
    );

    const responses = await Promise.allSettled(requests);

    let allRows = [];

    for (const r of responses) {
      if (r.status !== "fulfilled") continue;

      const responseData = r.value.data;
      const payload = Array.isArray(responseData)
        ? responseData
        : Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData?.result)
        ? responseData.result
        : [];

      allRows.push(...payload.map(mapApiRow));
    }

    const filtered = allRows
      .filter(r => r.station_name === station)
      .sort((a, b) => {
        const ta = a.departure || a.arrival || "99:99";
        const tb = b.departure || b.arrival || "99:99";
        return ta.localeCompare(tb);
      });

    res.json(filtered);
  } catch (error) {
    res.status(500).json({
      error: "Failed to build station board",
      details: error.response?.data || error.message,
    });
  }
});

// health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

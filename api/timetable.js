export default async function handler(req, res) {

  const { trainnum, TrainDate } = req.query;

  const url = `https://webapi.ktmb.com.my/SPOTMRT/Api/Train/GetAllTimetable?trainnum=${trainnum}&TrainDate=${TrainDate}`;

  try {

    const response = await fetch(url, {
      headers: {
        "Authorization": "Basic " + Buffer.from("NSSIT:abc123").toString("base64")
      }
    });

    const text = await response.text();

    // 🔥 HANDLE NON JSON
    try {
      const json = JSON.parse(text);
      res.status(200).json(json);
    } catch {
      res.status(500).json({
        error: "Invalid JSON",
        preview: text.substring(0,200)
      });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

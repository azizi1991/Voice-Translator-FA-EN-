const express = require("express");
const multer = require("multer");
const fetch = require("node-fetch");
const fs = require("fs");
const app = express();
const upload = multer({ dest: "uploads/" });

const SPEECHMATICS_API_KEY = "bX5rLkTJbzoID87lXxwSCbzcBud1Ttsd";

app.use(express.json());

// مرحله 1: ساخت Job
async function createJob() {
  const res = await fetch("https://asr.api.speechmatics.com/v2/jobs/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SPEECHMATICS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      config: {
        language: "fa",
      },
    }),
  });
  const data = await res.json();
  return data.id;
}

// مرحله 2: آپلود فایل
async function uploadAudio(jobId, filePath) {
  const url = `https://asr.api.speechmatics.com/v2/jobs/${jobId}/audio`;
  const fileStream = fs.createReadStream(filePath);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${SPEECHMATICS_API_KEY}`,
      "Content-Type": "audio/webm", // اگه فرمتت متفاوت است، تغییر بده
    },
    body: fileStream,
  });
  if (!res.ok) {
    throw new Error("Upload failed: " + res.statusText);
  }
  return true;
}

// مرحله 3: گرفتن متن
async function getTranscript(jobId) {
  const url = `https://asr.api.speechmatics.com/v2/jobs/${jobId}/transcript?format=txt`;
  // تلاش برای دریافت متن تا 20 بار با فاصله 3 ثانیه
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${SPEECHMATICS_API_KEY}` },
    });
    if (res.ok) {
      const text = await res.text();
      if (text.trim().length > 0) {
        return text;
      }
    }
  }
  throw new Error("Transcript not ready");
}

// روت آپلود صدا
app.post("/upload-audio", upload.single("audio"), async (req, res) => {
  try {
    const jobId = await createJob();
    await uploadAudio(jobId, req.file.path);
    const transcript = await getTranscript(jobId);
    // فایل temp رو حذف کن
    fs.unlinkSync(req.file.path);

    res.json({ transcript });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

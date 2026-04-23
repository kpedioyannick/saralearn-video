const path = require("path");
const fs = require("fs/promises");
const express = require("express");
const cors = require("cors");
const {bundle} = require("@remotion/bundler");
const {selectComposition, renderMedia} = require("@remotion/renderer");
const {synthesizeXtts} = require("./src/lib/tts-xtts");
const {getAudioDurationSeconds} = require("./src/lib/audio-duration");

const app = express();
app.use(cors());
app.use(express.json({limit: "2mb"}));

const PORT = process.env.PORT || 3457;
const HOST = process.env.HOST || `http://localhost:${PORT}`;
const OUT_DIR = path.join(process.cwd(), "public", "videos");
const AUDIO_DIR = path.join(process.cwd(), "public", "audio");
const REMOTION_ENTRY = path.join(process.cwd(), "remotion-entry.jsx");
const JOBS = new Map();

const SON_DIR = path.join(process.cwd(), "son");

app.use("/videos", express.static(OUT_DIR));
app.use("/audio", express.static(AUDIO_DIR));
app.use("/son", express.static(SON_DIR));

const nowIso = () => new Date().toISOString();

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toLowerCase();

const validatePayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "Le body JSON est obligatoire.";
  }
  if (!Array.isArray(payload.slides) || payload.slides.length === 0) {
    return "slides doit etre un tableau non vide.";
  }

  for (let i = 0; i < payload.slides.length; i += 1) {
    const slide = payload.slides[i];
    if (!slide || typeof slide !== "object") {
      return `slide ${i} invalide.`;
    }
    if (!slide.description || typeof slide.description !== "string") {
      return `slide ${i} doit contenir description (string).`;
    }
    if (!slide.subtitlesSrt || typeof slide.subtitlesSrt !== "string") {
      return `slide ${i} doit contenir subtitlesSrt (string).`;
    }
  }
  return null;
};

async function ensureOutputDir() {
  await fs.mkdir(OUT_DIR, {recursive: true});
  await fs.mkdir(AUDIO_DIR, {recursive: true});
}

const SKIP_TTS = process.env.SKIP_TTS === "true";

async function buildSlidesWithAudio(jobId, payload) {
  const language = payload.language || "fr";
  const speakerWavPath = process.env.XTTS_SPEAKER_WAV;

  const audioJobDir = path.join(AUDIO_DIR, jobId);
  await fs.mkdir(audioJobDir, {recursive: true});

  const slidesWithAudio = [];

  for (let i = 0; i < payload.slides.length; i += 1) {
    const slide = payload.slides[i];

    if (SKIP_TTS) {
      console.warn(`[SKIP_TTS] slide ${i + 1} : audio desactive`);
      slidesWithAudio.push({...slide});
      continue;
    }

    const fileName = `slide-${i + 1}.wav`;
    const outputAudioPath = path.join(audioJobDir, fileName);

    await synthesizeXtts({
      text: slide.description,
      outPath: outputAudioPath,
      language,
      speakerWavPath,
    });

    const audioDurationSec = await getAudioDurationSeconds(outputAudioPath);
    slidesWithAudio.push({
      ...slide,
      audioSrc: `${HOST}/audio/${jobId}/${fileName}`,
      audioDurationSec,
    });
  }

  return slidesWithAudio;
}

async function renderJob(jobId, payload) {
  const job = JOBS.get(jobId);
  if (!job) {
    return;
  }

  job.status = "rendering";
  job.updatedAt = nowIso();

  try {
    await ensureOutputDir();
    const slidesWithAudio = await buildSlidesWithAudio(jobId, payload);

    const mp3Files = (await fs.readdir(SON_DIR).catch(() => [])).filter((f) =>
      f.endsWith(".mp3") || f.endsWith(".wav"),
    );
    const randomMp3 = mp3Files.length
      ? mp3Files[Math.floor(Math.random() * mp3Files.length)]
      : null;
    const backgroundMusicSrc = randomMp3 ? `${HOST}/son/${randomMp3}` : null;

    const bundleLocation = await bundle({
      entryPoint: REMOTION_ENTRY,
      webpackOverride: (config) => config,
    });

    const VALID_FORMATS = ["landscape", "portrait", "square"];
    const format = VALID_FORMATS.includes(payload.format) ? payload.format : "landscape";

    const inputProps = {
      title: payload.title || "Video pedagogique",
      slides: slidesWithAudio,
      backgroundMusicSrc,
      wordByWord: payload.wordByWord === true,
      format,
    };

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "PedagogicalVideo",
      inputProps,
    });

    const fileName = `${jobId}.mp4`;
    const outputLocation = path.join(OUT_DIR, fileName);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation,
      inputProps,
    });

    job.status = "done";
    job.videoUrl = `${HOST}/videos/${fileName}`;
    job.updatedAt = nowIso();
  } catch (error) {
    job.status = "error";
    job.error = error instanceof Error ? error.message : String(error);
    job.updatedAt = nowIso();
  }
}

app.get("/health", (_req, res) => {
  res.json({ok: true, service: "saralearn-video-api"});
});

app.post("/api/videos", async (req, res) => {
  const payload = req.body;
  const validationError = validatePayload(payload);
  if (validationError) {
    return res.status(400).json({error: validationError});
  }

  const jobId = createId();
  const job = {
    id: jobId,
    status: "queued",
    videoUrl: null,
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  JOBS.set(jobId, job);

  renderJob(jobId, payload);

  return res.status(202).json({
    videoId: jobId,
    status: job.status,
    statusUrl: `${HOST}/api/videos/${jobId}`,
  });
});

app.get("/api/videos/:id", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) {
    return res.status(404).json({error: "Video non trouvee"});
  }
  return res.json(job);
});

app.listen(PORT, () => {
  console.log(`API lancee sur ${HOST}`);
});

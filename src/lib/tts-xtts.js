const path = require("path");
const fs = require("fs/promises");
const {spawn} = require("child_process");

const XTTS_MODEL = "tts_models/multilingual/multi-dataset/xtts_v2";

function runCommand(bin, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, {stdio: ["ignore", "pipe", "pipe"]});
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            `Commande TTS introuvable : "${bin}".\n` +
              `Installe Coqui TTS avec : pip install TTS\n` +
              `Ou pointe XTTS_BIN vers le bon executable.`,
          ),
        );
        return;
      }
      reject(err);
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `Commande ${bin} terminee avec code ${code}`));
    });
  });
}

async function synthesizeXtts({
  text,
  outPath,
  language = "fr",
  speakerWavPath,
  bin = process.env.XTTS_BIN || "tts",
}) {
  if (!speakerWavPath) {
    throw new Error(
      `Variable XTTS_SPEAKER_WAV manquante.\n` +
        `Fournis le chemin absolu vers un fichier .wav de reference (voix a cloner).\n` +
        `Exemple : export XTTS_SPEAKER_WAV=/chemin/vers/voice.wav`,
    );
  }

  try {
    await fs.access(speakerWavPath);
  } catch {
    throw new Error(
      `Fichier WAV introuvable : "${speakerWavPath}"\n` +
        `Verifie le chemin dans XTTS_SPEAKER_WAV.`,
    );
  }

  await fs.mkdir(path.dirname(outPath), {recursive: true});

  const args = [
    "--model_name",
    XTTS_MODEL,
    "--text",
    text,
    "--speaker_wav",
    speakerWavPath,
    "--language_idx",
    language,
    "--out_path",
    outPath,
  ];

  await runCommand(bin, args);
}

module.exports = {
  synthesizeXtts,
};

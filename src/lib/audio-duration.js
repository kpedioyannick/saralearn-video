const {parseFile} = require("music-metadata");

async function getAudioDurationSeconds(filePath) {
  const metadata = await parseFile(filePath);
  return Number(metadata.format.duration || 0);
}

module.exports = {
  getAudioDurationSeconds,
};

function parseSrtTimestamp(timestamp) {
  const [hh, mm, rest] = timestamp.split(":");
  const [ss, ms] = rest.split(",");
  return (
    Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms) / 1000
  );
}

function parseSrt(srtText) {
  if (!srtText || typeof srtText !== "string") {
    return [];
  }

  const blocks = srtText.trim().split(/\n\s*\n/);
  const entries = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      continue;
    }

    const timeLine = lines[1] && lines[1].includes("-->") ? lines[1] : lines[0];
    if (!timeLine.includes("-->")) {
      continue;
    }

    const [start, end] = timeLine.split("-->").map((value) => value.trim());
    const textStartIndex = lines[0] === timeLine ? 1 : 2;
    const text = lines.slice(textStartIndex).join(" ");

    entries.push({
      startSec: parseSrtTimestamp(start),
      endSec: parseSrtTimestamp(end),
      text,
    });
  }

  return entries;
}

function getSrtDuration(srtText) {
  const entries = parseSrt(srtText);
  if (!entries.length) {
    return 0;
  }
  return Math.max(...entries.map((entry) => entry.endSec));
}

module.exports = {
  parseSrt,
  getSrtDuration,
};

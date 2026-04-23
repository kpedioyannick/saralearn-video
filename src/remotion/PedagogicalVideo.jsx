import React, {useMemo} from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {parseSrt} from "../lib/srt";

const mdStyles = {
  p:          {margin: "0 0 12px 0", lineHeight: 1.5},
  strong:     {fontWeight: 800, color: "#ffffff"},
  em:         {fontStyle: "italic"},
  h1:         {fontSize: 48, fontWeight: 800, margin: "0 0 16px 0", color: "#ffffff"},
  h2:         {fontSize: 40, fontWeight: 700, margin: "0 0 14px 0", color: "#ffffff"},
  h3:         {fontSize: 34, fontWeight: 700, margin: "0 0 12px 0", color: "#ffffff"},
  code:       {backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 6, padding: "2px 8px", fontFamily: "monospace"},
  pre:        {backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 10, padding: 16, margin: "0 0 12px 0", overflowX: "auto"},
  blockquote: {borderLeft: "4px solid rgba(255,255,255,0.5)", paddingLeft: 16, margin: "0 0 12px 0", opacity: 0.85},
  ul:         {paddingLeft: 28, margin: "0 0 12px 0"},
  ol:         {paddingLeft: 28, margin: "0 0 12px 0"},
  li:         {marginBottom: 6},
  table:      {borderCollapse: "collapse", width: "100%", marginBottom: 12},
  th:         {border: "2px solid rgba(255,255,255,0.6)", padding: "8px 14px", backgroundColor: "rgba(0,0,0,0.25)", fontWeight: 700, textAlign: "left"},
  td:         {border: "1px solid rgba(255,255,255,0.4)", padding: "8px 14px"},
};

const mdComponents = Object.fromEntries(
  Object.entries(mdStyles).map(([tag, style]) => [
    tag,
    ({children, ...props}) => React.createElement(tag, {style, ...props}, children),
  ]),
);

const MarkdownContent = ({children, fontSize}) => (
  <div style={{fontSize: fontSize || 32, color: "#ffffff", lineHeight: 1.5}}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={mdComponents}
    >
      {String(children || "")}
    </ReactMarkdown>
  </div>
);

const safeSlides = (slides) => (Array.isArray(slides) ? slides : []);

const estimateReadingDuration = (description) => {
  const words = String(description || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(2, words / 2.6);
};

const buildTimeline = (slides, fps) => {
  let cursorFrame = 0;
  return safeSlides(slides).map((slide, index) => {
    const srtDurationSec = Math.max(
      0,
      ...parseSrt(slide.subtitlesSrt).map((entry) => entry.endSec),
    );
    const readDurationSec = estimateReadingDuration(slide.description);
    const audioDurationSec = Number(slide.audioDurationSec || 0);
    const durationSec = Math.max(srtDurationSec, readDurationSec, audioDurationSec, 2);
    const durationInFrames = Math.ceil(durationSec * fps);
    const item = {
      index,
      from: cursorFrame,
      durationInFrames,
      slide,
    };
    cursorFrame += durationInFrames;
    return item;
  });
};

const SubtitleLine = ({line}) => {
  return (
    <div
      style={{
        marginTop: 12,
        display: "inline-block",
        color: "#ffffff",
        fontSize: 44,
        fontWeight: 700,
        textAlign: "center",
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        padding: "12px 22px",
        borderRadius: 12,
        maxWidth: "90%",
      }}
    >
      {line}
    </div>
  );
};

const WordReveal = ({text, startFrame, staggerFrames, localFrame, style}) => {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  return (
    <span style={{display: "flex", flexWrap: "wrap", gap: "0.3em"}}>
      {words.map((word, i) => {
        const elapsed = localFrame - (startFrame + i * staggerFrames);
        const progress = Math.min(1, Math.max(0, elapsed / 8));
        return (
          <span
            key={i}
            style={{
              ...style,
              opacity: progress,
              transform: `translateY(${(1 - progress) * 14}px)`,
              display: "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
};

const WordByWordSubtitles = ({subtitles, localFrame, fps}) => {
  const sec = localFrame / fps;
  const activeEntry = subtitles.find((item) => sec >= item.startSec && sec <= item.endSec);
  if (!activeEntry) return null;

  const words = activeEntry.text.split(/\s+/).filter(Boolean);
  const entryDuration = Math.max(activeEntry.endSec - activeEntry.startSec, 0.1);
  const wordDuration = entryDuration / words.length;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 10,
        maxWidth: "90%",
      }}
    >
      {words.map((word, i) => {
        const wordStartSec = activeEntry.startSec + i * wordDuration;
        const elapsed = (sec - wordStartSec) * fps;
        const progress = Math.min(1, Math.max(0, elapsed / 8));
        return (
          <span
            key={i}
            style={{
              opacity: progress,
              transform: `translateY(${(1 - progress) * 12}px)`,
              display: "inline-block",
              color: "#ffffff",
              fontSize: 52,
              fontWeight: 700,
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              padding: "10px 16px",
              borderRadius: 10,
              whiteSpace: "pre",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

const SlideScene = ({slide, localFrame, wordByWord}) => {
  const {fps} = useVideoConfig();
  const sec = localFrame / fps;
  const subtitles = useMemo(() => parseSrt(slide.subtitlesSrt), [slide.subtitlesSrt]);
  const activeLine = subtitles.find((item) => sec >= item.startSec && sec <= item.endSec);
  const plainSubtitle = String(slide.subtitlesSrt || "").trim();

  const titleText = slide.title || `Slide ${slide.id || ""}`;
  const titleWordCount = titleText.trim().split(/\s+/).filter(Boolean).length;
  const titleStagger = 6;
  const descStartFrame = titleWordCount * titleStagger + 8;
  const descStagger = 4;

  const entry = spring({
    fps,
    frame: localFrame,
    config: {damping: 200},
  });

  const opacity = interpolate(entry, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "rgb(13, 110, 53)",
        color: "#ffffff",
        fontFamily: "Inter, Arial, sans-serif",
        justifyContent: "space-between",
        padding: 70,
      }}
    >
      {slide.audioSrc ? <Audio src={slide.audioSrc} /> : null}

      {wordByWord ? (
        <div>
          <div style={{fontSize: 58, fontWeight: 800, marginBottom: 18}}>
            <WordReveal
              text={titleText}
              startFrame={0}
              staggerFrames={titleStagger}
              localFrame={localFrame}
              style={{fontSize: 58, fontWeight: 800, color: "#ffffff"}}
            />
          </div>
          <MarkdownContent fontSize={36}>{slide.description}</MarkdownContent>
        </div>
      ) : (
        <div
          style={{
            opacity,
            transform: `translateY(${interpolate(entry, [0, 1], [25, 0])}px)`,
          }}
        >
          <div style={{fontSize: 58, fontWeight: 800, marginBottom: 18}}>
            {titleText}
          </div>
          <MarkdownContent fontSize={36}>{slide.description}</MarkdownContent>
        </div>
      )}

      <div style={{display: "flex", justifyContent: "center", marginBottom: 20}}>
        {wordByWord ? (
          <WordByWordSubtitles subtitles={subtitles} localFrame={localFrame} fps={fps} />
        ) : (
          <>
            {activeLine ? <SubtitleLine line={activeLine.text} /> : null}
            {!activeLine && subtitles.length === 0 && plainSubtitle ? (
              <SubtitleLine line={plainSubtitle} />
            ) : null}
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const PedagogicalVideo = ({title, slides, backgroundMusicSrc, wordByWord}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const timeline = useMemo(() => buildTimeline(slides, fps), [slides, fps]);

  return (
    <AbsoluteFill>
      {backgroundMusicSrc ? (
        <Audio src={backgroundMusicSrc} volume={0.4} loop />
      ) : null}
      {timeline.map((item) => (
        <Sequence key={`slide-${item.index}`} from={item.from} durationInFrames={item.durationInFrames}>
          <SlideScene slide={item.slide} localFrame={frame - item.from} wordByWord={wordByWord} />
        </Sequence>
      ))}
      <div
        style={{
          position: "absolute",
          top: 24,
          right: 30,
          color: "#ffffff",
          fontSize: 24,
          fontWeight: 600,
        }}
      >
        {title || "Video pedagogique"}
      </div>
    </AbsoluteFill>
  );
};

export const computeTotalFrames = ({slides, fps}) => {
  const timeline = buildTimeline(slides, fps);
  return timeline.reduce((acc, item) => acc + item.durationInFrames, 0);
};

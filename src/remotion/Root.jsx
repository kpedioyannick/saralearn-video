import React from "react";
import {Composition} from "remotion";
import {computeTotalFrames, PedagogicalVideo} from "./PedagogicalVideo";

const FORMATS = {
  landscape: {width: 1920, height: 1080},
  portrait:  {width: 1080, height: 1920},
  square:    {width: 1080, height: 1080},
};

export const RemotionRoot = () => {
  return (
    <Composition
      id="PedagogicalVideo"
      component={PedagogicalVideo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={300}
      defaultProps={{
        title: "Video pedagogique",
        format: "landscape",
        slides: [
          {
            id: "slide-1",
            title: "Bienvenue",
            description: "Exemple de description lue a voix haute.",
            subtitlesSrt:
              "1\n00:00:00,000 --> 00:00:02,000\nExemple de description\n",
          },
        ],
      }}
      calculateMetadata={({props}) => {
        const {width, height} = FORMATS[props.format] || FORMATS.landscape;
        const durationInFrames = Math.max(
          30 * 2,
          computeTotalFrames({
            slides: props.slides,
            fps: 30,
          }),
        );
        return {width, height, durationInFrames};
      }}
    />
  );
};

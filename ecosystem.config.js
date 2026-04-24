module.exports = {
  apps: [{
    name: "sara-video",
    script: "server.js",
    cwd: "/var/php/saralearn-video",
    env: {
      SKIP_TTS: "true",
      PORT: "3457",
    },
  }],
};

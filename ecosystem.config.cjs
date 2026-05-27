module.exports = {
  apps: [
    {
      name: "radar",
      script: "server/server.js",
      cwd: "/opt/radar",
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: "8787"
      }
    }
  ]
};

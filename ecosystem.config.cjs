/**
 * PM2 process definitions for Task Management Flow (v2).
 * Usage: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "taskflow-api",
      cwd: "./TMS_BE",
      script: "index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "taskflow-web",
      cwd: "./TMS_FE",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3010",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: 3010,
      },
    },
  ],
};

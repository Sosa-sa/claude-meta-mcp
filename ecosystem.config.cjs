/**
 * pm2 ecosystem config for claude-meta-mcp.
 * Start: pm2 start ecosystem.config.cjs && pm2 save
 */
module.exports = {
  apps: [
    {
      name: "claude-meta-mcp",
      cwd: "/var/www/connector.markusstoeger.com",
      script: "dist/index.js",
      // Node 20+ loads .env from --env-file natively, no dotenv dep needed.
      node_args: "--env-file=.env --enable-source-maps",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "256M",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

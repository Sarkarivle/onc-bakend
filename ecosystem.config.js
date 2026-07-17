module.exports = {
  apps: [
    {
      name: 'onc-backend',
      script: 'server.js',
      cwd: __dirname,
      // 'max' = one worker per CPU core. A single 'fork' instance only ever
      // uses 1 core no matter how big the machine is. Cluster mode requires
      // all shared state to go through Redis (rate limiter, AI cache, auth
      // cache) instead of in-process memory - that's already done as of the
      // scaling work in this repo. Set a fixed number instead of 'max' if you
      // want to reserve cores for other processes on the same box.
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: 3001,
      },
    },
  ],
};

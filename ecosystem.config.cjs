module.exports = {
  apps: [
    {
      name: 'signage-app',
      script: 'server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        HOSTNAME: '0.0.0.0',
        PORT: '3000',
      },
    },
  ],
};

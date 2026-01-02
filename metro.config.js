// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Reduce file watching to prevent EMFILE errors on Windows
config.maxWorkers = 2;
config.resetCache = true;

// Only watch essential directories
config.watchFolders = [__dirname];

// Ignore large directories
config.resolver.blacklistRE = /#current-cloud-backend\/.*/;

// Reduce transformer workers
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
      keep_classnames: true,
      keep_fnames: true,
    },
  },
};

module.exports = config;

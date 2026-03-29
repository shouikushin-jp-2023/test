const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const libraryRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// watch the library source so Metro picks up live changes
config.watchFolders = [libraryRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(libraryRoot, 'node_modules'),
];

config.resolver.assetExts.push('mpd', 'xml');

module.exports = config;

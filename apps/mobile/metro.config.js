const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure pnpm workspace symlink resolution works reliably on Windows and CI
config.resolver.unstable_enableSymlinks = true;

module.exports = config;

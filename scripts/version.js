#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Path to package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const versionFilePath = path.join(__dirname, '..', 'public', 'version.json');

// Read current version from package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// Parse version components
const [major, minor, patch] = currentVersion.split('.').map(Number);

// Increment patch version
const newVersion = `${major}.${minor}.${patch + 1}`;

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

// Create or update version.json
const versionInfo = {
  version: newVersion,
  lastUpdated: new Date().toISOString()
};
fs.writeFileSync(versionFilePath, JSON.stringify(versionInfo, null, 2));

// Git commands
try {
  execSync('git add package.json public/version.json');
  execSync(`git commit -m "chore: bump version to ${newVersion}"`);
  console.log(`Version bumped to ${newVersion}`);
} catch (error) {
  console.error('Error executing git commands:', error);
  process.exit(1);
}

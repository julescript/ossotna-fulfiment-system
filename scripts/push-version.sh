#!/bin/bash

# Run the version increment script
node scripts/version.js

# Push to remote
git push

# Display new version
echo "Pushed with new version: $(node -p "require('./package.json').version")"

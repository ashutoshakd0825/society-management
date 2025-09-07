#!/usr/bin/env bash
set -o errexit


# Install dependencies
npm install

# Puppeteer ke liye Chrome install
npx puppeteer browsers install chrome

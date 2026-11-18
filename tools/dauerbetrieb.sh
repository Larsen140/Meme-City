#!/bin/sh
# Startet das Spielprogramm immer wieder neu, falls es einmal beendet wird.
cd "$(dirname "$0")/.."
while true; do
  node src/index.js >> game.log 2>&1
  echo "$(date +%T) Neustart nach Beendigung" >> game.log
  sleep 5
done

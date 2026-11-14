#!/bin/sh
# Run every tests/*.test.js file. tests/e2e is separate.
set -eu
cd "$(dirname "$0")/.."
found=0
for file in tests/*.test.js; do
  found=$((found + 1))
  echo "== $file"
  node "$file"
done
echo "js tests: $found files"

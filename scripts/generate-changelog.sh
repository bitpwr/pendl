#!/bin/bash

# Generate changelog from git commits between last tag and HEAD
# Usage: ./scripts/generate-changelog.sh [new-version]

NEW_VERSION=${1:-"Unreleased"}
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
CHANGELOG_FILE="CHANGELOG.md"

if [ -z "$LAST_TAG" ]; then
  echo "No previous tags found. This is the first release."
  COMMIT_RANGE="HEAD"
else
  COMMIT_RANGE="$LAST_TAG..HEAD"
  echo "Generating changelog from $LAST_TAG to HEAD..."
fi

# Get commit log
COMMITS=$(git log $COMMIT_RANGE --pretty=format:"- %s (%h)" --no-merges)

if [ -z "$COMMITS" ]; then
  echo "No new commits since last tag."
  exit 0
fi

# Create or update CHANGELOG.md
TEMP_FILE=$(mktemp)

echo "## [$NEW_VERSION] - $(date +%Y-%m-%d)" > "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "$COMMITS" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

if [ -f "$CHANGELOG_FILE" ]; then
  # Prepend to existing changelog
  cat "$CHANGELOG_FILE" >> "$TEMP_FILE"
fi

mv "$TEMP_FILE" "$CHANGELOG_FILE"

echo "✓ Changelog updated with $(echo "$COMMITS" | wc -l | tr -d ' ') commits"
echo ""
echo "Preview:"
head -n 20 "$CHANGELOG_FILE"

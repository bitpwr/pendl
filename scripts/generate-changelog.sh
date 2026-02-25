#!/bin/bash

# Generate changelog from git commits between last tag and HEAD
# Groups commits by type (feat, fix, docs, etc.) for better readability
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

# Get all commits
ALL_COMMITS=$(git log $COMMIT_RANGE --pretty=format:"%s%x09%h" --no-merges)

if [ -z "$ALL_COMMITS" ]; then
  echo "No new commits since last tag."
  exit 0
fi

# Initialize associative arrays for grouping
declare -A FEATURES
declare -A FIXES
declare -A DOCS
declare -A STYLE
declare -A REFACTOR
declare -A PERF
declare -A TEST
declare -A BUILD
declare -A CI
declare -A CHORE
declare -A OTHER

# Parse commits and group by type
while IFS=$'\t' read -r message hash; do
  # Extract type from conventional commit format
  if [[ $message =~ ^([a-z]+)(\(.+\))?:\ (.+)$ ]]; then
    type="${BASH_REMATCH[1]}"
    desc="${BASH_REMATCH[3]}"

    case $type in
      feat|feature)
        FEATURES["$hash"]="$desc"
        ;;
      fix)
        FIXES["$hash"]="$desc"
        ;;
      docs)
        DOCS["$hash"]="$desc"
        ;;
      style)
        STYLE["$hash"]="$desc"
        ;;
      refactor)
        REFACTOR["$hash"]="$desc"
        ;;
      perf)
        PERF["$hash"]="$desc"
        ;;
      test)
        TEST["$hash"]="$desc"
        ;;
      build)
        BUILD["$hash"]="$desc"
        ;;
      ci)
        CI["$hash"]="$desc"
        ;;
      chore)
        CHORE["$hash"]="$desc"
        ;;
      *)
        OTHER["$hash"]="$message"
        ;;
    esac
  else
    OTHER["$hash"]="$message"
  fi
done <<< "$ALL_COMMITS"

# Create changelog with grouped commits
TEMP_FILE=$(mktemp)

echo "## [$NEW_VERSION] - $(date +%Y-%m-%d)" > "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

# Features
if [ ${#FEATURES[@]} -gt 0 ]; then
  echo "### ✨ Features" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  for hash in "${!FEATURES[@]}"; do
    echo "- ${FEATURES[$hash]} (\`$hash\`)" >> "$TEMP_FILE"
  done
  echo "" >> "$TEMP_FILE"
fi

# Bug Fixes
if [ ${#FIXES[@]} -gt 0 ]; then
  echo "### 🐛 Bug Fixes" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  for hash in "${!FIXES[@]}"; do
    echo "- ${FIXES[$hash]} (\`$hash\`)" >> "$TEMP_FILE"
  done
  echo "" >> "$TEMP_FILE"
fi

# Performance
if [ ${#PERF[@]} -gt 0 ]; then
  echo "### ⚡ Performance" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  for hash in "${!PERF[@]}"; do
    echo "- ${PERF[$hash]} (\`$hash\`)" >> "$TEMP_FILE"
  done
  echo "" >> "$TEMP_FILE"
fi

# Refactoring
if [ ${#REFACTOR[@]} -gt 0 ]; then
  echo "### ♻️ Refactoring" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  for hash in "${!REFACTOR[@]}"; do
    echo "- ${REFACTOR[$hash]} (\`$hash\`)" >> "$TEMP_FILE"
  done
  echo "" >> "$TEMP_FILE"
fi

# Documentation
if [ ${#DOCS[@]} -gt 0 ]; then
  echo "### 📚 Documentation" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  for hash in "${!DOCS[@]}"; do
    echo "- ${DOCS[$hash]} (\`$hash\`)" >> "$TEMP_FILE"
  done
  echo "" >> "$TEMP_FILE"
fi

# Testing
if [ ${#TEST[@]} -gt 0 ]; then
  echo "### 🧪 Testing" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  for hash in "${!TEST[@]}"; do
    echo "- ${TEST[$hash]} (\`$hash\`)" >> "$TEMP_FILE"
  done
  echo "" >> "$TEMP_FILE"
fi

# Build System
if [ ${#BUILD[@]} -gt 0 ]; then
  echo "### 📦 Build System" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  for hash in "${!BUILD[@]}"; do
    echo "- ${BUILD[$hash]} (\`$hash\`)" >> "$TEMP_FILE"
  done
  echo "" >> "$TEMP_FILE"
fi

# CI/CD
if [ ${#CI[@]} -gt 0 ]; then
  echo "### 🔧 CI/CD" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  for hash in "${!CI[@]}"; do
    echo "- ${CI[$hash]} (\`$hash\`)" >> "$TEMP_FILE"
  done
  echo "" >> "$TEMP_FILE"
fi

# Styling
if [ ${#STYLE[@]} -gt 0 ]; then
  echo "### 💎 Styling" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  for hash in "${!STYLE[@]}"; do
    echo "- ${STYLE[$hash]} (\`$hash\`)" >> "$TEMP_FILE"
  done
  echo "" >> "$TEMP_FILE"
fi

# Chores
if [ ${#CHORE[@]} -gt 0 ]; then
  echo "### 🧹 Maintenance" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  for hash in "${!CHORE[@]}"; do
    echo "- ${CHORE[$hash]} (\`$hash\`)" >> "$TEMP_FILE"
  done
  echo "" >> "$TEMP_FILE"
fi

# Other
if [ ${#OTHER[@]} -gt 0 ]; then
  echo "### 📝 Other Changes" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  for hash in "${!OTHER[@]}"; do
    echo "- ${OTHER[$hash]} (\`$hash\`)" >> "$TEMP_FILE"
  done
  echo "" >> "$TEMP_FILE"
fi

if [ -f "$CHANGELOG_FILE" ]; then
  # Prepend to existing changelog
  cat "$CHANGELOG_FILE" >> "$TEMP_FILE"
fi

mv "$TEMP_FILE" "$CHANGELOG_FILE"

# Count total commits
TOTAL_COMMITS=$(echo "$ALL_COMMITS" | wc -l | tr -d ' ')

echo "✓ Changelog updated with $TOTAL_COMMITS commits grouped by type"
echo ""
echo "Preview:"
head -n 40 "$CHANGELOG_FILE"

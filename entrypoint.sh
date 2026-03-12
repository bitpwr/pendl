#!/bin/sh
set -e

# Only install dependencies when running tsx scripts.
# The Next.js standalone server already bundles its own node_modules.
case "$1" in
  tsx)
    # Install production dependencies if needed.
    # Reinstall whenever package-lock.json changes to avoid stale module volumes.
    lock_hash="$(sha256sum /app/package-lock.json | awk '{print $1}')"
    marker_file="/app/node_modules/.deps-installed-${lock_hash}"

    if [ ! -d "/app/node_modules" ] || [ ! -f "$marker_file" ]; then
      echo "Installing production dependencies for current lockfile..."
      npm ci --omit=dev
      rm -f /app/node_modules/.deps-installed*
      touch "$marker_file"
      chown -R nextjs:nodejs /app/node_modules
      echo "Dependencies installed"
    fi
    # Use npx to run tsx (downloads on first run, then cached)
    shift
    exec su-exec nextjs npx -y tsx "$@"
    ;;
esac

# Drop privileges and exec the command
exec su-exec nextjs "$@"

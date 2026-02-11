#!/bin/sh
set -e

# Only install dependencies when running tsx scripts.
# The Next.js standalone server already bundles its own node_modules.
case "$1" in
  tsx)
    # Install production dependencies if needed
    if [ ! -d "/app/node_modules" ] || [ ! -f "/app/node_modules/.deps-installed" ]; then
      echo "Installing production dependencies..."
      npm ci --omit=dev
      touch /app/node_modules/.deps-installed
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

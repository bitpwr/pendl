#!/usr/bin/env bash

CONTAINER_NAME="pendl-postgres-dev"

if [ $# -ne 1 ]; then
    echo "Error: Exactly one SQL query argument is required." >&2
    echo "Usage: ./scripts/call_sql.sh 'select * from stop_times'" >&2
    exit 1
fi

SQL_QUERY="$1"

docker exec -i "$CONTAINER_NAME" sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' -- "$SQL_QUERY"

#!/usr/bin/env bash

if [ $# -lt 1 ]; then
    echo "Error: Provide arguments to docker compose" >&2
    exit 1
fi

docker compose -f docker-compose.dev.yml --env-file .env.development "$@"
exit $?

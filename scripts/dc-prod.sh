#!/usr/bin/env bash

if [ $# -ne 1 ]; then
    echo "Error: Exactly one argument required (up|down)" >&2
    exit 1
fi

if [ "$1" = "up" ]; then
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d
elif [ "$1" = "down" ]; then
    docker compose -f docker-compose.prod.yml --env-file .env.production down
else
    echo "Error: Invalid argument '$1'. Use 'up' or 'down'" >&2
    exit 1
fi

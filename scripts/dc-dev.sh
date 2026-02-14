#!/usr/bin/env bash

if [ $# -ne 1 ]; then
    echo "Error: Exactly one argument required (up|down)" >&2
    exit 1
fi

if [ "$1" = "up" ]; then
    docker compose -f docker-compose.dev.yml --env-file .env.development up -d
elif [ "$1" = "down" ]; then
    docker compose -f docker-compose.dev.yml --env-file .env.development down
else
    echo "Error: Invalid argument '$1'. Use 'up' or 'down'" >&2
    exit 1
fi

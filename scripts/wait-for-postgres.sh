#!/bin/sh
# wait-for-postgres.sh
# Adapted from: https://docs.docker.com/compose/startup-order/

set -e

>&2 echo "Waiting for postgres..."

until PGPASSWORD="postgres" psql --host="$POSTGRES_HOST" --port="$POSTGRES_PORT" --username="postgres" -c '\q'; do
  sleep 1
  docker-compose ps
done

>&2 echo "Postgres is up - executing command"
exec "$@"


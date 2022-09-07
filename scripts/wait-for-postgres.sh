#!/bin/sh
# wait-for-postgres.sh
# Adapted from: https://docs.docker.com/compose/startup-order/

set -e

until PGPASSWORD="postgres" psql --host="$POSTGRES_HOST" --port="$POSTGRES_PORT" --username="postgres" -c '\q'; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up - executing command"
exec "$@"


#!/bin/bash
# run_migrations.sh
# Usage: Edit the variables below, then run: bash run_migrations.sh
# This script sets up environment variables and runs all Sequelize migrations for the project.

# --- EDIT THESE VALUES ---
export POSTGRES_CAREDB="care"
export POSTGRES_HOST="localhost"
export POSTGRES_PORT="5432"
# export POSTGRES_PASSWORD=""
# -------------------------

npx sequelize-cli db:migrate --config backend/db/config/config.js --migrations-path backend/db/migrations 
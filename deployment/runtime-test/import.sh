#!/bin/sh
set -eu
export MYSQL_PWD="$MARIADB_PASSWORD"
tables=$(mariadb -u "$MARIADB_USER" "$MARIADB_DATABASE" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE();")
test "$tables" = 0 || { echo 'Refusing to import over an existing database'; exit 1; }
mariadb -u "$MARIADB_USER" "$MARIADB_DATABASE" < /tmp/phase2b-backup.sql
mariadb -u "$MARIADB_USER" "$MARIADB_DATABASE" -B -N < /tmp/phase2b-counts.sql > /tmp/phase2b-counts.tsv
mariadb-check -u "$MARIADB_USER" "$MARIADB_DATABASE"
echo 'Import and table checks completed'

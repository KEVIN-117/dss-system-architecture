#!/bin/sh
set -eu

run_id='55555555-5555-5555-5555-555555555555'
resource_key='academic-period:concurrency-test'

psql -v ON_ERROR_STOP=1 -c "SELECT etl_control.create_etl_execution('$run_id'::uuid, 'HISTORICA', 'lock-concurrency-test');" >/dev/null

psql -v ON_ERROR_STOP=1 -c "BEGIN; INSERT INTO etl_control.etl_execution_lock (run_id, resource_key, lock_token, acquired_by, lease_expires_at) VALUES ('$run_id'::uuid, '$resource_key', '55555555-5555-5555-5555-555555555556'::uuid, 'lock-holder', clock_timestamp() + interval '5 minutes'); SELECT pg_sleep(2); COMMIT;" &
holder_pid=$!

attempt=0
while [ "$attempt" -lt 20 ]; do
  if psql -Atqc "SELECT count(*) FROM etl_control.etl_execution_lock WHERE resource_key = '$resource_key' AND released_at IS NULL" | grep -qx '1'; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 0.1
done

if [ "$attempt" -eq 20 ]; then
  echo 'El primer lock no quedó activo a tiempo' >&2
  exit 1
fi

if psql -v ON_ERROR_STOP=1 -c "INSERT INTO etl_control.etl_execution_lock (run_id, resource_key, lock_token, acquired_by, lease_expires_at) VALUES ('$run_id'::uuid, '$resource_key', '55555555-5555-5555-5555-555555555557'::uuid, 'lock-contender', clock_timestamp() + interval '5 minutes');"; then
  echo 'El segundo lock activo no fue rechazado' >&2
  exit 1
fi

wait "$holder_pid"

psql -v ON_ERROR_STOP=1 -c "UPDATE etl_control.etl_execution_lock SET released_by = 'lock-holder', released_at = clock_timestamp(), release_reason = 'Prueba de liberación' WHERE resource_key = '$resource_key' AND released_at IS NULL; INSERT INTO etl_control.etl_execution_lock (run_id, resource_key, lock_token, acquired_by, lease_expires_at) VALUES ('$run_id'::uuid, '$resource_key', '55555555-5555-5555-5555-555555555558'::uuid, 'lock-next-holder', clock_timestamp() + interval '5 minutes');" >/dev/null

echo 'Lock concurrency test passed'

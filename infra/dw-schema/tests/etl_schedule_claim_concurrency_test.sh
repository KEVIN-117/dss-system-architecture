#!/bin/sh
# LM-002 (#350): two dw-control-service instances claiming due schedules at the
# same time must not receive the same schedule (FOR UPDATE SKIP LOCKED plus
# the claim lease). Uses committed synthetic rows and removes them at the end.
set -eu

schedule_name='lm-002 concurrency fixture'

cleanup() {
  psql -q -v ON_ERROR_STOP=1 -c "
    DELETE FROM etl_control.etl_schedule_event
    WHERE schedule_id IN (SELECT schedule_id FROM etl_control.etl_schedule WHERE name = '$schedule_name');
    DELETE FROM etl_control.etl_schedule WHERE name = '$schedule_name';" >/dev/null
}
trap cleanup EXIT

psql -q -v ON_ERROR_STOP=1 -c "
  SET ROLE dw_control_service;
  SELECT etl_control.create_etl_schedule(
    'CATALOG_SYNC', '$schedule_name', '0 0 2 * * *', 'America/La_Paz',
    clock_timestamp() - interval '1 minute', 'concurrency-test');" >/dev/null

# Instance A claims and keeps its transaction (and row lock) open.
psql -q -v ON_ERROR_STOP=1 -At -c "
  SET ROLE dw_control_service;
  BEGIN;
  SELECT count(*) FROM etl_control.claim_due_etl_schedules(10, 300) WHERE name = '$schedule_name';
  SELECT pg_sleep(2);
  COMMIT;" > /tmp/claim_a.out &
holder_pid=$!

attempt=0
while [ "$attempt" -lt 30 ]; do
  if psql -Atqc "SELECT count(*) FROM pg_locks l JOIN pg_class c ON c.oid = l.relation
                 WHERE c.relname = 'etl_schedule' AND l.mode = 'RowShareLock' AND l.granted
                   AND l.pid <> pg_backend_pid()" | grep -qv '^0$'; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 0.1
done
if [ "$attempt" -eq 30 ]; then
  echo 'La instancia A no llegó a reclamar a tiempo' >&2
  exit 1
fi

# Instance B runs while A still holds the row: SKIP LOCKED must return nothing.
claimed_b=$(psql -q -v ON_ERROR_STOP=1 -At -c "
  SET ROLE dw_control_service;
  SELECT count(*) FROM etl_control.claim_due_etl_schedules(10, 300) WHERE name = '$schedule_name';")

wait "$holder_pid"
claimed_a=$(grep -E '^[0-9]+$' /tmp/claim_a.out | head -n 1)
rm -f /tmp/claim_a.out

# After A commits, the lease still keeps B out.
claimed_b_after=$(psql -q -v ON_ERROR_STOP=1 -At -c "
  SET ROLE dw_control_service;
  SELECT count(*) FROM etl_control.claim_due_etl_schedules(10, 300) WHERE name = '$schedule_name';")

if [ "$claimed_a" != '1' ] || [ "$claimed_b" != '0' ] || [ "$claimed_b_after" != '0' ]; then
  echo "Reclamación concurrente incorrecta: A=$claimed_a B=$claimed_b B-después=$claimed_b_after" >&2
  exit 1
fi

if ! psql -Atqc "SELECT claim_token IS NOT NULL AND claimed_until > clock_timestamp()
                 FROM etl_control.etl_schedule WHERE name = '$schedule_name'" | grep -qx 't'; then
  echo 'El lease de la instancia A no quedó vigente' >&2
  exit 1
fi

echo 'Schedule claim concurrency test passed'

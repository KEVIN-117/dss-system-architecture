#!/usr/bin/env bash
# Hop Server smoke regression (LM-001).
#
# Exercises the HTTP contract dw-control-service relies on (see
# docs/dw/hop-server-contract.md) against the packaged DSS Hop Server image:
#   1. /hop/status rejects anonymous requests and answers with credentials.
#   2. A launcher workflow is submitted with registerWorkflow + startWorkflow.
#      It runs the project workflow named by P_TARGET_WORKFLOW, so the client
#      never ships project files and parameters reach the server.
#   3. workflowStatus reports the run until it finishes without errors, and
#      its log is readable (base64 + gzip).
#   4. A launcher pointing at a missing workflow does not finish cleanly.
# The caller then asserts the synchronized catalog with
# assert_hop_academic_catalog.sql.
set -euo pipefail

base_url="${HOP_SERVER_URL:?HOP_SERVER_URL is required}"
: "${HOP_SERVER_USER:?HOP_SERVER_USER is required}"
: "${HOP_SERVER_PASS:?HOP_SERVER_PASS is required}"
project_home="${HOP_SMOKE_PROJECT_HOME:-/files/project}"
timeout_seconds="${HOP_SMOKE_TIMEOUT_SECONDS:-180}"
launcher_name="dss_lm_launcher"

auth=(-u "${HOP_SERVER_USER}:${HOP_SERVER_PASS}")
curl_opts=(-sS --max-time 30)

fail() {
  echo "hop-server smoke: $*" >&2
  exit 1
}

xml_escape() {
  local value="$1"
  value="${value//&/&amp;}"
  value="${value//</&lt;}"
  value="${value//>/&gt;}"
  printf '%s' "${value}"
}

# Prints the registerWorkflow request for the launcher. The server resolves
# database connections from its own project metadata, so the request carries
# an empty (gzip+base64) metadata store.
launcher_request() {
  local target_workflow
  target_workflow="$(xml_escape "$1")"
  local empty_metastore
  empty_metastore="$(printf '{}' | gzip -c | base64 | tr -d '\n')"
  cat <<XML
<workflow_configuration>
<workflow>
  <name>${launcher_name}</name><name_sync_with_filename>N</name_sync_with_filename>
  <parameters>
    <parameter><name>P_TARGET_WORKFLOW</name><default_value/><description>Workflow del proyecto a ejecutar</description></parameter>
  </parameters>
  <actions>
    <action><name>Start</name><description/><type>SPECIAL</type><attributes/><repeat>N</repeat><schedulerType>0</schedulerType><parallel>N</parallel><xloc>0</xloc><yloc>0</yloc><attributes_hac/></action>
    <action><name>Run target workflow</name><description/><type>WORKFLOW</type><attributes/><run_configuration>local</run_configuration><filename>\${P_TARGET_WORKFLOW}</filename><params_from_previous>N</params_from_previous><exec_per_row>N</exec_per_row><set_logfile>N</set_logfile><loglevel>Basic</loglevel><wait_until_finished>Y</wait_until_finished><create_parent_folder>N</create_parent_folder><parameters><pass_all_parameters>Y</pass_all_parameters></parameters><parallel>N</parallel><xloc>160</xloc><yloc>0</yloc><attributes_hac/></action>
  </actions>
  <hops><hop><from>Start</from><to>Run target workflow</to><enabled>Y</enabled><evaluation>Y</evaluation><unconditional>Y</unconditional></hop></hops>
  <notepads/><attributes/>
</workflow>
<workflow_execution_configuration>
  <log_level>Basic</log_level>
  <run_configuration>local</run_configuration>
  <parameters>
    <parameter><name>P_TARGET_WORKFLOW</name><value>${target_workflow}</value></parameter>
  </parameters>
</workflow_execution_configuration>
<metastore_json>${empty_metastore}</metastore_json>
</workflow_configuration>
XML
}

# Submits the launcher for $1 and waits for it. Sets run_id, run_status and
# run_status_json.
run_launcher() {
  local target_workflow="$1"
  local request_file
  request_file="$(mktemp)"
  launcher_request "${target_workflow}" > "${request_file}"

  local register_response
  register_response="$(curl "${curl_opts[@]}" -f "${auth[@]}" -H 'Content-Type: text/xml' \
    --data-binary "@${request_file}" "${base_url}/hop/registerWorkflow/?xml=Y")"
  rm -f "${request_file}"
  local execution_id
  execution_id="$(printf '%s' "${register_response}" | tr -d '\n' | sed -n 's:.*<id>\([^<]*\)</id>.*:\1:p')"
  [[ "${execution_id}" =~ ^[0-9a-f-]{36}$ ]] || fail "registerWorkflow did not return an execution id: ${register_response}"

  local start_response
  start_response="$(curl "${curl_opts[@]}" -f "${auth[@]}" \
    "${base_url}/hop/startWorkflow/?name=${launcher_name}&id=${execution_id}&xml=Y")"
  printf '%s' "${start_response}" | grep -q '<result>OK</result>' || fail "startWorkflow failed: ${start_response}"

  local deadline=$((SECONDS + timeout_seconds))
  local status=""
  while :; do
    run_status_json="$(curl "${curl_opts[@]}" -f "${auth[@]}" \
      "${base_url}/hop/workflowStatus/?name=${launcher_name}&id=${execution_id}&json=Y")"
    status="$(printf '%s' "${run_status_json}" | sed -n 's/.*"statusDescription" : "\([^"]*\)".*/\1/p' | head -n 1)"
    case "${status}" in
      Waiting|Running|Initializing|"") ;;
      *) break ;;
    esac
    (( SECONDS < deadline )) || fail "launcher for ${target_workflow} did not finish within ${timeout_seconds}s"
    sleep 2
  done
  run_id="${execution_id}"
  run_status="${status}"
}

echo "Waiting for Hop Server at ${base_url}"
deadline=$((SECONDS + 120))
until curl "${curl_opts[@]}" -o /dev/null -f "${auth[@]}" "${base_url}/hop/status/?json=Y"; do
  (( SECONDS < deadline )) || fail "Hop Server did not become ready"
  sleep 2
done

anonymous_status="$(curl "${curl_opts[@]}" -o /dev/null -w '%{http_code}' "${base_url}/hop/status/?json=Y")"
[[ "${anonymous_status}" == "401" ]] || fail "anonymous /hop/status returned ${anonymous_status}, expected 401"
echo "Anonymous status request rejected (401)."

# Happy path: the catalog sync through the launcher.
run_launcher "${project_home}/workflows/wf_sync_academic_catalog.hwf"
[[ "${run_status}" == "Finished" ]] || fail "catalog launcher ${run_id} ended as '${run_status}'"
if printf '%s' "${run_status_json}" | grep -Eq '"nrErrors" : [1-9]|"result" : false'; then
  fail "catalog launcher ${run_id} finished with action errors"
fi
log_text="$(printf '%s' "${run_status_json}" | sed -n 's/.*"loggingString" : "\([^"]*\)".*/\1/p' | base64 -d | gunzip)"
printf '%s' "${log_text}" | grep -q 'wf_sync_academic_catalog - Workflow execution finished' ||
  fail "catalog launcher ${run_id} log does not show the target workflow finishing"
echo "Catalog sync ran through the launcher (${run_id})."

# Negative path: a missing target must surface as a failed run.
run_launcher "${project_home}/workflows/does_not_exist.hwf"
if [[ "${run_status}" == "Finished" ]] && ! printf '%s' "${run_status_json}" | grep -Eq '"nrErrors" : [1-9]|"result" : false'; then
  fail "launcher ${run_id} for a missing workflow finished cleanly"
fi
echo "Missing workflow reported as failed (${run_id}: ${run_status})."

echo "Hop Server contract smoke passed."

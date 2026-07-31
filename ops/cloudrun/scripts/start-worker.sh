#!/usr/bin/env bash
set -Eeuo pipefail

source /usr/local/bin/common.sh

start_cloud_sql_proxy
configure_common_site
require_site
start_health_server

cd "${BENCH_DIR}"
bench worker --queue "${WORKER_QUEUES:-short,default,long}" &
WORKER_PID=$!

wait_for_children \
	"${WORKER_PID}" \
	"${HEALTH_SERVER_PID}" \
	"${CLOUD_SQL_PROXY_PID:-}"

#!/usr/bin/env bash
set -Eeuo pipefail

source /usr/local/bin/common.sh

start_cloud_sql_proxy
configure_common_site
require_site
start_gunicorn
start_socketio
start_nginx

wait_for_children \
	"${GUNICORN_PID}" \
	"${SOCKETIO_PID}" \
	"${NGINX_PID}" \
	"${CLOUD_SQL_PROXY_PID:-}"

#!/usr/bin/env bash
set -Eeuo pipefail

BENCH_DIR=/home/frappe/frappe-bench
SITES_DIR=${BENCH_DIR}/sites
SITE_NAME=${FRAPPE_SITE_NAME:?FRAPPE_SITE_NAME is required}
SITE_DIR=${SITES_DIR}/${SITE_NAME}
SOCKETIO_PORT=${SOCKETIO_PORT:-9000}
DB_TYPE=${DB_TYPE:-postgres}
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-}
DB_SETUP_MODE=${DB_SETUP_MODE:-existing}
CLOUD_SQL_IP_TYPE=${CLOUD_SQL_IP_TYPE:-private}
PORT=${PORT:-8080}

if [[ -z "${DB_PORT}" ]]; then
	if [[ "${DB_TYPE}" == "postgres" ]]; then
		DB_PORT=5432
	else
		DB_PORT=3306
	fi
fi

log() {
	printf '[cloudrun] %s\n' "$*"
}

clear_site_runtime_cache() {
	log "Clearing shared website and asset cache for ${SITE_NAME}"
	bench --site "${SITE_NAME}" execute frappe.cache_manager.clear_global_cache
}

refresh_assets_runtime_cache() {
	log "Refreshing shared assets_json cache for ${SITE_NAME}"
	if ! bench --site "${SITE_NAME}" execute crm.utils.assets.refresh_assets_json_cache; then
		log "Warning: failed to refresh shared assets_json cache for ${SITE_NAME}"
	fi
}

require_env() {
	local name

	for name in "$@"; do
		if [[ -z "${!name:-}" ]]; then
			printf 'Missing required env var: %s\n' "${name}" >&2
			exit 1
		fi
	done
}

wait_for_tcp() {
	local host=$1
	local port=$2
	local attempts=${3:-60}
	local try=1

	while ! (echo >"/dev/tcp/${host}/${port}") >/dev/null 2>&1; do
		if (( try >= attempts )); then
			printf 'Timed out waiting for %s:%s\n' "${host}" "${port}" >&2
			return 1
		fi
		sleep 2
		try=$((try + 1))
	done
}

start_cloud_sql_proxy() {
	if [[ -z "${INSTANCE_CONNECTION_NAME:-}" ]]; then
		log "INSTANCE_CONNECTION_NAME not set, skipping Cloud SQL Proxy startup"
		return 0
	fi

	log "Starting Cloud SQL Proxy for ${INSTANCE_CONNECTION_NAME} on ${DB_HOST}:${DB_PORT}"
	/usr/local/bin/cloud-sql-proxy \
		$([[ "${CLOUD_SQL_IP_TYPE}" == "private" ]] && printf '%s ' --private-ip) \
		--address "${DB_HOST}" \
		--port "${DB_PORT}" \
		"${INSTANCE_CONNECTION_NAME}" &
	CLOUD_SQL_PROXY_PID=$!

	wait_for_tcp "${DB_HOST}" "${DB_PORT}" 90
}

configure_common_site() {
	require_env REDIS_CACHE_URL REDIS_QUEUE_URL

	cd "${BENCH_DIR}"

	mkdir -p "${SITES_DIR}" "${SITE_DIR}" "${BENCH_DIR}/logs"
	ls -1 apps > "${SITES_DIR}/apps.txt"
	[[ -f "${SITES_DIR}/common_site_config.json" ]] || printf '{}\n' > "${SITES_DIR}/common_site_config.json"

	bench set-config -g db_type "${DB_TYPE}"
	bench set-config -g db_host "${DB_HOST}"
	bench set-config -gp db_port "${DB_PORT}"
	bench set-config -g redis_cache "${REDIS_CACHE_URL}"
	bench set-config -g redis_queue "${REDIS_QUEUE_URL}"
	bench set-config -g redis_socketio "${REDIS_SOCKETIO_URL:-${REDIS_QUEUE_URL}}"
	bench set-config -gp socketio_port "${SOCKETIO_PORT}"
	printf '%s\n' "${SITE_NAME}" > "${SITES_DIR}/currentsite.txt"
}

site_bootstrapped() {
	[[ -f "${SITE_DIR}/site_config.json" ]] || return 1

	if [[ -z "${DB_NAME:-}" || -z "${DB_PASSWORD:-}" ]]; then
		return 0
	fi

	if db_schema_ready; then
		return 0
	fi

	log "Site config exists but the database schema is incomplete"
	return 1
}

require_site() {
	if site_bootstrapped; then
		return 0
	fi

	printf 'Site %s is not bootstrapped. Run the bootstrap job first.\n' "${SITE_NAME}" >&2
	exit 1
}

bootstrap_site() {
	local root_user db_user
	local -a create_site_cmd

	configure_common_site
	cd "${BENCH_DIR}"

	if site_bootstrapped; then
		log "Site ${SITE_NAME} already exists, running migrate"
		bench --site "${SITE_NAME}" migrate
		if [[ -n "${HOST_NAME:-}" ]]; then
			bench --site "${SITE_NAME}" set-config host_name "${HOST_NAME}"
		fi
		clear_site_runtime_cache
		refresh_assets_runtime_cache
		return 0
	fi

	require_env ADMIN_PASSWORD DB_NAME DB_PASSWORD

	root_user=${DB_ROOT_USERNAME:-}
	db_user=${DB_USER:-${DB_NAME}}

	if [[ -f "${SITE_DIR}/site_config.json" ]]; then
		log "Removing stale site_config.json before retrying bootstrap"
		rm -f "${SITE_DIR}/site_config.json"
	fi

	if [[ -z "${root_user}" ]]; then
		if [[ "${DB_TYPE}" == "postgres" ]]; then
			root_user=postgres
		else
			root_user=root
		fi
	fi

	create_site_cmd=(
		bench new-site "${SITE_NAME}"
		--force
		--admin-password "${ADMIN_PASSWORD}"
		--install-app crm
		--db-type "${DB_TYPE}"
		--db-host "${DB_HOST}"
		--db-port "${DB_PORT}"
		--db-name "${DB_NAME}"
		--db-password "${DB_PASSWORD}"
	)

	if [[ "${DB_SETUP_MODE}" == "existing" ]]; then
		create_site_cmd+=(--no-setup-db)
	fi

	if [[ "${DB_TYPE}" == "postgres" ]]; then
		create_site_cmd+=(--db-user "${db_user}")
	elif [[ "${DB_SETUP_MODE}" != "existing" ]]; then
		create_site_cmd+=(--mariadb-user-host-login-scope "%")
	fi

	if [[ "${DB_SETUP_MODE}" != "existing" ]]; then
		require_env DB_ROOT_PASSWORD
		create_site_cmd+=(
			--db-root-username "${root_user}"
			--db-root-password "${DB_ROOT_PASSWORD}"
		)
	fi

	log "Bootstrapping site ${SITE_NAME} with ${DB_TYPE} (${DB_SETUP_MODE})"
	"${create_site_cmd[@]}"

	bench --site "${SITE_NAME}" set-config mute_emails 1
	bench --site "${SITE_NAME}" set-config server_script_enabled 1
	if [[ -n "${HOST_NAME:-}" ]]; then
		bench --site "${SITE_NAME}" set-config host_name "${HOST_NAME}"
	fi
	bench --site "${SITE_NAME}" clear-cache
	bench --site "${SITE_NAME}" migrate
	clear_site_runtime_cache
	refresh_assets_runtime_cache
}

db_schema_ready() {
	local db_user

	db_user=${DB_USER:-${DB_NAME}}

	if [[ "${DB_TYPE}" == "postgres" ]]; then
		local result

		result=$(
			PGPASSWORD="${DB_PASSWORD}" \
				psql \
					--host "${DB_HOST}" \
					--port "${DB_PORT}" \
					--username "${db_user}" \
					--dbname "${DB_NAME}" \
					--tuples-only \
					--no-align \
					--command "SELECT to_regclass('public.\"tabDefaultValue\"') IS NOT NULL" 2>/dev/null | tr -d '[:space:]'
		)
		[[ "${result}" == "t" ]]
		return
	fi

	mysql \
		--host="${DB_HOST}" \
		--port="${DB_PORT}" \
		--user="${db_user}" \
		--password="${DB_PASSWORD}" \
		--database="${DB_NAME}" \
		--batch \
		--skip-column-names \
		--execute="SHOW TABLES LIKE 'tabDefaultValue'" 2>/dev/null | grep -qx 'tabDefaultValue'
}

start_health_server() {
	python /opt/univesp/health_server.py "${PORT}" &
	HEALTH_SERVER_PID=$!

	wait_for_tcp 127.0.0.1 "${PORT}" 30
}

start_gunicorn() {
	cd "${BENCH_DIR}"

	"${BENCH_DIR}/env/bin/gunicorn" \
		--chdir="${BENCH_DIR}/sites" \
		--bind=0.0.0.0:8000 \
		--threads="${GUNICORN_THREADS:-4}" \
		--workers="${GUNICORN_WORKERS:-2}" \
		--worker-class=gthread \
		--worker-tmp-dir=/dev/shm \
		--timeout="${GUNICORN_TIMEOUT:-120}" \
		--preload \
		frappe.app:application &
	GUNICORN_PID=$!

	wait_for_tcp 127.0.0.1 8000 60
}

start_socketio() {
	cd "${BENCH_DIR}"

	node /home/frappe/frappe-bench/apps/frappe/socketio.js &
	SOCKETIO_PID=$!

	wait_for_tcp 127.0.0.1 "${SOCKETIO_PORT}" 60
}

start_nginx() {
	export BACKEND=127.0.0.1:8000
	export SOCKETIO=127.0.0.1:${SOCKETIO_PORT}
	export PROXY_READ_TIMEOUT=${PROXY_READ_TIMEOUT:-3600}
	export CLIENT_MAX_BODY_SIZE=${CLIENT_MAX_BODY_SIZE:-50m}

	if [[ -z "${FRAPPE_SITE_NAME_HEADER:-}" ]]; then
		export FRAPPE_SITE_NAME_HEADER='$host'
	fi

	nginx-entrypoint.sh &
	NGINX_PID=$!

	wait_for_tcp 127.0.0.1 "${PORT}" 30
}

terminate_children() {
	local pid

	for pid in "$@"; do
		if [[ -n "${pid:-}" ]] && kill -0 "${pid}" 2>/dev/null; then
			kill "${pid}" 2>/dev/null || true
		fi
	done

	wait || true
}

wait_for_children() {
	local exit_code=0
	local pid
	local -a pids=()

	for pid in "$@"; do
		if [[ -n "${pid}" ]]; then
			pids+=("${pid}")
		fi
	done

	if [[ ${#pids[@]} -eq 0 ]]; then
		printf 'No child processes were started.\n' >&2
		return 1
	fi

	trap 'terminate_children "${pids[@]}"' EXIT INT TERM

	if ! wait -n "${pids[@]}"; then
		exit_code=$?
	fi

	terminate_children "${pids[@]}"
	trap - EXIT INT TERM

	return "${exit_code}"
}

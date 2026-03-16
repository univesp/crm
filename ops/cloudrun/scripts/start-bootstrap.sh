#!/usr/bin/env bash
set -Eeuo pipefail

source /usr/local/bin/common.sh

start_cloud_sql_proxy
bootstrap_site

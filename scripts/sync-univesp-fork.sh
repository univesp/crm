#!/usr/bin/env bash
set -Eeuo pipefail

UPSTREAM_REMOTE=${UPSTREAM_REMOTE:-upstream}
UPSTREAM_URL=${UPSTREAM_URL:-https://github.com/frappe/crm.git}
STABLE_BRANCH=${STABLE_BRANCH:-main}
CUSTOM_BRANCH=${CUSTOM_BRANCH:-univesp/cloudrun-homolog}
SYNC_MODE=${SYNC_MODE:-rebase}
PUSH_MAIN=${PUSH_MAIN:-false}
PUSH_CUSTOM=${PUSH_CUSTOM:-false}

log() {
	printf '[sync-univesp] %s\n' "$*"
}

fail() {
	printf '[sync-univesp] %s\n' "$*" >&2
	exit 1
}

require_clean_worktree() {
	if [[ -n "$(git status --short --untracked-files=normal)" ]]; then
		fail 'Working tree has uncommitted changes. Commit or stash them before syncing.'
	fi
}

ensure_remote() {
	if git remote get-url "${UPSTREAM_REMOTE}" >/dev/null 2>&1; then
		return
	fi

	log "Adding ${UPSTREAM_REMOTE} remote -> ${UPSTREAM_URL}"
	git remote add "${UPSTREAM_REMOTE}" "${UPSTREAM_URL}"
}

ensure_local_branch() {
	local branch=$1
	local start_point=$2

	if git show-ref --verify --quiet "refs/heads/${branch}"; then
		git switch "${branch}" >/dev/null
		return
	fi

	log "Creating local branch ${branch} from ${start_point}"
	git switch -c "${branch}" "${start_point}" >/dev/null
}

sync_stable_branch() {
	ensure_local_branch "${STABLE_BRANCH}" "${UPSTREAM_REMOTE}/${STABLE_BRANCH}"
	log "Fast-forwarding ${STABLE_BRANCH} from ${UPSTREAM_REMOTE}/${STABLE_BRANCH}"
	git merge --ff-only "${UPSTREAM_REMOTE}/${STABLE_BRANCH}" >/dev/null

	if [[ "${PUSH_MAIN}" == "true" ]]; then
		log "Pushing ${STABLE_BRANCH} to origin/${STABLE_BRANCH}"
		git push origin "${STABLE_BRANCH}"
	fi
}

sync_custom_branch() {
	local start_point="${STABLE_BRANCH}"

	if git show-ref --verify --quiet "refs/remotes/origin/${CUSTOM_BRANCH}"; then
		start_point="origin/${CUSTOM_BRANCH}"
	fi

	ensure_local_branch "${CUSTOM_BRANCH}" "${start_point}"

	case "${SYNC_MODE}" in
		rebase)
			log "Rebasing ${CUSTOM_BRANCH} onto ${STABLE_BRANCH}"
			git rebase "${STABLE_BRANCH}"
			;;
		merge)
			log "Merging ${STABLE_BRANCH} into ${CUSTOM_BRANCH}"
			git merge --no-ff --no-edit "${STABLE_BRANCH}"
			;;
		*)
			fail "Invalid SYNC_MODE=${SYNC_MODE}. Use rebase or merge."
			;;
	esac

	if [[ "${PUSH_CUSTOM}" == "true" ]]; then
		if [[ "${SYNC_MODE}" == "rebase" ]]; then
			log "Force-pushing ${CUSTOM_BRANCH} with lease"
			git push --force-with-lease origin "${CUSTOM_BRANCH}"
		else
			log "Pushing ${CUSTOM_BRANCH} to origin/${CUSTOM_BRANCH}"
			git push origin "${CUSTOM_BRANCH}"
		fi
	fi
}

main() {
	require_clean_worktree
	ensure_remote

	log "Fetching origin"
	git fetch --prune origin
	log "Fetching ${UPSTREAM_REMOTE}/${STABLE_BRANCH}"
	git fetch --prune "${UPSTREAM_REMOTE}" "${STABLE_BRANCH}"

	sync_stable_branch
	sync_custom_branch

	log "Sync complete"
	log "${STABLE_BRANCH}: $(git rev-parse --short "${STABLE_BRANCH}")"
	log "${CUSTOM_BRANCH}: $(git rev-parse --short "${CUSTOM_BRANCH}")"
}

main "$@"

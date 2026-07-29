#!/usr/bin/env python3
"""Readiness local — valida artefatos do repo sem deploy GCP (port Windows/Linux)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
	('preflight-homolog.sh', ROOT / 'ops/cloudrun/preflight-homolog.sh'),
	('smoke-homolog.sh', ROOT / 'ops/cloudrun/smoke-homolog.sh'),
	('deploy.sh', ROOT / 'ops/cloudrun/deploy.sh'),
	('deploy-faq-services.sh', ROOT / 'ops/cloudrun/deploy-faq-services.sh'),
	('ensure-random-secret.sh', ROOT / 'ops/cloudrun/ensure-random-secret.sh'),
	('rollback.sh', ROOT / 'ops/cloudrun/rollback.sh'),
	('env.vm.example', ROOT / 'env.vm.example'),
	('docker-compose.vm.yml', ROOT / 'docker-compose.vm.yml'),
	('sso-gateway Dockerfile', ROOT / 'sso-gateway/Dockerfile'),
	('univesp-frontend Dockerfile', ROOT / 'univesp-frontend/Dockerfile'),
	('TI handoff', ROOT / 'docs/TI_HOMOLOGACAO.md'),
	('GCS site_config doc', ROOT / 'docs/ops/gcs-frappe-site-config.example.md'),
	('validate-gcs-site-config.sh', ROOT / 'ops/vm/scripts/validate-gcs-site-config.sh'),
]


def main() -> int:
	failures = 0
	print('== Cloud Run local readiness ==')
	for label, path in REQUIRED_FILES:
		if path.is_file():
			print(f'OK   {label}')
		else:
			print(f'FALTA {label} ({path})')
			failures += 1

	result = subprocess.run(
		[sys.executable, '-m', 'unittest', 'discover', '-s', str(ROOT / 'ops/cloudrun/tests'), '-p', 'test_*.py', '-q'],
		cwd=ROOT,
	)
	if result.returncode == 0:
		print('OK   ops/cloudrun/tests (unittest)')
	else:
		print('FALHA ops/cloudrun/tests')
		failures += 1

	if failures:
		print(f'\n{failures} falha(s). Corrija antes do handoff TI.')
		return 1

	print('\nArtefatos locais OK. Proximo passo TI: PREFLIGHT_MODE=gcp ops/cloudrun/preflight-homolog.sh')
	return 0


if __name__ == '__main__':
	raise SystemExit(main())

#!/usr/bin/env python3
"""Executa validação local alinhada ao CI (sem bench Frappe)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = ROOT / 'univesp_atendimento_app'


def run(cmd: list[str], *, cwd: Path | None = None) -> None:
	label = ' '.join(cmd)
	print(f'\n== {label} ==')
	result = subprocess.run(cmd, cwd=cwd or ROOT)
	if result.returncode != 0:
		raise SystemExit(result.returncode)


def compile_backend() -> None:
	if sys.platform == 'win32':
		# compileall/py_compile falham em paths longos no Windows; ast.parse valida sintaxe.
		syntax_check = (
			'import ast, pathlib, sys\n'
			'root = pathlib.Path("univesp_atendimento_app/univesp_atendimento")\n'
			'for path in root.rglob("*.py"):\n'
			'    ast.parse(path.read_text(encoding="utf-8"), filename=str(path))\n'
		)
		run([sys.executable, '-c', syntax_check])
		return
	run([sys.executable, '-m', 'compileall', '-q', 'univesp_atendimento_app'])


def main() -> None:
	compile_backend()
	run([sys.executable, '-m', 'unittest', 'discover', '-s', 'ops/cloudrun/tests', '-p', 'test_*.py', '-q'])

	bootstrap = (
		'from univesp_atendimento.tests.bootstrap_frappe_stub import ensure_frappe_stub; '
		'ensure_frappe_stub(); '
		'import unittest; '
		'loader=unittest.TestLoader(); '
		'suite=loader.discover("univesp_atendimento/tests", pattern="test_*.py"); '
		'runner=unittest.TextTestRunner(verbosity=2); '
		'result=runner.run(suite); '
		'raise SystemExit(0 if result.wasSuccessful() else 1)'
	)
	run([sys.executable, '-c', bootstrap], cwd=APP_ROOT)

	print('\nValidação Python local concluída (integração Frappe pulada sem bench).')


if __name__ == '__main__':
	main()

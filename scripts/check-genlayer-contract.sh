#!/usr/bin/env bash
set -euo pipefail

contract="contracts/trustpay_verification.py"

python3 -m py_compile "$contract"
python3 -m unittest discover -s tests/contract -p 'test_*.py'

if command -v genvm-lint >/dev/null 2>&1; then
  genvm-lint check "$contract"
else
  echo "genvm-lint is not installed; syntax and local contract tests passed."
  echo "Install the official GenVM linter and rerun this script before deployment:"
  echo "pip install genvm-linter"
fi

#!/bin/sh
# 霧谷の冒険者団：Python 版（正）の写しを取り直し、TypeScript のデータと一致テストの記録を作り直す。
#   sh tools/kiridani/sync.sh [Python 版のフォルダ]   （既定 /mnt/project-files/kiridani/engine/）
# そのあと npm test で TypeScript 版が Python 版と同じ試合になるかを確かめる。
set -e
SRC="${1:-/mnt/project-files/kiridani/engine/}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
for f in engine.py ai.py data.py; do cp "$SRC/$f" "$ROOT/tools/kiridani/py/$f"; done
python3 "$ROOT/tools/kiridani_data_to_ts.py"
python3 "$ROOT/tools/kiridani/trace.py"

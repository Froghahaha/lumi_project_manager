#!/bin/bash
# 清空数据库并重新导入 Excel 数据
# 用法: bash reimport.sh [excel文件路径]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB="$SCRIPT_DIR/data.db"
BACKEND_LOG="$SCRIPT_DIR/backend.log"
DEFAULT_XLSX="docs/项目节点进度表20260508.xlsx"
XLSX="${1:-$DEFAULT_XLSX}"

echo "=== 停止后端 ==="
powershell -Command "Get-Process -Name python* -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null || true
sleep 2

echo "=== 清空数据库 ==="
rm -f "$DB"
echo "已删除 $DB"

echo "=== 导入数据: $XLSX ==="
cd "$SCRIPT_DIR"
/c/ProgramData/anaconda3/python -m backend.scripts.import_legacy "$XLSX"

echo "=== 重启后端 ==="
/c/ProgramData/anaconda3/python -m uvicorn backend.app.main:app --port 8000 2>&1 &
sleep 4

echo ""
echo "=== 完毕 ==="
echo "后端: http://localhost:8000"
echo "前端: http://localhost:3000"

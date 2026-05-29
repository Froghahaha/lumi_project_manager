# Lumi 项目管理系统 — 开发启动指南

## 首次启动

```bash
# 1. 前端依赖安装 (仅首次)
cd frontend && npm install && cd ..

# 2. 后端依赖安装 (仅首次)
pip install -r backend/requirements.txt

# 3. 启动前端开发服务器
cd frontend && npm run dev

# 4. 启动后端 (另开终端)
cd . && python -m uvicorn backend.app.main:app --reload --port 8000
```

## 重新导入 Excel 数据

```bash
# PowerShell
.\reimport.ps1

# Bash
bash reimport.sh
```

## 生产发布

```bash
# 1. 构建前端
cd frontend && npm run build && cd ..

# 2. 复制静态文件到后端
cp -r frontend/dist backend/static

# 3. PyInstaller 打包
pyinstaller lumi_server.spec

# 4. 输出在 dist/lumi_server.exe
# 运行: dist/lumi_server.exe --port 8000
```

## 端口
- 前端开发: http://localhost:5173
- 后端 API: http://localhost:8000
- 生产模式: http://localhost:8000 (前后端一体)

## 默认账号
- 超级管理员: 123456
- 其他人员: 123456

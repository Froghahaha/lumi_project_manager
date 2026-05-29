# -*- mode: python ; coding: utf-8 -*-
import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

_root = SPECPATH

a = Analysis(
    ['backend/run.py'],
    pathex=[str(_root)],
    binaries=[],
    datas=[
        ('backend/static', 'backend/static'),
        ('backend/app/authorization.polar', 'backend/app'),
        ('uploads', 'uploads'),
    ] + collect_data_files('oso') + collect_data_files('sqlalchemy'),
    hiddenimports=[
        'sqlmodel',
        'sqlalchemy',
        'oso',
        'openpyxl',
        'fastapi',
        'uvicorn',
        'pydantic',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'PIL',
        'cv2',
        'notebook',
        'jupyter',
        'IPython',
        'setuptools',
        'pip',
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='lumi_server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

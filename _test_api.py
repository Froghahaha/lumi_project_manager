"""
API 测试 — 验证 Project CRUD 链路
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import requests

BASE = "http://localhost:8000"
HEADERS = {"X-User": "test"}
TEMPLATE_ID = "aad01ef8b9ef5c349ea879818e3ba2bd"
test_project_id = None

tests = []
passed = 0
failed = 0

def test(msg: str):
    def dec(fn):
        tests.append((msg, fn))
        return fn
    return dec


@test("1. GET /templates")
def _1():
    r = requests.get(f"{BASE}/templates")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert data[0]["name"] == "生产项目模板"


@test("2. GET /customers")
def _2():
    r = requests.get(f"{BASE}/customers")
    assert r.status_code == 200
    assert len(r.json()) >= 100


@test("3. GET /projects")
def _3():
    r = requests.get(f"{BASE}/projects")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 100
    p = data[0]
    assert "order_no" in p
    assert "phases" in p
    assert "team" in p
    assert "equipment_category" in p
    assert len(p["phases"]) >= 3


@test("4. GET /projects?customer_code=美尔斯")
def _4():
    r = requests.get(f"{BASE}/projects?customer_code=美尔斯")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert data[0]["order_no"] == "1"


@test("5. POST /projects (with template)")
def _5():
    global test_project_id
    body = {
        "order_no": "test-999",
        "template_id": TEMPLATE_ID,
        "equipment_spec": "1台测试设备",
        "team": [{"person_name": "测试人", "role": "测试"}],
    }
    r = requests.post(f"{BASE}/projects", json=body, headers=HEADERS)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["order_no"] == "test-999"
    assert len(data["phases"]) == 5
    assert len(data["team"]) == 1
    test_project_id = data["id"]


@test("6. GET /projects/{id}")
def _6():
    assert test_project_id
    r = requests.get(f"{BASE}/projects/{test_project_id}")
    assert r.status_code == 200
    assert r.json()["equipment_spec"] == "1台测试设备"


@test("7. PATCH /projects/{id}")
def _7():
    assert test_project_id
    r = requests.patch(
        f"{BASE}/projects/{test_project_id}",
        json={"contract_payment_progress": 0.5, "is_abnormal": True},
        headers=HEADERS,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["contract_payment_progress"] == 0.5
    assert data["is_abnormal"] is True


@test("8. POST /projects/{id}/phases")
def _8():
    assert test_project_id
    r = requests.post(
        f"{BASE}/projects/{test_project_id}/phases",
        json={"seq": 6, "phase_name": "额外测试阶段", "responsible": "测试"},
        headers=HEADERS,
    )
    assert r.status_code == 201, r.text


@test("9. GET /projects/{id}/phases")
def _9():
    assert test_project_id
    r = requests.get(f"{BASE}/projects/{test_project_id}/phases")
    assert r.status_code == 200
    assert len(r.json()) == 6


@test("10. POST incident")
def _10():
    assert test_project_id
    r = requests.get(f"{BASE}/projects/{test_project_id}/phases")
    phases = r.json()
    phase_id = phases[0]["id"]
    r2 = requests.post(
        f"{BASE}/phases/{phase_id}/incidents",
        json={"occurred_at": "2026-05-11", "category": "原因", "description": "测试事故"},
        headers=HEADERS,
    )
    assert r2.status_code == 201


@test("11. GET /projects/{id}/team")
def _11():
    assert test_project_id
    r = requests.get(f"{BASE}/projects/{test_project_id}/team")
    assert r.status_code == 200
    assert len(r.json()) == 1


@test("12. DELETE /projects/{id}")
def _12():
    assert test_project_id
    r = requests.delete(f"{BASE}/projects/{test_project_id}", headers=HEADERS)
    assert r.status_code == 204


if __name__ == "__main__":
    print("API 测试")
    print("=" * 50)
    passed = 0
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  ✓ {name}")
            passed += 1
        except Exception as e:
            print(f"  ✗ {name}: {e}")
            failed += 1
    print("=" * 50)
    print(f"通过: {passed}/{passed+failed}")
    if failed:
        sys.exit(1)

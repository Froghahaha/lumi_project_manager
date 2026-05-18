"""Tests for project CRUD API."""


def test_list_projects_empty(client, auth_headers):
    resp = client.get("/projects", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_project(client, auth_headers):
    resp = client.post("/projects", json={
        "order_no": "TEST-001",
        "equipment_category": "关节",
        "equipment_quantity": 2,
        "contract_duration_days": 30,
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["order_no"] == "TEST-001"
    assert data["equipment_category"] == "关节"
    assert data["equipment_quantity"] == 2
    assert len(data["phases"]) > 0  # auto-generated from template
    assert data["phases"][0]["phase_name"] == "机械设计"


def test_create_project_with_phases(client, auth_headers):
    resp = client.post("/projects", json={
        "order_no": "TEST-002",
        "phases": [
            {"seq": 1, "phase_name": "机械设计", "responsible": "王文哲"},
            {"seq": 2, "phase_name": "生产"},
        ],
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["phases"]) == 2
    assert data["phases"][0]["responsible"] == "王文哲"


def test_get_project(client, auth_headers):
    # Create first
    create = client.post("/projects", json={"order_no": "TEST-003"}, headers=auth_headers)
    pid = create.json()["id"]

    resp = client.get(f"/projects/{pid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["order_no"] == "TEST-003"


def test_update_project(client, auth_headers):
    create = client.post("/projects", json={"order_no": "TEST-004"}, headers=auth_headers)
    pid = create.json()["id"]

    resp = client.patch(f"/projects/{pid}", json={"is_abnormal": True, "contract_payment_progress": 0.5},
                        headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_abnormal"] is True
    assert data["contract_payment_progress"] == 0.5


def test_delete_project(client, auth_headers):
    create = client.post("/projects", json={"order_no": "TEST-005"}, headers=auth_headers)
    pid = create.json()["id"]

    resp = client.delete(f"/projects/{pid}", headers=auth_headers)
    assert resp.status_code == 204

    resp = client.get(f"/projects/{pid}", headers=auth_headers)
    assert resp.status_code == 404


def test_list_projects_filter_abnormal(client, auth_headers):
    client.post("/projects", json={"order_no": "NORMAL-001"}, headers=auth_headers)
    client.post("/projects", json={"order_no": "ABNORMAL-001", "is_abnormal": True}, headers=auth_headers)

    resp = client.get("/projects?is_abnormal=true", headers=auth_headers)
    data = resp.json()
    assert len(data) == 1
    assert data[0]["order_no"] == "ABNORMAL-001"


def test_404_for_nonexistent_project(client, auth_headers):
    resp = client.get("/projects/00000000-0000-0000-0000-000000000099", headers=auth_headers)
    assert resp.status_code == 404

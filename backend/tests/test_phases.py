"""Tests for phase management API."""


def _create_project(client, auth_headers, order_no="PH-TEST"):
    resp = client.post("/projects", json={"order_no": order_no}, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()


def test_add_phase(client, auth_headers):
    proj = _create_project(client, auth_headers, "PH-TEST-01")
    pid = proj["id"]

    resp = client.post(f"/projects/{pid}/phases", json={
        "seq": 6, "phase_name": "售后", "sub_name": "培训", "responsible": "赵建国",
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["phase_name"] == "售后"
    assert data["sub_name"] == "培训"
    assert data["responsible"] == "赵建国"
    assert data["seq"] == 6


def test_list_phases(client, auth_headers):
    proj = _create_project(client, auth_headers, "PH-TEST-02")
    pid = proj["id"]

    resp = client.get(f"/projects/{pid}/phases", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    # auto-generated from template: 4 phases
    assert len(data) == 4
    assert data[0]["phase_name"] == "机械设计"
    assert data[3]["phase_name"] == "尾款"


def test_update_phase_status(client, auth_headers):
    proj = _create_project(client, auth_headers, "PH-TEST-03")
    phid = proj["phases"][0]["id"]

    resp = client.patch(f"/phases/{phid}/status", json={"status": "设计中"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "设计中"


def test_update_phase_status_invalid(client, auth_headers):
    proj = _create_project(client, auth_headers, "PH-TEST-04")
    phid = proj["phases"][0]["id"]  # 机械设计, valid: [未开始, 设计中, 图纸已下发]

    resp = client.patch(f"/phases/{phid}/status", json={"status": "已发货"}, headers=auth_headers)
    assert resp.status_code == 400  # 已发货 is not valid for 机械设计


def test_delete_phase(client, auth_headers):
    proj = _create_project(client, auth_headers, "PH-TEST-05")
    pid = proj["id"]
    phid = proj["phases"][0]["id"]

    resp = client.delete(f"/projects/{pid}/phases/{phid}", headers=auth_headers)
    assert resp.status_code == 204

    phases = client.get(f"/projects/{pid}/phases", headers=auth_headers).json()
    assert len(phases) == 3


def test_add_incident(client, auth_headers):
    proj = _create_project(client, auth_headers, "PH-TEST-06")
    phid = proj["phases"][0]["id"]

    resp = client.post(f"/phases/{phid}/incidents", json={
        "occurred_at": "2026-05-01", "category": "原因", "description": "设计变更",
    }, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.json()["description"] == "设计变更"


def test_global_phases_list(client, auth_headers):
    proj_a = _create_project(client, auth_headers, "PH-GLOBAL-01")
    proj_b = _create_project(client, auth_headers, "PH-GLOBAL-02")

    resp = client.get("/phases", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 8  # 4 per project

    # Filter by project
    resp2 = client.get(f"/phases?project_id={proj_a['id']}", headers=auth_headers)
    assert len(resp2.json()) == 4

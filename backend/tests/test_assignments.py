"""Tests for project assignment API."""


def _create_project(client, auth_headers, order_no="ASG-TEST"):
    resp = client.post("/projects", json={"order_no": order_no}, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()


def test_add_assignment(client, auth_headers):
    proj = _create_project(client, auth_headers, "ASG-01")
    pid = proj["id"]
    phid = proj["phases"][0]["id"]  # 机械设计

    resp = client.post(f"/projects/{pid}/assignments", json={
        "person_name": "王文哲", "role_code": "mechanical_designer", "phase_id": phid,
    }, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.json()["person_name"] == "王文哲"


def test_list_assignments(client, auth_headers):
    proj = _create_project(client, auth_headers, "ASG-02")
    pid = proj["id"]
    phid = proj["phases"][0]["id"]

    client.post(f"/projects/{pid}/assignments", json={
        "person_name": "王文哲", "role_code": "mechanical_designer", "phase_id": phid,
    }, headers=auth_headers)

    resp = client.get(f"/projects/{pid}/assignments", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["person_name"] == "王文哲"


def test_add_assignment_global_role(client, auth_headers):
    proj = _create_project(client, auth_headers, "ASG-03")
    pid = proj["id"]

    resp = client.post(f"/projects/{pid}/assignments", json={
        "person_name": "超级管理员", "role_code": "admin", "phase_id": None,
    }, headers=auth_headers)
    assert resp.status_code == 201


def test_remove_assignment(client, auth_headers):
    proj = _create_project(client, auth_headers, "ASG-04")
    pid = proj["id"]
    phid = proj["phases"][0]["id"]

    add = client.post(f"/projects/{pid}/assignments", json={
        "person_name": "王文哲", "role_code": "mechanical_designer", "phase_id": phid,
    }, headers=auth_headers)
    aid = add.json()["id"]

    resp = client.delete(f"/projects/{pid}/assignments/{aid}", headers=auth_headers)
    assert resp.status_code == 204

    assignments = client.get(f"/projects/{pid}/assignments", headers=auth_headers).json()
    assert len(assignments) == 0


def test_global_assignments_list(client, auth_headers):
    proj = _create_project(client, auth_headers, "ASG-05")
    pid = proj["id"]

    client.post(f"/projects/{pid}/assignments", json={
        "person_name": "王文哲", "role_code": "mechanical_designer", "phase_id": None,
    }, headers=auth_headers)

    resp = client.get(f"/assignments?person_name=王文哲", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

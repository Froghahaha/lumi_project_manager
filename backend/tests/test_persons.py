"""Tests for persons & assignments API."""


def test_list_persons(client, auth_headers):
    resp = client.get("/persons", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    names = [p["name"] for p in data]
    assert "超级管理员" in names
    assert "王文哲" in names


def test_list_persons_by_role(client, auth_headers):
    resp = client.get("/persons?role_code=mechanical_designer", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert all("mechanical_designer" in p["roles"] for p in data)
    assert any(p["name"] == "王文哲" for p in data)


def test_create_person(client, auth_headers):
    resp = client.post("/persons", json={
        "name": "测试人员", "department": "测试部", "roles": ["project_manager"],
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "测试人员"
    assert data["roles"] == ["project_manager"]


def test_create_person_duplicate(client, auth_headers):
    resp = client.post("/persons", json={
        "name": "王文哲", "department": "技术部", "roles": [],
    }, headers=auth_headers)
    assert resp.status_code == 400


def test_update_person_roles(client, auth_headers):
    # Find 王文哲
    list_resp = client.get("/persons", headers=auth_headers)
    wang = next(p for p in list_resp.json() if p["name"] == "王文哲")

    # Update: remove mechanical_designer, keep project_manager
    resp = client.patch(f"/persons/{wang['id']}", json={
        "name": "王文哲", "department": "技术部", "roles": ["project_manager"],
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["roles"] == ["project_manager"]


def test_list_roles(client, auth_headers):
    resp = client.get("/roles", headers=auth_headers)
    assert resp.status_code == 200
    codes = [r["code"] for r in resp.json()]
    assert "admin" in codes
    assert "tech_supervisor" in codes
    assert "mechanical_designer" in codes

"""Tests for auth/login API."""

import pytest


def test_login_success(client):
    resp = client.post("/login", json={"person_name": "超级管理员", "password": "123456"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["person"]["name"] == "超级管理员"
    assert data["person"]["roles"] == ["admin"]
    assert len(data["token"]) > 0


def test_login_wrong_password(client):
    resp = client.post("/login", json={"person_name": "超级管理员", "password": "wrong"})
    assert resp.status_code == 401
    assert "密码错误" in resp.text


def test_login_nonexistent_person(client):
    resp = client.post("/login", json={"person_name": "不存在的人", "password": "123456"})
    assert resp.status_code == 401
    assert "不存在" in resp.text


def test_login_tech_supervisor(client):
    resp = client.post("/login", json={"person_name": "技术主管", "password": "123456"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["person"]["roles"] == ["tech_supervisor"]

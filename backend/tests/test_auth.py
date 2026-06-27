def test_register(client):
    res = client.post("/api/auth/register", json={
        "email": "tomas@test.com",
        "username": "tomas",
        "password": "secret123",
        "nombre": "Tomas"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_register_duplicate_email(client):
    payload = {"email": "a@test.com", "username": "u1", "password": "x", "nombre": "A"}
    client.post("/api/auth/register", json=payload)
    res = client.post("/api/auth/register", json={**payload, "username": "u2"})
    assert res.status_code == 400

def test_login(client):
    client.post("/api/auth/register", json={
        "email": "b@test.com", "username": "b", "password": "pass", "nombre": "B"
    })
    res = client.post("/api/auth/login", json={"email": "b@test.com", "password": "pass"})
    assert res.status_code == 200
    assert "access_token" in res.json()

def test_login_wrong_password(client):
    client.post("/api/auth/register", json={
        "email": "c@test.com", "username": "c", "password": "right", "nombre": "C"
    })
    res = client.post("/api/auth/login", json={"email": "c@test.com", "password": "wrong"})
    assert res.status_code == 401

def test_me(client):
    client.post("/api/auth/register", json={
        "email": "d@test.com", "username": "d", "password": "p", "nombre": "D"
    })
    login = client.post("/api/auth/login", json={"email": "d@test.com", "password": "p"})
    token = login.json()["access_token"]
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "d@test.com"

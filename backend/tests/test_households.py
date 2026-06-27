import pytest


@pytest.fixture
def auth_client(client):
    """Retorna client + token para un usuario registrado."""
    client.post("/api/auth/register", json={
        "email": "a@test.com", "username": "a", "password": "p", "nombre": "A"
    })
    res = client.post("/api/auth/login", json={"email": "a@test.com", "password": "p"})
    token = res.json()["access_token"]
    return client, {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_client_b(client):
    client.post("/api/auth/register", json={
        "email": "b@test.com", "username": "b", "password": "p", "nombre": "B"
    })
    res = client.post("/api/auth/login", json={"email": "b@test.com", "password": "p"})
    token = res.json()["access_token"]
    return client, {"Authorization": f"Bearer {token}"}


def test_create_household(auth_client):
    client, headers = auth_client
    res = client.post("/api/households", json={
        "nombre": "Nuestro Depto",
        "ratio_a": 0.57,
        "nombre_display_a": "Tomas",
        "nombre_display_b": "Cata"
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["nombre"] == "Nuestro Depto"
    assert "id" in data


def test_invite_and_join(auth_client, auth_client_b):
    client, headers_a = auth_client
    _, headers_b = auth_client_b

    # A crea hogar
    h = client.post("/api/households", json={
        "nombre": "Depto", "ratio_a": 0.57,
        "nombre_display_a": "A", "nombre_display_b": "B"
    }, headers=headers_a).json()

    # A genera código
    invite = client.post(f"/api/households/{h['id']}/invite", headers=headers_a)
    assert invite.status_code == 200
    code = invite.json()["code"]
    assert len(code) == 6

    # B usa el código
    join = client.post("/api/households/join", json={"code": code}, headers=headers_b)
    assert join.status_code == 200
    assert join.json()["id"] == h["id"]


def test_join_invalid_code(auth_client_b):
    client, headers = auth_client_b
    res = client.post("/api/households/join", json={"code": "XXXXXX"}, headers=headers)
    assert res.status_code == 404


def test_invite_forbidden_for_non_member(auth_client, auth_client_b):
    client, headers_a = auth_client
    _, headers_b = auth_client_b
    # A creates a household
    h = client.post("/api/households", json={
        "nombre": "Depto", "ratio_a": 0.57,
        "nombre_display_a": "A", "nombre_display_b": "B"
    }, headers=headers_a).json()
    # B (not a member) tries to generate an invite
    res = client.post(f"/api/households/{h['id']}/invite", headers=headers_b)
    assert res.status_code == 403


def test_seed_categories_on_create(auth_client):
    client, headers = auth_client
    h = client.post("/api/households", json={
        "nombre": "Depto", "ratio_a": 0.57,
        "nombre_display_a": "A", "nombre_display_b": "B"
    }, headers=headers).json()
    cats = client.get(f"/api/households/{h['id']}/categories", headers=headers).json()
    nombres = [c["nombre"] for c in cats]
    assert "Alimentación" in nombres
    assert "Supermercado" in nombres
    assert "Comisiones/Impuestos" in nombres


def test_create_payment_method(auth_client):
    client, headers = auth_client
    h = client.post("/api/households", json={
        "nombre": "Depto", "ratio_a": 0.57,
        "nombre_display_a": "A", "nombre_display_b": "B"
    }, headers=headers).json()
    res = client.post(f"/api/households/{h['id']}/payment-methods", json={
        "tipo": "tarjeta_credito",
        "alias": "TC Compartida",
        "ultimos_digitos": "7777",
        "es_compartido": True,
        "banco": "Santander"
    }, headers=headers)
    assert res.status_code == 200
    assert res.json()["alias"] == "TC Compartida"


def test_list_payment_methods(auth_client):
    client, headers = auth_client
    h = client.post("/api/households", json={
        "nombre": "Depto", "ratio_a": 0.57,
        "nombre_display_a": "A", "nombre_display_b": "B"
    }, headers=headers).json()
    client.post(f"/api/households/{h['id']}/payment-methods", json={
        "tipo": "cuenta_corriente",
        "alias": "CuentaRut",
        "es_compartido": False,
    }, headers=headers)
    res = client.get(f"/api/households/{h['id']}/payment-methods", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_payment_method_forbidden_for_non_member(auth_client, auth_client_b):
    client, headers_a = auth_client
    _, headers_b = auth_client_b
    h = client.post("/api/households", json={
        "nombre": "Depto", "ratio_a": 0.57,
        "nombre_display_a": "A", "nombre_display_b": "B"
    }, headers=headers_a).json()
    res = client.get(f"/api/households/{h['id']}/payment-methods", headers=headers_b)
    assert res.status_code == 403


def test_create_custom_category(auth_client):
    client, headers = auth_client
    h = client.post("/api/households", json={
        "nombre": "Depto", "ratio_a": 0.57,
        "nombre_display_a": "A", "nombre_display_b": "B"
    }, headers=headers).json()
    res = client.post(f"/api/households/{h['id']}/categories", json={
        "nombre": "Deportes",
        "icono": "⚽",
    }, headers=headers)
    assert res.status_code == 200
    assert res.json()["nombre"] == "Deportes"

import pytest
from datetime import date


@pytest.fixture
def setup(client):
    """Crea 2 usuarios, 1 hogar, 1 medio de pago. Retorna (client, headers_a, headers_b, household_id, pm_id)."""
    # Registrar A
    client.post("/api/auth/register", json={"email": "a@t.com", "username": "a", "password": "p", "nombre": "A"})
    token_a = client.post("/api/auth/login", json={"email": "a@t.com", "password": "p"}).json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Registrar B
    client.post("/api/auth/register", json={"email": "b@t.com", "username": "b", "password": "p", "nombre": "B"})
    token_b = client.post("/api/auth/login", json={"email": "b@t.com", "password": "p"}).json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # A crea hogar
    h = client.post("/api/households", json={
        "nombre": "Depto", "ratio_a": 0.57, "nombre_display_a": "A", "nombre_display_b": "B"
    }, headers=headers_a).json()
    hid = h["id"]

    # B se une
    code = client.post(f"/api/households/{hid}/invite", headers=headers_a).json()["code"]
    client.post("/api/households/join", json={"code": code}, headers=headers_b)

    # Crear medio de pago
    pm = client.post(f"/api/households/{hid}/payment-methods", json={
        "tipo": "tarjeta_credito", "alias": "TC", "es_compartido": True
    }, headers=headers_a).json()

    return client, headers_a, headers_b, hid, pm["id"]


def test_create_manual_transaction(setup):
    client, headers_a, _, hid, pm_id = setup
    res = client.post(f"/api/households/{hid}/transactions", json={
        "fecha_operacion": str(date.today()),
        "descripcion_raw": "JUMBO",
        "monto": 50_000,
        "payment_method_id": pm_id,
        "es_hogar": True,
    }, headers=headers_a)
    assert res.status_code == 200
    tx = res.json()
    assert tx["monto"] == 50_000
    assert tx["descripcion_norm"] == "JUMBO"


def test_list_transactions(setup):
    client, headers_a, _, hid, pm_id = setup
    client.post(f"/api/households/{hid}/transactions", json={
        "fecha_operacion": str(date.today()),
        "descripcion_raw": "LIDER",
        "monto": 30_000,
        "payment_method_id": pm_id,
        "es_hogar": True,
    }, headers=headers_a)
    res = client.get(f"/api/households/{hid}/transactions", headers=headers_a)
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_household_isolation(setup):
    """Un usuario sin acceso al hogar no puede ver sus transacciones."""
    client, _, _, hid, _ = setup
    # Registrar un tercero
    client.post("/api/auth/register", json={"email": "c@t.com", "username": "c", "password": "p", "nombre": "C"})
    token_c = client.post("/api/auth/login", json={"email": "c@t.com", "password": "p"}).json()["access_token"]
    res = client.get(f"/api/households/{hid}/transactions", headers={"Authorization": f"Bearer {token_c}"})
    assert res.status_code == 403

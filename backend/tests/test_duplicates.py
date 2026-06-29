"""
Tests for:
  - DELETE /api/households/{hh_id}/transactions/{tx_id}  (soft-delete)
  - GET  /api/households/{hh_id}/duplicate-candidates
  - POST /api/households/{hh_id}/dismiss-duplicate       (idempotent)
"""
import pytest
from datetime import date, datetime

from models import (
    User, Household, HouseholdMember,
    PaymentMethod, Transaction, ImportBatch,
    DismissedDuplicatePair, SplitAllocation,
)
from services.text_utils import dedupe_hash
from services.id_codec import encode


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def setup(client):
    """Register 2 users, create a household, join B, create a payment method.
    Returns (client, headers_a, headers_b, hh_external_id, pm_external_id).
    """
    client.post("/api/auth/register", json={
        "email": "a@t.com", "username": "a", "password": "p", "nombre": "A"
    })
    token_a = client.post("/api/auth/login", json={"email": "a@t.com", "password": "p"}).json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    client.post("/api/auth/register", json={
        "email": "b@t.com", "username": "b", "password": "p", "nombre": "B"
    })
    token_b = client.post("/api/auth/login", json={"email": "b@t.com", "password": "p"}).json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    h = client.post("/api/households", json={
        "nombre": "Depto", "ratio_a": 0.57, "nombre_display_a": "A", "nombre_display_b": "B"
    }, headers=headers_a).json()
    hid = h["external_id"]

    code = client.post(f"/api/households/{hid}/invite", headers=headers_a).json()["code"]
    client.post("/api/households/join", json={"code": code}, headers=headers_b)

    pm = client.post(f"/api/households/{hid}/payment-methods", json={
        "tipo": "tarjeta_credito", "alias": "TC", "es_compartido": True
    }, headers=headers_a).json()

    return client, headers_a, headers_b, hid, pm["external_id"]


def _create_tx(client, headers, hid, pm_id, monto=50_000, descripcion="JUMBO"):
    """Helper to create a manual transaction via the API."""
    res = client.post(f"/api/households/{hid}/transactions", json={
        "fecha_operacion": str(date.today()),
        "descripcion_raw": descripcion,
        "monto": monto,
        "payment_method_id": pm_id,
        "es_hogar": True,
    }, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def _seed_imported_tx(db, hh_id, pm_id, payer_id, monto, fecha, descripcion="LIDER"):
    """Directly insert an imported transaction (simulates a confirmed import batch)."""
    ib = ImportBatch(
        household_id=hh_id,
        payment_method_id=pm_id,
        archivo_origen="pdf",
        estado="confirmado",
    )
    db.add(ib)
    db.flush()
    tx = Transaction(
        household_id=hh_id,
        import_batch_id=ib.id,
        payment_method_id=pm_id,
        payer_user_id=payer_id,
        fecha_operacion=fecha,
        descripcion_raw=descripcion,
        descripcion_norm=descripcion,
        monto=monto,
        tipo_movimiento="compra",
        es_hogar=True,
        es_interno=False,
        hash_dedupe=dedupe_hash(fecha, monto, descripcion),
    )
    db.add(tx)
    db.commit()
    return tx


# ---------------------------------------------------------------------------
# DELETE /api/households/{hh_id}/transactions/{tx_id}
# ---------------------------------------------------------------------------

def test_delete_transaction_returns_204(setup):
    client, headers_a, _, hid, pm_id = setup
    tx = _create_tx(client, headers_a, hid, pm_id)
    tx_id = tx["external_id"]

    res = client.delete(f"/api/households/{hid}/transactions/{tx_id}", headers=headers_a)
    assert res.status_code == 204


def test_delete_transaction_is_soft_delete(setup, db):
    client, headers_a, _, hid, pm_id = setup
    tx = _create_tx(client, headers_a, hid, pm_id)
    tx_id = tx["external_id"]

    client.delete(f"/api/households/{hid}/transactions/{tx_id}", headers=headers_a)

    # The row must still exist in the DB but have deleted_at set
    from services.id_codec import decode
    _, tx_int = decode(tx_id)
    row = db.query(Transaction).filter(Transaction.id == tx_int).first()
    assert row is not None
    assert row.deleted_at is not None


def test_delete_transaction_hidden_from_list(setup):
    client, headers_a, _, hid, pm_id = setup
    tx = _create_tx(client, headers_a, hid, pm_id)
    tx_id = tx["external_id"]

    client.delete(f"/api/households/{hid}/transactions/{tx_id}", headers=headers_a)

    txs = client.get(f"/api/households/{hid}/transactions", headers=headers_a).json()
    assert all(t["external_id"] != tx_id for t in txs)


def test_delete_transaction_404_if_not_found(setup):
    client, headers_a, _, hid, _ = setup
    fake_id = encode("tx_", 999999)
    res = client.delete(f"/api/households/{hid}/transactions/{fake_id}", headers=headers_a)
    assert res.status_code == 404


def test_delete_transaction_403_if_not_member(setup):
    client, headers_a, _, hid, pm_id = setup
    tx = _create_tx(client, headers_a, hid, pm_id)
    tx_id = tx["external_id"]

    # Register a stranger
    client.post("/api/auth/register", json={
        "email": "z@t.com", "username": "z", "password": "p", "nombre": "Z"
    })
    token_z = client.post("/api/auth/login", json={"email": "z@t.com", "password": "p"}).json()["access_token"]
    headers_z = {"Authorization": f"Bearer {token_z}"}

    res = client.delete(f"/api/households/{hid}/transactions/{tx_id}", headers=headers_z)
    assert res.status_code == 403


def test_delete_transaction_soft_deletes_split_allocations(setup, db):
    """SplitAllocation rows for the tx should also be soft-deleted."""
    client, headers_a, _, hid, pm_id = setup
    tx = _create_tx(client, headers_a, hid, pm_id)
    tx_id = tx["external_id"]

    from services.id_codec import decode
    _, tx_int = decode(tx_id)

    # Verify split allocations exist before deletion
    allocs_before = db.query(SplitAllocation).filter(
        SplitAllocation.transaction_id == tx_int,
        SplitAllocation.deleted_at.is_(None),
    ).all()
    assert len(allocs_before) > 0

    client.delete(f"/api/households/{hid}/transactions/{tx_id}", headers=headers_a)

    # Expire cache so we see the committed state
    db.expire_all()
    allocs_after = db.query(SplitAllocation).filter(
        SplitAllocation.transaction_id == tx_int,
        SplitAllocation.deleted_at.is_(None),
    ).all()
    assert len(allocs_after) == 0


# ---------------------------------------------------------------------------
# GET /api/households/{hh_id}/duplicate-candidates
# ---------------------------------------------------------------------------

def test_duplicate_candidates_empty_when_no_pairs(setup):
    client, headers_a, _, hid, _ = setup
    res = client.get(f"/api/households/{hid}/duplicate-candidates", headers=headers_a)
    assert res.status_code == 200
    assert res.json() == []


def test_duplicate_candidates_returns_pair(setup, db):
    client, headers_a, _, hid, pm_id = setup

    # Find real integer IDs from the DB
    from services.id_codec import decode
    _, hh_int = decode(hid)
    _, pm_int = decode(pm_id)

    # Get the payer's user id
    member = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == hh_int,
    ).first()
    payer_id = member.user_id

    # Create a manual transaction via API
    manual_tx = _create_tx(client, headers_a, hid, pm_id, monto=30_000, descripcion="MANUAL")
    manual_ext_id = manual_tx["external_id"]

    # Seed an imported transaction with same amount (within window)
    imported = _seed_imported_tx(db, hh_int, pm_int, payer_id, 30_000, date.today(), "IMPORTED")

    res = client.get(f"/api/households/{hid}/duplicate-candidates", headers=headers_a)
    assert res.status_code == 200
    pairs = res.json()
    assert len(pairs) >= 1

    # Check structure
    pair = pairs[0]
    assert "tx_manual" in pair
    assert "tx_importado" in pair
    assert pair["tx_manual"]["external_id"].startswith("tx_")
    assert pair["tx_importado"]["external_id"].startswith("tx_")
    assert pair["tx_manual"]["origen"] == "manual"
    assert pair["tx_importado"]["origen"] == "importado"


def test_duplicate_candidates_403_non_member(setup):
    client, _, _, hid, _ = setup
    client.post("/api/auth/register", json={
        "email": "z@t.com", "username": "z", "password": "p", "nombre": "Z"
    })
    token_z = client.post("/api/auth/login", json={"email": "z@t.com", "password": "p"}).json()["access_token"]
    res = client.get(
        f"/api/households/{hid}/duplicate-candidates",
        headers={"Authorization": f"Bearer {token_z}"},
    )
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# POST /api/households/{hh_id}/dismiss-duplicate
# ---------------------------------------------------------------------------

def test_dismiss_duplicate_creates_record(setup, db):
    client, headers_a, _, hid, pm_id = setup

    from services.id_codec import decode
    _, hh_int = decode(hid)
    _, pm_int = decode(pm_id)

    member = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == hh_int,
    ).first()
    payer_id = member.user_id

    manual_tx = _create_tx(client, headers_a, hid, pm_id, monto=20_000, descripcion="WALMART")
    manual_ext_id = manual_tx["external_id"]

    imported = _seed_imported_tx(db, hh_int, pm_int, payer_id, 20_000, date.today(), "WALMART IMP")
    imported_ext_id = encode("tx_", imported.id)

    res = client.post(
        f"/api/households/{hid}/dismiss-duplicate",
        json={
            "tx_external_id_a": manual_ext_id,
            "tx_external_id_b": imported_ext_id,
        },
        headers=headers_a,
    )
    assert res.status_code == 201
    assert res.json() == {"ok": True}

    # Confirm record in DB
    _, tx_a_int = decode(manual_ext_id)
    _, tx_b_int = decode(imported_ext_id)
    id_a, id_b = min(tx_a_int, tx_b_int), max(tx_a_int, tx_b_int)

    db.expire_all()
    record = db.query(DismissedDuplicatePair).filter(
        DismissedDuplicatePair.tx_id_a == id_a,
        DismissedDuplicatePair.tx_id_b == id_b,
        DismissedDuplicatePair.deleted_at.is_(None),
    ).first()
    assert record is not None
    assert record.household_id == hh_int


def test_dismiss_duplicate_is_idempotent(setup, db):
    """Calling dismiss twice should not create a duplicate row and should return 201."""
    client, headers_a, _, hid, pm_id = setup

    from services.id_codec import decode
    _, hh_int = decode(hid)
    _, pm_int = decode(pm_id)

    member = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == hh_int,
    ).first()
    payer_id = member.user_id

    manual_tx = _create_tx(client, headers_a, hid, pm_id, monto=15_000, descripcion="FALABELLA")
    manual_ext_id = manual_tx["external_id"]

    imported = _seed_imported_tx(db, hh_int, pm_int, payer_id, 15_000, date.today(), "FALABELLA IMP")
    imported_ext_id = encode("tx_", imported.id)

    payload = {
        "tx_external_id_a": manual_ext_id,
        "tx_external_id_b": imported_ext_id,
    }

    res1 = client.post(f"/api/households/{hid}/dismiss-duplicate", json=payload, headers=headers_a)
    res2 = client.post(f"/api/households/{hid}/dismiss-duplicate", json=payload, headers=headers_a)

    assert res1.status_code == 201
    assert res2.status_code == 201

    # Only one record in DB
    _, tx_a_int = decode(manual_ext_id)
    _, tx_b_int = decode(imported_ext_id)
    id_a, id_b = min(tx_a_int, tx_b_int), max(tx_a_int, tx_b_int)

    db.expire_all()
    count = db.query(DismissedDuplicatePair).filter(
        DismissedDuplicatePair.tx_id_a == id_a,
        DismissedDuplicatePair.tx_id_b == id_b,
        DismissedDuplicatePair.deleted_at.is_(None),
    ).count()
    assert count == 1


def test_dismiss_duplicate_excluded_from_candidates(setup, db):
    """After dismissing a pair, it should no longer appear in duplicate-candidates."""
    client, headers_a, _, hid, pm_id = setup

    from services.id_codec import decode
    _, hh_int = decode(hid)
    _, pm_int = decode(pm_id)

    member = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == hh_int,
    ).first()
    payer_id = member.user_id

    manual_tx = _create_tx(client, headers_a, hid, pm_id, monto=25_000, descripcion="PARIS")
    manual_ext_id = manual_tx["external_id"]

    imported = _seed_imported_tx(db, hh_int, pm_int, payer_id, 25_000, date.today(), "PARIS IMP")
    imported_ext_id = encode("tx_", imported.id)

    # Confirm it appears before dismissal
    before = client.get(f"/api/households/{hid}/duplicate-candidates", headers=headers_a).json()
    assert len(before) >= 1

    # Dismiss
    client.post(
        f"/api/households/{hid}/dismiss-duplicate",
        json={
            "tx_external_id_a": manual_ext_id,
            "tx_external_id_b": imported_ext_id,
        },
        headers=headers_a,
    )

    # Should no longer appear
    after = client.get(f"/api/households/{hid}/duplicate-candidates", headers=headers_a).json()
    ext_ids_after = {
        (p["tx_manual"]["external_id"], p["tx_importado"]["external_id"])
        for p in after
    }
    assert (manual_ext_id, imported_ext_id) not in ext_ids_after


def test_dismiss_duplicate_403_non_member(setup):
    client, headers_a, _, hid, pm_id = setup
    manual_tx = _create_tx(client, headers_a, hid, pm_id, monto=10_000, descripcion="TEST")
    manual_ext_id = manual_tx["external_id"]

    client.post("/api/auth/register", json={
        "email": "z@t.com", "username": "z", "password": "p", "nombre": "Z"
    })
    token_z = client.post("/api/auth/login", json={"email": "z@t.com", "password": "p"}).json()["access_token"]
    headers_z = {"Authorization": f"Bearer {token_z}"}

    res = client.post(
        f"/api/households/{hid}/dismiss-duplicate",
        json={
            "tx_external_id_a": manual_ext_id,
            "tx_external_id_b": manual_ext_id,
        },
        headers=headers_z,
    )
    assert res.status_code == 403

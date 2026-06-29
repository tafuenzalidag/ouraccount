import io
import pytest
from unittest.mock import patch
from datetime import date
from fastapi.testclient import TestClient
from main import app
from database import get_db
from models import User, Household, HouseholdMember, PaymentMethod, Category
from services.auth import get_current_user
from services.pdf_parser import ParseResult, ParsedItem, BatchMeta

client = TestClient(app)


def _make_user(db, email="tomas@test.com", username="tomas"):
    import bcrypt
    pw = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()
    u = User(email=email, username=username, password_hash=pw, nombre="Tomas")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _make_household_with_member(db, user):
    h = Household(nombre="Depto", moneda="CLP")
    db.add(h)
    db.flush()
    hm = HouseholdMember(
        household_id=h.id,
        user_id=user.id,
        ratio_default=0.57,
    )
    db.add(hm)
    pm = PaymentMethod(
        household_id=h.id,
        tipo="tarjeta_credito",
        alias="TC Compartida",
        es_compartido=True,
    )
    db.add(pm)
    cat = Category(
        household_id=h.id,
        nombre="Otros",
    )
    db.add(cat)
    db.commit()
    db.refresh(h)
    db.refresh(pm)
    return h, pm


def _fake_parse_result(household_id=None):
    item = ParsedItem(
        fecha_operacion=date(2026, 5, 15),
        descripcion_raw="MP*CASAVINTE",
        descripcion_norm="CASAVINTE",
        lugar="LAS CONDES",
        monto=45000,
        tipo_movimiento="compra",
        es_interno=False,
        es_hogar=True,
        incluido=True,
        installment=None,
        hash_dedupe="abc123" * 5 + "ab",  # 32 chars
    )
    return ParseResult(
        meta=BatchMeta(
            titular="TOMAS",
            ultimos_digitos="7777",
            periodo_desde=date(2026, 5, 1),
            periodo_hasta=date(2026, 5, 31),
            total_facturado_declarado=45000,
        ),
        items=[item],
        cuadre_ok=True,
        advertencia=None,
    )


def test_upload_pdf_creates_preview(setup_db, db):
    user = _make_user(db)
    household, pm = _make_household_with_member(db, user)

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    with patch("routers.imports.parse_pdf_bytes", return_value=_fake_parse_result()):
        resp = client.post(
            f"/api/households/{household.id}/imports",
            files={"file": ("cartola.pdf", io.BytesIO(b"%PDF fake"), "application/pdf")},
            data={"payment_method_id": pm.id},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert "batch_id" in body
    assert len(body["items"]) == 1
    assert body["items"][0]["descripcion_norm"] == "CASAVINTE"
    assert body["items"][0]["monto"] == 45000
    assert body["cuadre_ok"] is True

    app.dependency_overrides.clear()


def test_confirm_import_creates_transactions(setup_db, db):
    user = _make_user(db)
    household, pm = _make_household_with_member(db, user)

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    from models import ImportBatch
    batch = ImportBatch(
        household_id=household.id,
        payment_method_id=pm.id,
        archivo_origen="pdf",
        estado="preview",
    )
    db.add(batch)
    db.commit()

    payload = {
        "payer_user_id": user.id,
        "items": [
            {
                "fecha_operacion": "2026-05-15",
                "descripcion_raw": "MP*CASAVINTE",
                "descripcion_norm": "CASAVINTE",
                "lugar": "LAS CONDES",
                "monto": 45000,
                "tipo_movimiento": "compra",
                "es_interno": False,
                "es_hogar": True,
                "incluido": True,
                "category_id": None,
                "installment": None,
            }
        ],
    }
    resp = client.post(f"/api/imports/{batch.id}/confirm", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["transactions_created"] == 1
    assert body["duplicates_skipped"] == 0

    from models import Transaction
    txs = db.query(Transaction).filter(Transaction.import_batch_id == batch.id).all()
    assert len(txs) == 1
    assert txs[0].monto == 45000

    app.dependency_overrides.clear()


def test_confirm_skips_duplicates(setup_db, db):
    user = _make_user(db)
    household, pm = _make_household_with_member(db, user)

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    from models import ImportBatch, Transaction
    from services.text_utils import normalize_desc, dedupe_hash

    batch = ImportBatch(
        household_id=household.id,
        payment_method_id=pm.id,
        archivo_origen="pdf",
        estado="preview",
    )
    db.add(batch)

    desc_norm = normalize_desc("MP*CASAVINTE")
    hash_d = dedupe_hash(date(2026, 5, 15), 45000, desc_norm)

    existing = Transaction(
        household_id=household.id,
        payment_method_id=pm.id,
        payer_user_id=user.id,
        fecha_operacion=date(2026, 5, 15),
        descripcion_raw="MP*CASAVINTE",
        descripcion_norm=desc_norm,
        monto=45000,
        tipo_movimiento="compra",
        es_hogar=True,
        es_interno=False,
        hash_dedupe=hash_d,
    )
    db.add(existing)
    db.commit()

    payload = {
        "payer_user_id": user.id,
        "items": [
            {
                "fecha_operacion": "2026-05-15",
                "descripcion_raw": "MP*CASAVINTE",
                "descripcion_norm": "CASAVINTE",
                "lugar": None,
                "monto": 45000,
                "tipo_movimiento": "compra",
                "es_interno": False,
                "es_hogar": True,
                "incluido": True,
                "category_id": None,
                "installment": None,
            }
        ],
    }
    resp = client.post(f"/api/imports/{batch.id}/confirm", json=payload)
    assert resp.status_code == 200
    assert resp.json()["duplicates_skipped"] == 1
    assert resp.json()["transactions_created"] == 0

    app.dependency_overrides.clear()


def test_confirm_rejects_non_member_payer(setup_db, db):
    user = _make_user(db)
    household, pm = _make_household_with_member(db, user)

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    from models import ImportBatch
    batch = ImportBatch(
        household_id=household.id,
        payment_method_id=pm.id,
        archivo_origen="pdf",
        estado="preview",
    )
    db.add(batch)
    db.commit()

    payload = {
        "payer_user_id": 999999,  # non-existent integer user id
        "items": [
            {
                "fecha_operacion": "2026-05-15",
                "descripcion_raw": "MP*CASAVINTE",
                "descripcion_norm": "CASAVINTE",
                "monto": 45000,
                "tipo_movimiento": "compra",
                "es_interno": False,
                "es_hogar": True,
                "incluido": True,
            }
        ],
    }
    resp = client.post(f"/api/imports/{batch.id}/confirm", json=payload)
    assert resp.status_code == 400
    assert "payer_user_id" in resp.json()["detail"]

    app.dependency_overrides.clear()

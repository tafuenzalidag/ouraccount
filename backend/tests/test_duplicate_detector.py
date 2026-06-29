# backend/tests/test_duplicate_detector.py
from datetime import date, timedelta
from models import Transaction, ImportBatch, User, Household, HouseholdMember, PaymentMethod, Category
from services.duplicate_detector import find_fuzzy_for_import, find_all_candidates
from services.text_utils import dedupe_hash

def _seed(db):
    u = User(email="a@b.com", username="a", password_hash="x", nombre="A")
    h = Household(nombre="Casa", moneda="CLP")
    db.add_all([u, h])
    db.flush()
    pm = PaymentMethod(household_id=h.id, tipo="cuenta_corriente", alias="BCI", es_compartido=True)
    db.add(pm)
    db.flush()
    return u, h, pm

def _tx(db, h_id, pm_id, u_id, monto, fecha, import_batch_id=None):
    desc = "JUMBO"
    t = Transaction(
        household_id=h_id, payment_method_id=pm_id, payer_user_id=u_id,
        fecha_operacion=fecha, descripcion_raw=desc, descripcion_norm=desc,
        monto=monto, tipo_movimiento="compra", es_hogar=True, es_interno=False,
        hash_dedupe=dedupe_hash(fecha, monto, desc),
        import_batch_id=import_batch_id,
    )
    db.add(t)
    db.flush()
    return t

def test_find_fuzzy_for_import_detects_match(db):
    u, h, pm = _seed(db)
    manual = _tx(db, h.id, pm.id, u.id, 50000, date(2024, 1, 10))
    db.commit()

    class FakeItem:
        monto = 50000
        fecha_operacion = date(2024, 1, 12)  # 2 days later — within window
        hash_dedupe = "different_hash"

    result = find_fuzzy_for_import([FakeItem()], h.id, db)
    assert 0 in result
    assert manual.id in [t.id for t in result[0]]

def test_find_fuzzy_for_import_excludes_outside_window(db):
    u, h, pm = _seed(db)
    _tx(db, h.id, pm.id, u.id, 50000, date(2024, 1, 1))
    db.commit()

    class FakeItem:
        monto = 50000
        fecha_operacion = date(2024, 1, 8)  # 7 days later — outside window
        hash_dedupe = "different_hash"

    result = find_fuzzy_for_import([FakeItem()], h.id, db)
    assert result == {}

def test_find_fuzzy_skips_exact_hash_match(db):
    u, h, pm = _seed(db)
    fecha = date(2024, 1, 10)
    manual = _tx(db, h.id, pm.id, u.id, 50000, fecha)
    db.commit()

    class FakeItem:
        monto = 50000
        fecha_operacion = fecha
        hash_dedupe = manual.hash_dedupe  # exact match — handled elsewhere

    result = find_fuzzy_for_import([FakeItem()], h.id, db)
    assert result == {}

def test_find_all_candidates_returns_manual_vs_imported_pair(db):
    u, h, pm = _seed(db)
    ib = ImportBatch(household_id=h.id, payment_method_id=pm.id,
                     archivo_origen="pdf", estado="confirmado")
    db.add(ib)
    db.flush()
    manual = _tx(db, h.id, pm.id, u.id, 30000, date(2024, 2, 1))
    imported = _tx(db, h.id, pm.id, u.id, 30000, date(2024, 2, 2), import_batch_id=ib.id)
    db.commit()

    pairs = find_all_candidates(h.id, db)
    ids = {(min(a.id, b.id), max(a.id, b.id)) for a, b in pairs}
    assert (min(manual.id, imported.id), max(manual.id, imported.id)) in ids

def test_find_all_candidates_excludes_deleted(db):
    u, h, pm = _seed(db)
    ib = ImportBatch(household_id=h.id, payment_method_id=pm.id,
                     archivo_origen="pdf", estado="confirmado")
    db.add(ib)
    db.flush()
    from datetime import datetime
    manual = _tx(db, h.id, pm.id, u.id, 30000, date(2024, 2, 1))
    manual.deleted_at = datetime.utcnow()
    imported = _tx(db, h.id, pm.id, u.id, 30000, date(2024, 2, 2), import_batch_id=ib.id)
    db.commit()

    pairs = find_all_candidates(h.id, db)
    assert pairs == []

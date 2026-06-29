# backend/services/duplicate_detector.py
from datetime import timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models import Transaction, DismissedDuplicatePair


def find_fuzzy_for_import(items, household_id: int, db: Session, window_days: int = 3) -> dict[int, list[Transaction]]:
    result: dict[int, list[Transaction]] = {}
    for idx, item in enumerate(items):
        lo = item.fecha_operacion - timedelta(days=window_days)
        hi = item.fecha_operacion + timedelta(days=window_days)
        matches = db.query(Transaction).filter(
            Transaction.household_id == household_id,
            Transaction.monto == item.monto,
            Transaction.fecha_operacion >= lo,
            Transaction.fecha_operacion <= hi,
            Transaction.deleted_at.is_(None),
            Transaction.es_interno == False,
            Transaction.hash_dedupe != item.hash_dedupe,
        ).all()
        if matches:
            result[idx] = matches
    return result


def find_all_candidates(household_id: int, db: Session, window_days: int = 3) -> list[tuple[Transaction, Transaction]]:
    manual = db.query(Transaction).filter(
        Transaction.household_id == household_id,
        Transaction.import_batch_id.is_(None),
        Transaction.deleted_at.is_(None),
        Transaction.es_interno == False,
    ).all()

    if not manual:
        return []

    dismissed = db.query(DismissedDuplicatePair).filter(
        DismissedDuplicatePair.household_id == household_id,
        DismissedDuplicatePair.deleted_at.is_(None),
    ).all()
    dismissed_pairs = {(d.tx_id_a, d.tx_id_b) for d in dismissed}

    pairs: list[tuple[Transaction, Transaction]] = []
    for tx in manual:
        lo = tx.fecha_operacion - timedelta(days=window_days)
        hi = tx.fecha_operacion + timedelta(days=window_days)
        candidates = db.query(Transaction).filter(
            Transaction.household_id == household_id,
            Transaction.monto == tx.monto,
            Transaction.fecha_operacion >= lo,
            Transaction.fecha_operacion <= hi,
            Transaction.import_batch_id.isnot(None),
            Transaction.deleted_at.is_(None),
            Transaction.es_interno == False,
        ).all()
        for c in candidates:
            pair_key = (min(tx.id, c.id), max(tx.id, c.id))
            if pair_key not in dismissed_pairs:
                pairs.append((tx, c))
                dismissed_pairs.add(pair_key)  # avoid dupes in result

    return pairs

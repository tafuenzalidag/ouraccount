from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, Transaction, DismissedDuplicatePair, PaymentMethod
from schemas.duplicates import DuplicatePairOut, TxSnippet, DismissDuplicateIn
from services.auth import get_current_user
from services.duplicate_detector import find_all_candidates
from services.id_codec import encode, decode

router = APIRouter(prefix="/api/households", tags=["duplicates"])


def _assert_member(household_id: int, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == user.id,
        HouseholdMember.deleted_at.is_(None),
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")


def _snippet(tx: Transaction, db: Session) -> TxSnippet:
    pm = db.query(PaymentMethod).filter(PaymentMethod.id == tx.payment_method_id).first()
    return TxSnippet(
        external_id=encode("tx_", tx.id),
        fecha_operacion=tx.fecha_operacion,
        descripcion_raw=tx.descripcion_raw,
        monto=tx.monto,
        origen="importado" if tx.import_batch_id else "manual",
        payment_method_alias=pm.alias if pm else "",
    )


@router.get("/{household_id}/duplicate-candidates", response_model=list[DuplicatePairOut])
def list_duplicate_candidates(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _assert_member(hh_int, current_user, db)
    pairs = find_all_candidates(hh_int, db)
    return [
        DuplicatePairOut(tx_manual=_snippet(a, db), tx_importado=_snippet(b, db))
        for a, b in pairs
    ]


@router.post("/{household_id}/dismiss-duplicate", status_code=201)
def dismiss_duplicate(
    household_id: str,
    req: DismissDuplicateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _assert_member(hh_int, current_user, db)
    _, tx_a_int = decode(req.tx_external_id_a)
    _, tx_b_int = decode(req.tx_external_id_b)

    # Verify both transactions belong to this household
    tx_a = db.query(Transaction).filter(
        Transaction.id == tx_a_int,
        Transaction.household_id == hh_int,
        Transaction.deleted_at.is_(None),
    ).first()
    tx_b = db.query(Transaction).filter(
        Transaction.id == tx_b_int,
        Transaction.household_id == hh_int,
        Transaction.deleted_at.is_(None),
    ).first()
    if not tx_a or not tx_b:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")

    id_a, id_b = min(tx_a_int, tx_b_int), max(tx_a_int, tx_b_int)
    existing = db.query(DismissedDuplicatePair).filter(
        DismissedDuplicatePair.tx_id_a == id_a,
        DismissedDuplicatePair.tx_id_b == id_b,
        DismissedDuplicatePair.deleted_at.is_(None),
    ).first()
    if existing:
        return {"ok": True}
    db.add(DismissedDuplicatePair(
        household_id=hh_int,
        tx_id_a=id_a,
        tx_id_b=id_b,
        dismissed_by=current_user.id,
    ))
    db.commit()
    return {"ok": True}

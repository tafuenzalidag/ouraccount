from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, PaymentMethod, Transaction, ImportBatch
from schemas.payment_method import PaymentMethodCreate, PaymentMethodOut
from services.auth import get_current_user
from services.id_codec import encode, decode

router = APIRouter(prefix="/api/households", tags=["payment-methods"])


def _assert_member(hh_int: int, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == hh_int,
        HouseholdMember.user_id == user.id,
        HouseholdMember.deleted_at.is_(None),
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")
    return m


def _pm_out(pm: PaymentMethod) -> dict:
    return {
        "external_id": encode("pm_", pm.id),
        "tipo": pm.tipo,
        "alias": pm.alias,
        "ultimos_digitos": pm.ultimos_digitos,
        "es_compartido": pm.es_compartido,
        "banco": pm.banco,
        "owner_user_id": encode("us_", pm.owner_user_id) if pm.owner_user_id else None,
    }


@router.get("/{household_id}/payment-methods", response_model=list[PaymentMethodOut])
def list_payment_methods(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _assert_member(hh_int, current_user, db)
    pms = db.query(PaymentMethod).filter(
        PaymentMethod.household_id == hh_int,
        PaymentMethod.deleted_at.is_(None),
    ).all()
    return [_pm_out(pm) for pm in pms]


@router.post("/{household_id}/payment-methods", response_model=PaymentMethodOut)
def create_payment_method(
    household_id: str,
    req: PaymentMethodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _assert_member(hh_int, current_user, db)

    owner_user_id_int = None
    if req.owner_user_id:
        _, owner_user_id_int = decode(req.owner_user_id)

    pm = PaymentMethod(
        household_id=hh_int,
        tipo=req.tipo,
        alias=req.alias,
        ultimos_digitos=req.ultimos_digitos,
        es_compartido=req.es_compartido,
        banco=req.banco,
        owner_user_id=owner_user_id_int,
    )
    db.add(pm)
    db.commit()
    db.refresh(pm)
    return _pm_out(pm)


@router.delete("/{household_id}/payment-methods/{payment_method_id}")
def delete_payment_method(
    household_id: str,
    payment_method_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _, pm_int = decode(payment_method_id)
    _assert_member(hh_int, current_user, db)
    pm = db.query(PaymentMethod).filter(
        PaymentMethod.id == pm_int,
        PaymentMethod.household_id == hh_int,
        PaymentMethod.deleted_at.is_(None),
    ).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Medio de pago no encontrado")
    if db.query(Transaction).filter(Transaction.payment_method_id == pm_int, Transaction.deleted_at.is_(None)).first():
        raise HTTPException(
            status_code=409,
            detail="Este medio de pago tiene transacciones asociadas y no puede eliminarse",
        )
    if db.query(ImportBatch).filter(ImportBatch.payment_method_id == pm_int, ImportBatch.deleted_at.is_(None)).first():
        raise HTTPException(
            status_code=409,
            detail="Este medio de pago tiene importaciones asociadas y no puede eliminarse",
        )
    pm.deleted_at = datetime.utcnow()
    db.commit()
    return {"ok": True}

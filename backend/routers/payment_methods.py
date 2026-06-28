from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, PaymentMethod, Transaction, ImportBatch
from schemas.payment_method import PaymentMethodCreate, PaymentMethodOut
from services.auth import get_current_user

router = APIRouter(prefix="/api/households", tags=["payment-methods"])


def _assert_member(household_id: str, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")
    return m


@router.get("/{household_id}/payment-methods", response_model=list[PaymentMethodOut])
def list_payment_methods(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_member(household_id, current_user, db)
    return db.query(PaymentMethod).filter(PaymentMethod.household_id == household_id).all()


@router.post("/{household_id}/payment-methods", response_model=PaymentMethodOut)
def create_payment_method(
    household_id: str,
    req: PaymentMethodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_member(household_id, current_user, db)
    pm = PaymentMethod(household_id=household_id, **req.model_dump())
    db.add(pm)
    db.commit()
    db.refresh(pm)
    return pm


@router.delete("/{household_id}/payment-methods/{payment_method_id}")
def delete_payment_method(
    household_id: str,
    payment_method_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_member(household_id, current_user, db)
    pm = db.query(PaymentMethod).filter(
        PaymentMethod.id == payment_method_id,
        PaymentMethod.household_id == household_id,
    ).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Medio de pago no encontrado")
    if db.query(Transaction).filter(Transaction.payment_method_id == payment_method_id).first():
        raise HTTPException(
            status_code=409,
            detail="Este medio de pago tiene transacciones asociadas y no puede eliminarse",
        )
    if db.query(ImportBatch).filter(ImportBatch.payment_method_id == payment_method_id).first():
        raise HTTPException(
            status_code=409,
            detail="Este medio de pago tiene importaciones asociadas y no puede eliminarse",
        )
    db.delete(pm)
    db.commit()
    return {"ok": True}

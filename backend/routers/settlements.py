from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, Settlement
from schemas.settlement import SettlementOut, SettlementPeriodOut
from services.auth import get_current_user
from services.split import compute_settlement

router = APIRouter(tags=["settlements"])


def _assert_member(household_id: str, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")


@router.get("/api/households/{household_id}/settlement", response_model=SettlementPeriodOut)
def get_settlement(
    household_id: str,
    desde: date,
    hasta: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_member(household_id, current_user, db)
    result = compute_settlement(household_id, desde, hasta, db)
    deudor_id, acreedor_id, monto = result.settlement()

    # Look for an existing pending settlement for this period
    settlement = db.query(Settlement).filter(
        Settlement.household_id == household_id,
        Settlement.periodo_desde == desde,
        Settlement.periodo_hasta == hasta,
        Settlement.estado == "pendiente",
    ).first()

    if not settlement and monto > 0:
        settlement = Settlement(
            household_id=household_id,
            periodo_desde=desde,
            periodo_hasta=hasta,
            deudor_user_id=deudor_id,
            acreedor_user_id=acreedor_id,
            monto=monto,
        )
        db.add(settlement)
        db.commit()
        db.refresh(settlement)

    return SettlementPeriodOut(
        settlement=settlement,
        pagado=result.pagado,
        debido=result.debido,
        balance=result.balance,
    )


@router.post("/api/settlements/{settlement_id}/pay", response_model=SettlementOut)
def pay_settlement(
    settlement_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(Settlement).filter(Settlement.id == settlement_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    _assert_member(s.household_id, current_user, db)
    s.estado = "pagado"
    s.pagado_en = date.today()
    db.commit()
    db.refresh(s)
    return s

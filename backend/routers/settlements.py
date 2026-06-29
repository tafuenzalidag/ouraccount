from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, Settlement
from schemas.settlement import SettlementOut, SettlementPeriodOut
from services.auth import get_current_user
from services.id_codec import encode, decode
from services.split import compute_settlement

router = APIRouter(tags=["settlements"])


def _assert_member(hh_int: int, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == hh_int,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")


def _settlement_out(s: Settlement) -> dict:
    return {
        "external_id": encode("set_", s.id),
        "deudor_user_id": encode("us_", s.deudor_user_id),
        "acreedor_user_id": encode("us_", s.acreedor_user_id),
        "monto": s.monto,
        "estado": s.estado,
        "periodo_desde": s.periodo_desde,
        "periodo_hasta": s.periodo_hasta,
        "pagado_en": s.pagado_en,
    }


@router.get("/api/households/{household_id}/settlement", response_model=SettlementPeriodOut)
def get_settlement(
    household_id: str,
    desde: date,
    hasta: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _assert_member(hh_int, current_user, db)
    result = compute_settlement(hh_int, desde, hasta, db)
    deudor_id, acreedor_id, monto = result.settlement()

    # Look for an existing pending settlement for this period
    settlement = db.query(Settlement).filter(
        Settlement.household_id == hh_int,
        Settlement.periodo_desde == desde,
        Settlement.periodo_hasta == hasta,
        Settlement.estado == "pendiente",
    ).first()

    if settlement:
        if monto > 0:
            settlement.deudor_user_id = deudor_id
            settlement.acreedor_user_id = acreedor_id
            settlement.monto = monto
            db.commit()
            db.refresh(settlement)
        else:
            db.delete(settlement)
            db.commit()
            settlement = None
    elif monto > 0:
        settlement = Settlement(
            household_id=hh_int,
            periodo_desde=desde,
            periodo_hasta=hasta,
            deudor_user_id=deudor_id,
            acreedor_user_id=acreedor_id,
            monto=monto,
        )
        db.add(settlement)
        db.commit()
        db.refresh(settlement)

    pagado_enc = {encode("us_", k): v for k, v in result.pagado.items()}
    debido_enc = {encode("us_", k): v for k, v in result.debido.items()}
    balance_enc = {encode("us_", k): v for k, v in result.balance.items()}

    return {
        "settlement": _settlement_out(settlement) if settlement else None,
        "pagado": pagado_enc,
        "debido": debido_enc,
        "balance": balance_enc,
    }


@router.post("/api/settlements/{settlement_id}/pay", response_model=SettlementOut)
def pay_settlement(
    settlement_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, set_int = decode(settlement_id)
    s = db.query(Settlement).filter(
        Settlement.id == set_int,
        Settlement.deleted_at.is_(None),
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    _assert_member(s.household_id, current_user, db)
    s.estado = "pagado"
    s.pagado_en = date.today()
    db.commit()
    db.refresh(s)
    return _settlement_out(s)

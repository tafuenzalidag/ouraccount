import hashlib
import re
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, Transaction, PaymentMethod, Category
from schemas.transaction import TransactionCreate, TransactionOut
from services.auth import get_current_user
from services.split import compute_split

router = APIRouter(prefix="/api/households", tags=["transactions"])

GATEWAY_PREFIXES = re.compile(
    r"^(MP\*|MERCADOPAGO\*|MERPAGO\*|DP \*|FLOW \*|PedidosYa\*)",
    re.IGNORECASE,
)


def _normalize(desc: str) -> str:
    return GATEWAY_PREFIXES.sub("", desc).strip().upper()


def _dedupe_hash(fecha: date, monto: int, desc_norm: str) -> str:
    raw = f"{fecha}|{monto}|{desc_norm}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _assert_member(household_id: str, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")


@router.get("/{household_id}/transactions", response_model=list[TransactionOut])
def list_transactions(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_member(household_id, current_user, db)
    return (
        db.query(Transaction)
        .filter(
            Transaction.household_id == household_id,
            Transaction.es_interno == False,
        )
        .order_by(Transaction.fecha_operacion.desc())
        .all()
    )


@router.post("/{household_id}/transactions", response_model=TransactionOut)
def create_transaction(
    household_id: str,
    req: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_member(household_id, current_user, db)

    pm = db.query(PaymentMethod).filter(
        PaymentMethod.id == req.payment_method_id,
        PaymentMethod.household_id == household_id,
    ).first()
    if not pm:
        raise HTTPException(status_code=400, detail="Medio de pago inválido")

    if req.category_id:
        cat = db.query(Category).filter(
            Category.id == req.category_id,
            Category.household_id == household_id,
        ).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Categoría inválida")

    desc_norm = _normalize(req.descripcion_raw)
    hash_d = _dedupe_hash(req.fecha_operacion, req.monto, desc_norm)

    tx = Transaction(
        household_id=household_id,
        payment_method_id=req.payment_method_id,
        payer_user_id=current_user.id,
        category_id=req.category_id,
        fecha_operacion=req.fecha_operacion,
        descripcion_raw=req.descripcion_raw,
        descripcion_norm=desc_norm,
        lugar=req.lugar,
        monto=req.monto,
        tipo_movimiento="compra" if req.monto >= 0 else "abono",
        es_hogar=req.es_hogar,
        es_interno=False,
        split_override=req.split_override,
        hash_dedupe=hash_d,
    )
    db.add(tx)
    db.flush()  # ensures tx.id is available for SplitAllocation FKs

    members = (
        db.query(HouseholdMember)
        .filter(
            HouseholdMember.household_id == household_id,
            HouseholdMember.user_id.isnot(None),
        )
        .all()
    )
    compute_split(tx, members, db)

    db.commit()
    db.refresh(tx)
    return tx

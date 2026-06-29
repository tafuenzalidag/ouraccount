from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, Transaction, PaymentMethod, Category
from schemas.transaction import TransactionCreate, TransactionOut
from services.auth import get_current_user
from services.id_codec import encode, decode
from services.split import compute_split
from services.text_utils import normalize_desc, dedupe_hash

router = APIRouter(prefix="/api/households", tags=["transactions"])


def _assert_member(hh_int: int, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == hh_int,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")


def _tx_out(tx: Transaction) -> dict:
    return {
        "external_id": encode("tx_", tx.id),
        "fecha_operacion": tx.fecha_operacion,
        "descripcion_raw": tx.descripcion_raw,
        "descripcion_norm": tx.descripcion_norm,
        "monto": tx.monto,
        "es_hogar": tx.es_hogar,
        "tipo_movimiento": tx.tipo_movimiento,
        "category_id": encode("cat_", tx.category_id) if tx.category_id else None,
        "payer_user_id": encode("us_", tx.payer_user_id),
        "payment_method_id": encode("pm_", tx.payment_method_id),
    }


@router.get("/{household_id}/transactions", response_model=list[TransactionOut])
def list_transactions(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _assert_member(hh_int, current_user, db)
    txs = (
        db.query(Transaction)
        .filter(
            Transaction.household_id == hh_int,
            Transaction.es_interno == False,
            Transaction.deleted_at.is_(None),
        )
        .order_by(Transaction.fecha_operacion.desc())
        .all()
    )
    return [_tx_out(tx) for tx in txs]


@router.post("/{household_id}/transactions", response_model=TransactionOut)
def create_transaction(
    household_id: str,
    req: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _assert_member(hh_int, current_user, db)

    _, pm_int = decode(req.payment_method_id)
    pm = db.query(PaymentMethod).filter(
        PaymentMethod.id == pm_int,
        PaymentMethod.household_id == hh_int,
    ).first()
    if not pm:
        raise HTTPException(status_code=400, detail="Medio de pago inválido")

    cat_int = None
    if req.category_id:
        _, cat_int = decode(req.category_id)
        cat = db.query(Category).filter(
            Category.id == cat_int,
            Category.household_id == hh_int,
        ).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Categoría inválida")

    desc_norm = normalize_desc(req.descripcion_raw)
    hash_d = dedupe_hash(req.fecha_operacion, req.monto, desc_norm)

    tx = Transaction(
        household_id=hh_int,
        payment_method_id=pm_int,
        payer_user_id=current_user.id,
        category_id=cat_int,
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
            HouseholdMember.household_id == hh_int,
            HouseholdMember.user_id.isnot(None),
        )
        .all()
    )
    compute_split(tx, members, db)

    db.commit()
    db.refresh(tx)
    return _tx_out(tx)

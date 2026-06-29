import secrets
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, Household, HouseholdMember
from schemas.household import HouseholdCreate, HouseholdOut, InviteOut, JoinRequest
from services.auth import get_current_user
from services.id_codec import encode, decode
from services.seed_categories import seed_categories

router = APIRouter(prefix="/api/households", tags=["households"])


def _generate_code(length=6):
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _hh_out(h: Household) -> dict:
    return {
        "external_id": encode("hh_", h.id),
        "nombre": h.nombre,
        "moneda": h.moneda,
    }


def _assert_member(hh_int: int, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == hh_int,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")
    return m


@router.post("", response_model=HouseholdOut)
def create_household(
    req: HouseholdCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not (0 < req.ratio_a < 1):
        raise HTTPException(status_code=400, detail="ratio_a debe estar entre 0 y 1")
    h = Household(nombre=req.nombre)
    db.add(h)
    db.flush()
    member = HouseholdMember(
        household_id=h.id,
        user_id=current_user.id,
        ratio_default=req.ratio_a,
        nombre_display=req.nombre_display_a,
    )
    db.add(member)
    db.commit()
    seed_categories(h.id, db)
    db.refresh(h)
    return _hh_out(h)


@router.post("/join", response_model=HouseholdOut)
def join(
    req: JoinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    slot = db.query(HouseholdMember).filter(
        HouseholdMember.invite_code == req.code,
        HouseholdMember.user_id == None,
    ).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Código inválido o expirado")
    already = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == slot.household_id,
        HouseholdMember.user_id == current_user.id,
    ).first()
    if already:
        raise HTTPException(status_code=400, detail="Ya eres miembro de este hogar")
    slot.user_id = current_user.id
    slot.invite_code = None
    db.commit()
    h = db.query(Household).filter(Household.id == slot.household_id).first()
    return _hh_out(h)


@router.post("/{household_id}/invite", response_model=InviteOut)
def invite(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    member = _assert_member(hh_int, current_user, db)
    code = _generate_code()
    slot = HouseholdMember(
        household_id=hh_int,
        user_id=None,
        ratio_default=round(1.0 - float(member.ratio_default), 4),
        invite_code=code,
    )
    db.add(slot)
    db.commit()
    return InviteOut(code=code)


@router.get("/{household_id}", response_model=HouseholdOut)
def get_household(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _assert_member(hh_int, current_user, db)
    h = db.query(Household).filter(
        Household.id == hh_int,
        Household.deleted_at.is_(None),
    ).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hogar no encontrado")
    return _hh_out(h)


@router.get("/{household_id}/members")
def get_members(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _assert_member(hh_int, current_user, db)
    members = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == hh_int,
        HouseholdMember.user_id != None,
        HouseholdMember.deleted_at.is_(None),
    ).all()
    users = {
        u.id: u
        for u in db.query(User).filter(User.id.in_([m.user_id for m in members])).all()
    }
    return [
        {
            "user_id": encode("us_", m.user_id),
            "nombre_display": m.nombre_display or users[m.user_id].nombre,
            "ratio_default": float(m.ratio_default),
        }
        for m in members
    ]

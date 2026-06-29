from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, Category
from schemas.category import CategoryCreate, CategoryOut
from services.auth import get_current_user
from services.id_codec import encode, decode

router = APIRouter(prefix="/api/households", tags=["categories"])


def _assert_member(hh_int: int, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == hh_int,
        HouseholdMember.user_id == user.id,
        HouseholdMember.deleted_at.is_(None),
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")


def _cat_out(cat: Category) -> dict:
    return {
        "external_id": encode("cat_", cat.id),
        "nombre": cat.nombre,
        "parent_id": encode("cat_", cat.parent_id) if cat.parent_id else None,
        "icono": cat.icono,
        "color": cat.color,
    }


@router.get("/{household_id}/categories", response_model=list[CategoryOut])
def list_categories(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _assert_member(hh_int, current_user, db)
    cats = db.query(Category).filter(
        Category.household_id == hh_int,
        Category.deleted_at.is_(None),
    ).all()
    return [_cat_out(cat) for cat in cats]


@router.post("/{household_id}/categories", response_model=CategoryOut)
def create_category(
    household_id: str,
    req: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _, hh_int = decode(household_id)
    _assert_member(hh_int, current_user, db)

    parent_id_int = None
    if req.parent_id:
        _, parent_id_int = decode(req.parent_id)

    cat = Category(
        household_id=hh_int,
        nombre=req.nombre,
        parent_id=parent_id_int,
        icono=req.icono,
        color=req.color,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return _cat_out(cat)

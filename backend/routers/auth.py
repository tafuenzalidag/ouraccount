from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserOut
from services.auth import hash_password, verify_password, create_token, get_current_user
from services.id_codec import encode

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_out(user: User) -> dict:
    return {
        "external_id": encode("us_", user.id),
        "email": user.email,
        "username": user.username,
        "nombre": user.nombre,
    }


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email ya registrado")
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username ya tomado")
    user = User(
        email=req.email,
        username=req.username,
        password_hash=hash_password(req.password),
        nombre=req.nombre,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "access_token": create_token(user.id),
        "token_type": "bearer",
        "user": _user_out(user),
    }


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    return {
        "access_token": create_token(user.id),
        "token_type": "bearer",
        "user": _user_out(user),
    }


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return _user_out(current_user)

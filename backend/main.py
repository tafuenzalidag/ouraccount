from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers import auth, households, payment_methods, categories, transactions, settlements, imports, duplicates

app = FastAPI(title="NuestraCuenta API", version="0.1.0")


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})

import os as _os
_origins = _os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(households.router)
app.include_router(payment_methods.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(settlements.router)
app.include_router(imports.router)
app.include_router(duplicates.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}

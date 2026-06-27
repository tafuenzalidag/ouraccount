from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, households, payment_methods, categories

app = FastAPI(title="NuestraCuenta API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(households.router)
app.include_router(payment_methods.router)
app.include_router(categories.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}

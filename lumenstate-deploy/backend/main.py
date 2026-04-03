"""
LUMENSTATE API - Backend con FastAPI y Machine Learning
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import joblib
import os
from typing import Optional

app = FastAPI(title="LUMENSTATE API", version="1.0.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.joblib')
model_data = None
pipeline = None
feature_cols = None

@app.on_event("startup")
async def load_model():
    global model_data, pipeline, feature_cols
    if not os.path.exists(MODEL_PATH):
        from train_model import entrenar_modelo
        entrenar_modelo()
    
    model_data = joblib.load(MODEL_PATH)
    pipeline = model_data['pipeline']
    feature_cols = model_data['feature_cols']

class PredictionInput(BaseModel):
    altura_edificios_m: float
    distancia_edificios_m: float
    orientacion_grados: float
    horas_sol_directo: float
    lux_promedio_diario: Optional[float] = None
    factor_estacional: float = 1.0

class PredictionOutput(BaseModel):
    salud_biologica_pct: float
    estado: str
    lux_calculado: float
    privacion_luminica: float
    modelo_r2: float

@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": pipeline is not None}

@app.post("/predict", response_model=PredictionOutput)
async def predict(input_data: PredictionInput):
    try:
        if input_data.lux_promedio_diario is None:
            altura = input_data.altura_edificios_m
            distancia = max(input_data.distancia_edificios_m, 1)
            factor_ori = 0.7 + 0.3 * np.cos(np.radians(input_data.orientacion_grados - 180))
            angulo = np.degrees(np.arctan(altura / distancia))
            factor_bloq = max(0.1, 1 - (angulo / 90))
            lux = input_data.horas_sol_directo * factor_bloq * factor_ori * 8000 * input_data.factor_estacional
        else:
            lux = input_data.lux_promedio_diario
            
        features = np.array([[input_data.altura_edificios_m, input_data.distancia_edificios_m,
                              input_data.orientacion_grados, input_data.horas_sol_directo,
                              lux, input_data.factor_estacional]])
        
        salud = pipeline.predict(features)[0]
        salud = round(max(0, min(100, salud)), 2)
        
        if lux >= 10000: estado = "Óptimo"
        elif lux >= 2000: estado = "Aceptable"
        elif lux >= 500: estado = "Deficiente"
        else: estado = "Crítico"
        
        return PredictionOutput(
            salud_biologica_pct=salud, estado=estado, lux_calculado=round(lux, 2),
            privacion_luminica=round(max(0, 1 - (lux / 10000)), 3),
            modelo_r2=round(model_data['metrics']['r2_mean'], 4)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
"""
LUMENSTATE API - Backend con FastAPI y Machine Learning
Servidor que expone endpoints para predicciones del modelo ML.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import joblib
import os
from typing import Optional

# Inicializar app
app = FastAPI(
    title="LUMENSTATE API",
    description="API para predicción de impacto biológico de la privación lumínica",
    version="1.0.0"
)

# Configurar CORS para permitir requests del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción: especificar dominio del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cargar modelo al iniciar
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.joblib')
model_data = None
pipeline = None
feature_cols = None

@app.on_event("startup")
async def load_model():
    """Carga el modelo al iniciar el servidor."""
    global model_data, pipeline, feature_cols
    
    if not os.path.exists(MODEL_PATH):
        print("Modelo no encontrado. Entrenando nuevo modelo...")
        from train_model import entrenar_modelo
        entrenar_modelo()
    
    model_data = joblib.load(MODEL_PATH)
    pipeline = model_data['pipeline']
    feature_cols = model_data['feature_cols']
    print(f"Modelo cargado correctamente. R2 = {model_data['metrics']['r2_mean']:.4f}")


# Modelos de datos para la API
class PredictionInput(BaseModel):
    """Input para predicción."""
    altura_edificios_m: float
    distancia_edificios_m: float
    orientacion_grados: float
    horas_sol_directo: float
    lux_promedio_diario: Optional[float] = None
    factor_estacional: float = 1.0

class PredictionOutput(BaseModel):
    """Output de predicción."""
    salud_biologica_pct: float
    estado: str
    lux_calculado: float
    privacion_luminica: float
    modelo_r2: float

class ComparativeOutput(BaseModel):
    """Output de comparación de escenarios."""
    escenario_garantizado: dict
    escenario_restringido: dict
    deficit_vital: float
    porcentaje_vulneracion: float


def calcular_lux(params: PredictionInput) -> float:
    """Calcula el lux promedio basándose en los parámetros urbanos."""
    altura = params.altura_edificios_m
    distancia = max(params.distancia_edificios_m, 1)
    orientacion = params.orientacion_grados
    horas_sol = params.horas_sol_directo
    
    # Factor de orientación (Sur = mejor en hemisferio norte)
    factor_orientacion = 0.7 + 0.3 * np.cos(np.radians(orientacion - 180))
    
    # Ángulo de sombra
    angulo_sombra = np.degrees(np.arctan(altura / distancia))
    
    # Factor de bloqueo
    factor_bloqueo = max(0.1, 1 - (angulo_sombra / 90))
    
    # Lux promedio
    lux = horas_sol * factor_bloqueo * factor_orientacion * 8000 * params.factor_estacional
    
    return round(lux, 2)


def determinar_estado(salud: float, lux: float) -> str:
    """Determina el estado de salud lumínica."""
    if lux >= 10000:
        return "Óptimo"
    elif lux >= 2000:
        return "Aceptable"
    elif lux >= 500:
        return "Deficiente"
    else:
        return "Crítico"


@app.get("/")
async def root():
    """Endpoint raíz."""
    return {
        "message": "LUMENSTATE API",
        "version": "1.0.0",
        "status": "online",
        "endpoints": ["/predict", "/compare", "/health"]
    }


@app.get("/health")
async def health():
    """Health check."""
    return {
        "status": "healthy",
        "model_loaded": pipeline is not None,
        "model_r2": model_data['metrics']['r2_mean'] if model_data else None
    }


@app.post("/predict", response_model=PredictionOutput)
async def predict(input_data: PredictionInput):
    """
    Predice la salud biológica basándose en parámetros urbanos.
    
    - **altura_edificios_m**: Altura de edificios circundantes (5-50m)
    - **distancia_edificios_m**: Distancia a edificios (5-50m)
    - **orientacion_grados**: Orientación de la ventana (0-360°)
    - **horas_sol_directo**: Horas de sol base (1-12h)
    - **factor_estacional**: Factor estacional (0.7-1.3)
    """
    try:
        # Calcular lux si no se proporciona
        if input_data.lux_promedio_diario is None:
            lux = calcular_lux(input_data)
        else:
            lux = input_data.lux_promedio_diario
        
        # Preparar features para el modelo
        features = np.array([[
            input_data.altura_edificios_m,
            input_data.distancia_edificios_m,
            input_data.orientacion_grados,
            input_data.horas_sol_directo,
            lux,
            input_data.factor_estacional
        ]])
        
        # Predecir
        salud = pipeline.predict(features)[0]
        salud = round(max(0, min(100, salud)), 2)
        
        # Determinar estado
        estado = determinar_estado(salud, lux)
        
        # Calcular privación lumínica
        privacion = round(max(0, 1 - (lux / 10000)), 3)
        
        return PredictionOutput(
            salud_biologica_pct=salud,
            estado=estado,
            lux_calculado=lux,
            privacion_luminica=privacion,
            modelo_r2=round(model_data['metrics']['r2_mean'], 4)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/compare", response_model=ComparativeOutput)
async def compare():
    """
    Compara dos escenarios urbanos: Luz Garantizada vs Luz Restringida.
    """
    try:
        # Escenario Luz Garantizada
        garantizado_input = PredictionInput(
            altura_edificios_m=10,
            distancia_edificios_m=30,
            orientacion_grados=180,
            horas_sol_directo=8,
            factor_estacional=1.0
        )
        
        # Escenario Luz Restringida
        restringido_input = PredictionInput(
            altura_edificios_m=45,
            distancia_edificios_m=10,
            orientacion_grados=0,
            horas_sol_directo=3,
            factor_estacional=0.8
        )
        
        # Predecir ambos escenarios
        pred_garantizado = await predict(garantizado_input)
        pred_restringido = await predict(restringido_input)
        
        # Calcular déficit
        deficit = round(pred_garantizado.salud_biologica_pct - pred_restringido.salud_biologica_pct, 2)
        
        return ComparativeOutput(
            escenario_garantizado={
                "salud_biologica_pct": pred_garantizado.salud_biologica_pct,
                "estado": pred_garantizado.estado,
                "lux": pred_garantizado.lux_calculado,
                "parametros": garantizado_input.dict()
            },
            escenario_restringido={
                "salud_biologica_pct": pred_restringido.salud_biologica_pct,
                "estado": pred_restringido.estado,
                "lux": pred_restringido.lux_calculado,
                "parametros": restringido_input.dict()
            },
            deficit_vital=deficit,
            porcentaje_vulneracion=round((pred_restringido.salud_biologica_pct / pred_garantizado.salud_biologica_pct - 1) * -100, 1)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/model/info")
async def model_info():
    """Información del modelo."""
    return {
        "model_type": "GradientBoostingRegressor",
        "features": feature_cols,
        "metrics": model_data['metrics'] if model_data else None,
        "n_estimators": 100,
        "learning_rate": 0.1,
        "max_depth": 5
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

"""
Script para entrenar y guardar el modelo de ML de LUMENSTATE.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import cross_val_score
import joblib
import os

RANDOM_STATE = 42
np.random.seed(RANDOM_STATE)

def generar_datos_entrenamiento(n_muestras=5000):
    altura_edificios = np.random.uniform(5, 50, n_muestras)
    distancia_edificios = np.random.uniform(5, 50, n_muestras)
    orientacion = np.random.uniform(0, 360, n_muestras)
    horas_sol_base = np.random.uniform(2, 10, n_muestras)
    dia_ano = np.random.randint(1, 366, n_muestras)
    
    factor_estacional = 1 + 0.3 * np.sin(2 * np.pi * (dia_ano - 80) / 365)
    factor_orientacion = 0.7 + 0.3 * np.cos(np.radians(orientacion - 180))
    angulo_sombra = np.degrees(np.arctan(altura_edificios / np.maximum(distancia_edificios, 1)))
    factor_bloqueo = np.maximum(0.1, 1 - (angulo_sombra / 90))
    
    horas_sol_directo = horas_sol_base * factor_bloqueo * factor_orientacion
    lux = horas_sol_directo * 8000 * factor_estacional
    
    salud_base = 50
    efecto_lux = lux / 800
    variabilidad = np.random.normal(0, 3, n_muestras) + np.random.normal(0, 2, n_muestras) + np.random.normal(0, 2, n_muestras)
    salud_biologica = np.clip(salud_base + efecto_lux + variabilidad, 0, 100)
    
    return pd.DataFrame({
        'altura_edificios_m': altura_edificios, 'distancia_edificios_m': distancia_edificios,
        'orientacion_grados': orientacion, 'horas_sol_directo': horas_sol_directo,
        'lux_promedio_diario': lux, 'factor_estacional': factor_estacional,
        'salud_biologica_pct': salud_biologica
    })

def entrenar_modelo():
    print("Generando datos de entrenamiento...")
    df = generar_datos_entrenamiento(5000)
    
    feature_cols = ['altura_edificios_m', 'distancia_edificios_m', 'orientacion_grados',
                    'horas_sol_directo', 'lux_promedio_diario', 'factor_estacional']
    X = df[feature_cols]
    y = df['salud_biologica_pct']
    
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('model', GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=5, random_state=RANDOM_STATE))
    ])
    
    pipeline.fit(X, y)
    scores = cross_val_score(pipeline, X, y, cv=5, scoring='r2')
    
    model_path = os.path.join(os.path.dirname(__file__), 'model.joblib')
    joblib.dump({
        'pipeline': pipeline,
        'feature_cols': feature_cols,
        'metrics': {'r2_mean': scores.mean(), 'r2_std': scores.std()}
    }, model_path)
    
    print(f"Modelo guardado en: {model_path} | R2: {scores.mean():.4f}")

if __name__ == "__main__":
    entrenar_modelo()
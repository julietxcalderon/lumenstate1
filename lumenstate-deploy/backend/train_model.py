"""
Script para entrenar y guardar el modelo de ML de LUMENSTATE.
Este archivo se ejecuta una vez para crear el modelo serializado.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import joblib
import os

# Configuración
RANDOM_STATE = 42
np.random.seed(RANDOM_STATE)

def generar_datos_entrenamiento(n_muestras=2000):
    """Genera datos sintéticos para entrenar el modelo."""
    
    # Variables urbanas
    altura_edificios = np.random.uniform(5, 50, n_muestras)
    distancia_edificios = np.random.uniform(5, 50, n_muestras)
    orientacion = np.random.uniform(0, 360, n_muestras)
    horas_sol_base = np.random.uniform(2, 10, n_muestras)
    dia_ano = np.random.randint(1, 366, n_muestras)
    
    # Factor estacional
    factor_estacional = 1 + 0.3 * np.sin(2 * np.pi * (dia_ano - 80) / 365)
    
    # Calcular efectos urbanos
    factor_orientacion = 0.7 + 0.3 * np.cos(np.radians(orientacion - 180))
    angulo_sombra = np.degrees(np.arctan(altura_edificios / np.maximum(distancia_edificios, 1)))
    factor_bloqueo = np.maximum(0.1, 1 - (angulo_sombra / 90))
    
    # Horas de sol efectivas
    horas_sol_directo = horas_sol_base * factor_bloqueo * factor_orientacion
    
    # Calcular lux (iluminancia)
    lux = horas_sol_directo * 8000 * factor_estacional
    
    # SALUD BIOLOGICA - Relacion directa con LUX mas variabilidad natural
    salud_base = 50
    efecto_lux = lux / 800
    
    # Variabilidad biologica natural
    variabilidad_genetica = np.random.normal(0, 3, n_muestras)
    variabilidad_ambiental = np.random.normal(0, 2, n_muestras)
    ruido_aleatorio = np.random.normal(0, 2, n_muestras)
    
    # Salud biologica final
    salud_biologica = salud_base + efecto_lux + variabilidad_genetica + variabilidad_ambiental + ruido_aleatorio
    salud_biologica = np.clip(salud_biologica, 0, 100)
    
    return pd.DataFrame({
        'altura_edificios_m': np.round(altura_edificios, 2),
        'distancia_edificios_m': np.round(distancia_edificios, 2),
        'orientacion_grados': np.round(orientacion, 2),
        'horas_sol_directo': np.round(horas_sol_directo, 2),
        'lux_promedio_diario': np.round(lux, 2),
        'factor_estacional': np.round(factor_estacional, 3),
        'salud_biologica_pct': np.round(salud_biologica, 2)
    })

def entrenar_modelo():
    """Entrena y guarda el modelo."""
    print("Generando datos de entrenamiento...")
    df = generar_datos_entrenamiento(5000)
    
    # Features y target
    feature_cols = ['altura_edificios_m', 'distancia_edificios_m', 'orientacion_grados',
                    'horas_sol_directo', 'lux_promedio_diario', 'factor_estacional']
    
    X = df[feature_cols]
    y = df['salud_biologica_pct']
    
    print("Entrenando modelo Gradient Boosting...")
    
    # Crear pipeline con scaler y modelo
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('model', GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5,
            random_state=RANDOM_STATE
        ))
    ])
    
    # Entrenar
    pipeline.fit(X, y)
    
    # Evaluar
    from sklearn.model_selection import cross_val_score
    scores = cross_val_score(pipeline, X, y, cv=5, scoring='r2')
    
    print(f"\nMetricas del modelo:")
    print(f"  R2 promedio: {scores.mean():.4f} (+/- {scores.std():.4f})")
    
    # Guardar modelo
    model_path = os.path.join(os.path.dirname(__file__), 'model.joblib')
    joblib.dump({
        'pipeline': pipeline,
        'feature_cols': feature_cols,
        'metrics': {
            'r2_mean': scores.mean(),
            'r2_std': scores.std()
        }
    }, model_path)
    
    print(f"\nModelo guardado en: {model_path}")
    return pipeline

if __name__ == "__main__":
    entrenar_modelo()
    print("\nEntrenamiento completado!")

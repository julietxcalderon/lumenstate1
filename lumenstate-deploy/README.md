# LUMENSTATE - Guía de Deploy

## 📁 Estructura

```
lumenstate-deploy/
├── backend/           # API Python + Modelo ML
│   ├── main.py
│   ├── train_model.py
│   └── requirements.txt
│
├── frontend/          # Interfaz Web Next.js
│   ├── src/app/
│   ├── package.json
│   └── ...
│
└── README.md
```

---

## 🚀 DEPLOY PASO A PASO

### 1. Subir a GitHub

```bash
# Crear repositorio en github.com

# En tu computadora:
cd lumenstate-deploy
git init
git add .
git commit -m "LUMENSTATE - Proyecto completo"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/lumenstate.git
git push -u origin main
```

---

### 2. Backend en Render.com (GRATIS)

1. Ir a **render.com** → Crear cuenta
2. Click **"New +"** → **"Web Service"**
3. Conectar repositorio de GitHub
4. Configurar:

| Campo | Valor |
|-------|-------|
| Name | lumenstate-api |
| Region | Oregon |
| Branch | main |
| Root | backend |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt && python train_model.py` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |

5. Click **"Deploy"**
6. Guardar la URL: `https://lumenstate-api.onrender.com`

---

### 3. Frontend en Vercel.com (GRATIS)

1. Ir a **vercel.com** → Crear cuenta con GitHub
2. Click **"New Project"**
3. Importar repositorio
4. Configurar:

| Campo | Valor |
|-------|-------|
| Framework | Next.js |
| Root Directory | frontend |

5. Agregar variable de entorno:
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: `https://TU-API.onrender.com`

6. Click **"Deploy"**
7. Tu app: `https://lumenstate.vercel.app`

---

## ✅ Verificar

- Backend: `https://TU-API.onrender.com/health`
- Frontend: `https://TU-APP.vercel.app`

---

## 🔧 Desarrollo Local

### Backend:
```bash
cd backend
pip install -r requirements.txt
python train_model.py
uvicorn main:app --reload
# API en http://localhost:8000
```

### Frontend:
```bash
cd frontend
npm install
npm run dev
# App en http://localhost:3000
```

---

## 📊 Endpoints de la API

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/` | GET | Info API |
| `/health` | GET | Estado |
| `/predict` | POST | Predicción |
| `/compare` | POST | Comparación |

### Ejemplo `/predict`:
```json
// Request
{
  "altura_edificios_m": 25,
  "distancia_edificios_m": 20,
  "orientacion_grados": 180,
  "horas_sol_directo": 6,
  "factor_estacional": 1.0
}

// Response
{
  "salud_biologica_pct": 75.5,
  "estado": "Aceptable",
  "lux_calculado": 5500,
  "modelo_r2": 0.9103
}
```

---

**LUMENSTATE - Talento Tech 2026**

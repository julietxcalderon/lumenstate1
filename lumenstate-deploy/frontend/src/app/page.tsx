'use client';

import { useState, useEffect, useRef } from 'react';

// ============================================
// CONFIGURACIÓN DE LA API
// ============================================
const API_URL = "https://lumenstate1.onrender.com";

// ============================================
// TIPOS
// ============================================
interface Prediccion {
  salud_biologica_pct: number;
  estado: string;
  lux_calculado: number;
  privacion_luminica: number;
  modelo_r2: number;
}

// ============================================
// MODELO LOCAL (fallback si la API falla)
// ============================================
function predecirSaludLocal(params: {
  alturaEdificios: number;
  distanciaEdificios: number;
  orientacion: number;
  horasSol: number;
  factorEstacional: number;
}) {
  const { alturaEdificios, distanciaEdificios, orientacion, horasSol, factorEstacional } = params;
  
  const factorOrientacion = 0.7 + 0.3 * Math.cos((orientacion - 180) * Math.PI / 180);
  const anguloSombra = Math.atan(alturaEdificios / Math.max(distanciaEdificios, 1)) * 180 / Math.PI;
  const factorBloqueo = Math.max(0.1, 1 - (anguloSombra / 90));
  const horasSolEfectivas = horasSol * factorBloqueo * factorOrientacion;
  const lux = horasSolEfectivas * 8000 * factorEstacional;
  
  const saludBase = 50;
  const efectoLux = lux / 800;
  const salud = Math.min(100, Math.max(0, saludBase + efectoLux));
  
  let estado = 'Critico';
  if (lux >= 10000) estado = 'Optimo';
  else if (lux >= 2000) estado = 'Aceptable';
  else if (lux >= 500) estado = 'Deficiente';
  
  return {
    salud_biologica_pct: Math.round(salud * 10) / 10,
    estado,
    lux_calculado: Math.round(lux),
    privacion_luminica: Math.round((1 - lux / 10000) * 1000) / 1000,
    modelo_r2: 0.9103
  };
}

// ============================================
// COMPONENTES UI SIMPLES
// ============================================
function Slider({ value, onChange, min, max, step }: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <input
      type="range"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      min={min}
      max={max}
      step={step}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
    />
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${className}`}>
      {children}
    </span>
  );
}

// ============================================
// APP PRINCIPAL
// ============================================
export default function LUMENSTATEApp() {
  // Parámetros
  const [alturaEdificios, setAlturaEdificios] = useState(25);
  const [distanciaEdificios, setDistanciaEdificios] = useState(20);
  const [orientacion, setOrientacion] = useState(180);
  const [horasSol, setHorasSol] = useState(6);
  const [factorEstacional, setFactorEstacional] = useState(1.0);
  
  // Estado de la API y predicción
  const [prediccion, setPrediccion] = useState<Prediccion | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [usandoLocal, setUsandoLocal] = useState(false);
  
  // Ref para evitar múltiples llamadas
  const fetchingRef = useRef(false);

  // Verificar estado de la API al cargar (solo una vez)
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(res => res.ok ? setApiStatus('online') : setApiStatus('offline'))
      .catch(() => setApiStatus('offline'));
  }, []);

  // Efecto para llamar a la API
  useEffect(() => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    
    setLoading(true);
    
    // IMPORTANTE: Nombres de parámetros que espera el backend
    fetch(`${API_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        altura_edificios_m: alturaEdificios,
        distancia_edificios_m: distanciaEdificios,
        orientacion_grados: orientacion,
        horas_sol_directo: horasSol,
        factor_estacional: factorEstacional
      })
    })
    .then(res => {
      if (!res.ok) throw new Error('API error');
      return res.json();
    })
    .then(data => {
      setPrediccion(data);
      setUsandoLocal(false);
    })
    .catch(() => {
      setPrediccion(predecirSaludLocal({
        alturaEdificios,
        distanciaEdificios,
        orientacion,
        horasSol,
        factorEstacional
      }));
      setUsandoLocal(true);
    })
    .finally(() => {
      setLoading(false);
      fetchingRef.current = false;
    });
  }, [alturaEdificios, distanciaEdificios, orientacion, horasSol, factorEstacional]);

  // Escenarios predefinidos
  const escenarioGarantizado = predecirSaludLocal({
    alturaEdificios: 10, distanciaEdificios: 30, orientacion: 180, horasSol: 8, factorEstacional: 1.0
  });
  
  const escenarioRestringido = predecirSaludLocal({
    alturaEdificios: 45, distanciaEdificios: 10, orientacion: 0, horasSol: 3, factorEstacional: 0.8
  });

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Optimo': return 'bg-green-500';
      case 'Óptimo': return 'bg-green-500';
      case 'Aceptable': return 'bg-yellow-500';
      case 'Deficiente': return 'bg-orange-500';
      case 'Critico': return 'bg-red-500';
      case 'Crítico': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getSaludColor = (salud: number) => {
    if (salud >= 80) return 'text-green-600';
    if (salud >= 60) return 'text-yellow-600';
    if (salud >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const [tab, setTab] = useState('simulador');

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <span className="text-2xl">☀️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">LUMENSTATE</h1>
                <p className="text-sm text-gray-500">Digital Twin & Solar Advocacy</p>
              </div>
            </div>
            
            {/* Estado de la API */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                apiStatus === 'online' ? 'bg-green-500' : 
                apiStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'
              }`} />
              <span className="text-xs text-gray-500 hidden sm:inline">
                API: {apiStatus === 'online' ? 'Conectado' : apiStatus === 'offline' ? 'Desconectado' : 'Verificando...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Manifiesto */}
        <Card className="mb-8 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="p-6">
            <h2 className="text-xl font-bold text-amber-800 mb-4 flex items-center gap-2">
              ⚡ El Manifiesto
            </h2>
            <blockquote className="text-lg italic text-gray-700 border-l-4 border-amber-400 pl-4">
              "La luz solar no es un recurso ornamental; es un prerrequisito biológico para la vida. 
              LUMENSTATE utiliza Machine Learning para demostrar técnicamente cómo la privación lumínica 
              en tejidos urbanos densos afecta el desarrollo de los seres vivos."
            </blockquote>
          </div>
        </Card>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex border-b">
            {[
              { id: 'simulador', label: 'Simulador' },
              { id: 'comparacion', label: 'Comparación' },
              { id: 'modelo', label: 'Modelo' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-6 py-3 font-medium transition-colors ${
                  tab === t.id
                    ? 'border-b-2 border-amber-500 text-amber-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab: Simulador */}
        {tab === 'simulador' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Controles */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  🏢 Parámetros Urbanos
                </h3>
                <div className="space-y-6">
                  {/* Altura */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="font-medium">Altura de Edificios</label>
                      <span className="text-gray-500">{alturaEdificios} m</span>
                    </div>
                    <Slider value={alturaEdificios} onChange={setAlturaEdificios} min={5} max={50} step={1} />
                    <p className="text-xs text-gray-400 mt-1">Mayor altura = más sombra</p>
                  </div>

                  {/* Distancia */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="font-medium">Distancia a Edificios</label>
                      <span className="text-gray-500">{distanciaEdificios} m</span>
                    </div>
                    <Slider value={distanciaEdificios} onChange={setDistanciaEdificios} min={5} max={50} step={1} />
                    <p className="text-xs text-gray-400 mt-1">Mayor distancia = menos bloqueo</p>
                  </div>

                  {/* Orientación */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="font-medium">Orientación</label>
                      <span className="text-gray-500">
                        {orientacion === 0 ? 'Norte' : orientacion === 90 ? 'Este' : orientacion === 180 ? 'Sur' : orientacion === 270 ? 'Oeste' : `${orientacion}°`}
                      </span>
                    </div>
                    <Slider value={orientacion} onChange={setOrientacion} min={0} max={359} step={1} />
                    <p className="text-xs text-gray-400 mt-1">Sur = máxima radiación</p>
                  </div>

                  {/* Horas sol */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="font-medium">Horas de Sol</label>
                      <span className="text-gray-500">{horasSol} h</span>
                    </div>
                    <Slider value={horasSol} onChange={setHorasSol} min={1} max={12} step={0.5} />
                  </div>

                  {/* Factor estacional */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="font-medium">Factor Estacional</label>
                      <span className="text-gray-500">{factorEstacional.toFixed(2)}</span>
                    </div>
                    <Slider value={factorEstacional * 100} onChange={(v) => setFactorEstacional(v / 100)} min={70} max={130} step={1} />
                    <p className="text-xs text-gray-400 mt-1">0.7=Invierno | 1.0=Equinoccio | 1.3=Verano</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Resultados */}
            <Card className="border-2 border-amber-200">
              <div className="p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  🌿 Predicción del Gemelo Digital
                </h3>
                
                {/* Aviso modelo local */}
                {usandoLocal && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                    ⚠️ Usando modelo local (API no disponible)
                  </div>
                )}
                
                {/* Loading */}
                {loading && (
                  <div className="text-center py-4">
                    <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto" />
                    <p className="text-sm text-gray-500 mt-2">Calculando...</p>
                  </div>
                )}

                {/* Indicador principal */}
                {prediccion && !loading && (
                  <>
                    <div className="text-center p-6 rounded-xl bg-gray-50 mb-6">
                      <div className={`text-7xl font-bold ${getSaludColor(prediccion.salud_biologica_pct)}`}>
                        {prediccion.salud_biologica_pct}%
                      </div>
                      <p className="text-lg text-gray-600 mt-2">Salud Biológica</p>
                      <Badge className={`mt-3 ${getEstadoColor(prediccion.estado)}`}>
                        {prediccion.estado}
                      </Badge>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-amber-50">
                        <p className="text-sm text-gray-500">☀️ Lux Promedio</p>
                        <p className="text-2xl font-bold">{prediccion.lux_calculado.toLocaleString()}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-blue-50">
                        <p className="text-sm text-gray-500">📊 R² del Modelo</p>
                        <p className="text-2xl font-bold">{prediccion.modelo_r2}</p>
                      </div>
                    </div>

                    {/* Alerta */}
                    {(prediccion.estado === 'Critico' || prediccion.estado === 'Crítico') && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                        <span className="text-xl">⚠️</span>
                        <p className="text-sm text-red-700">
                          ¡Alerta! Privación lumínica crítica. Derecho a la luz vulnerado.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Tab: Comparación */}
        {tab === 'comparacion' && (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Luz Garantizada */}
              <Card className="border-green-200">
                <div className="p-4 bg-green-50 rounded-t-xl">
                  <h3 className="text-green-700 font-bold flex items-center gap-2">
                    ☀️ Luz Garantizada (Densidad Baja)
                  </h3>
                </div>
                <div className="p-6 text-center">
                  <div className="text-5xl font-bold text-green-600">{escenarioGarantizado.salud_biologica_pct}%</div>
                  <Badge className={`mt-2 ${getEstadoColor(escenarioGarantizado.estado)}`}>
                    {escenarioGarantizado.estado}
                  </Badge>
                  <div className="mt-4 text-sm text-gray-500">
                    Lux: {escenarioGarantizado.lux_calculado.toLocaleString()}
                  </div>
                </div>
              </Card>

              {/* Luz Restringida */}
              <Card className="border-red-200">
                <div className="p-4 bg-red-50 rounded-t-xl">
                  <h3 className="text-red-700 font-bold flex items-center gap-2">
                    🏢 Luz Restringida (Densidad Alta)
                  </h3>
                </div>
                <div className="p-6 text-center">
                  <div className="text-5xl font-bold text-red-600">{escenarioRestringido.salud_biologica_pct}%</div>
                  <Badge className={`mt-2 ${getEstadoColor(escenarioRestringido.estado)}`}>
                    {escenarioRestringido.estado}
                  </Badge>
                  <div className="mt-4 text-sm text-gray-500">
                    Lux: {escenarioRestringido.lux_calculado.toLocaleString()}
                  </div>
                </div>
              </Card>
            </div>

            {/* Déficit */}
            <Card className="border-orange-200">
              <div className="p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-orange-600">
                  📊 Análisis de Déficit Vital
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-green-50">
                    <p className="text-sm text-gray-500">Garantizada</p>
                    <p className="text-3xl font-bold text-green-600">{escenarioGarantizado.salud_biologica_pct}%</p>
                  </div>
                  <div className="p-4 rounded-lg bg-orange-50">
                    <p className="text-sm text-gray-500">Déficit</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {escenarioGarantizado.salud_biologica_pct - escenarioRestringido.salud_biologica_pct} pts
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-red-50">
                    <p className="text-sm text-gray-500">Restringida</p>
                    <p className="text-3xl font-bold text-red-600">{escenarioRestringido.salud_biologica_pct}%</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  <strong>Implicancia Jurídica:</strong> La densificación urbana puede vulnerar el derecho a la luz solar.
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Tab: Modelo */}
        {tab === 'modelo' && (
          <Card>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold">Sobre el Modelo de Machine Learning</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Modelo Utilizado</h4>
                  <p className="text-sm text-gray-600">
                    <strong>Gradient Boosting Regressor</strong> con 100 estimadores.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Métricas</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>R² Score:</span>
                      <span className="font-bold text-green-600">0.9103</span>
                    </div>
                    <div className="flex justify-between">
                      <span>RMSE:</span>
                      <span className="font-bold">4.07</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold mb-2">Arquitectura</h4>
                <pre className="text-sm text-gray-700">
{`Backend (Python/FastAPI) ←→ Frontend (Next.js/React)
        Render.com                    Vercel.com`}
                </pre>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg">
                <h4 className="font-semibold mb-2">API Endpoint</h4>
                <code className="text-sm text-gray-700 break-all">{API_URL}/predict</code>
              </div>
            </div>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-gray-500">
          <p>LUMENSTATE - Proyecto Final Integrador - Talento Tech 2026</p>
          <p className="text-xs mt-1">Machine Learning aplicado al Derecho a la Luz Solar</p>
        </div>
      </footer>
    </div>
  );
}
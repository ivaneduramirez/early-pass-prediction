# Predicción de calificaciones del 2.º parcial a partir del 1.º

## Datos
- Fuente: `notas_y_parciales_202607201034.xlsx` (67.842 cursos, 1.92M registros estudiante-curso, 33 ciclos 2010-1 → 2026-1, 61.795 estudiantes).
- ETL: `etl.py` → `data/registros.parquet` (una fila por estudiante-curso; notas normalizadas a 0-10 detectando escala 10/100 por curso).
- 1.60M registros con p1 y p2. El ciclo 20261 está en curso (p2 incompleto) y se excluye de entrenamiento/validación.
- Hallazgos EDA (`eda.py`): correlación p1-p2 Pearson 0.69 (0.57 sin ceros); p2 más disperso (std 2.04 vs 1.78); deriva temporal de la media (7.1 en 2010 → 8.8 en 2020 → ~8.15 hoy); ~1.7% abandona en el 2.º parcial (p1>0, p2=0).

## Enfoque 1 — distribución de p2 a partir de p1 (`enfoque1.py`)
Validación temporal: train ≤ 2024-2, test 2025-1 y 2025-2. Modelos:
- **naive**: histograma de p1 del ciclo como predicción del de p2.
- **condicional**: P(p2|p1) empírico (bins de 0.25, suavizado Laplace); la distribución de p2 es la mezcla ponderada por el histograma de p1 del ciclo test. Variantes: histórico completo vs solo ciclos ≥ 2022-2 (la reciente gana por la deriva).

### Métricas distribucionales (test)
| ciclo | modelo | err. media | err. std | W1 | KS |
|---|---|---|---|---|---|
| 2025-1 | naive | -0.094 | -0.167 | 0.181 | 0.047 |
| 2025-1 | condicional 2022+ | **-0.024** | **+0.057** | **0.040** | **0.007** |
| 2025-2 | naive | +0.071 | -0.292 | 0.129 | 0.027 |
| 2025-2 | condicional 2022+ | +0.130 | **-0.068** | 0.121 | 0.036 |

El condicional corrige el defecto principal del naive (subestimar la dispersión de p2 y el pico de abandono en 0). Media estimada dentro de ±0.13 pts, std dentro de ±0.07, KS ≤ 0.04. Gráficas: `figuras/enfoque1_histogramas.png`, `figuras/enfoque1_condicional.png`.

### Métricas por estudiante (test)
| modelo | MAE | RMSE | R² |
|---|---|---|---|
| identidad (p2=p1) | 0.96–1.03 | 1.41–1.51 | 0.37–0.38 |
| lineal p2=1.67+0.80·p1 | 0.94–1.01 | 1.35–1.47 | 0.42–0.43 |
| **E[p2\|p1] condicional** | **0.91–0.99** | **1.31–1.44** | **0.44–0.46** |

### Conclusión enfoque 1
Para el objetivo distribucional (media, desviación estándar, histograma de p2) el enfoque 1 **es suficiente**. A nivel de estudiante individual el techo con solo p1 es R² ≈ 0.46 (MAE ~0.95): queda varianza por explicar → justifica el enfoque 2.

## Enfoque 2 — historial del estudiante en el mismo ciclo (`enfoque2.py`)
Features (solo información de primeros parciales, sin fuga de p2): p1 propio; media y std de p1 del estudiante en sus otras asignaturas del ciclo (leave-one-out); nº de asignaturas; media de p1 del curso sin el estudiante; p1 relativo al curso. Train 2022-2 → 2024-2, test 2025-1 / 2025-2.

| modelo | MAE (25-1 / 25-2) | RMSE | R² |
|---|---|---|---|
| E[p2\|p1] (enfoque 1) | 0.91 / 0.99 | 1.31 / 1.44 | 0.46 / 0.44 |
| lineal multifeature | 0.89 / 0.96 | 1.26 / 1.38 | 0.50 / 0.49 |
| **GBM multifeature** | **0.85 / 0.92** | **1.22 / 1.34** | **0.53 / 0.52** |

- Importancia (permutación, Δ MAE): p1 0.27 > **p1_prom_otros 0.18** > curso_p1_prom 0.05 > resto ≤ 0.01. El historial del mismo ciclo aporta señal real.
- Segmento más difícil: p1 ∈ `3,5) con MAE 1.94 (destino bimodal: recuperarse o abandonar). Extremos fáciles: p1 ≥ 9 → MAE 0.69.

## Predicción del ciclo en curso 2026-1 ([predecir_20261.py`)
- GBM final reentrenado con 2022-2 → 2025-2 (443.834 registros) → `modelo_gbm_final.joblib` (no incluido en este repo).
- 82.578 predicciones individuales en `predicciones_20261.csv` (no incluido en este repo).
- Distribución estimada de p2 en 2026-1 (modelo condicional): **media 8.17, std 1.90** (p1 observado: 8.14 / 1.69).
- Los 5.061 p2 ya cargados en 20261 NO sirven para validar: 58% son ceros exactos (vs 1.9% en ciclo completo) con `resultado=None` y p1 normal → son cargas incompletas del sistema, no notas finales.

## % de aprobados al final a partir del primer parcial (`aprobados.py`, `aprobados_20261.py`)
Objetivo principal del proyecto: estimar el **porcentaje realista de aprobados al final del ciclo** (incluida recuperación) conociendo solo el primer parcial. Definición: aprobado ≡ `resultado` APROBADO* ≡ notafinal ≥ 7 (consistencia 99.99%).

- Curva empírica P(aprobar | p1) (train 2022-2 → 2024-2): S monótona — ~0% con p1<1.5, 50% en p1≈4.75, 94% en p1=7, 99.5% con p1≥9. La regla dura "aprueba si p1≥7" subestima la tasa en ~10 pp (ignora remontadas y recuperación); la curva empírica es la que da el número "realista".

### Validación (test 2025-1 / 2025-2)
| modelo | pred vs real 25-1 | pred vs real 25-2 | Brier | AUC |
|---|---|---|---|---|
| tasa histórica constante | 92.8 / 93.8 (-0.97 pp) | 92.8 / 92.9 (-0.11 pp) | 0.058–0.066 | — |
| regla p1≥7 | 82.9 / 93.8 (**-10.9 pp**) | 82.8 / 92.9 (**-10.1 pp**) | 0.13 | 0.85 |
| curva P(aprobar\|p1) | 93.1 / 93.8 (-0.71 pp) | 93.0 / 92.9 (+0.01 pp) | 0.035–0.039 | 0.92–0.93 |
| **GBM multifeature** | 93.1 / 93.8 (-0.68 pp) | 92.9 / 92.9 (**-0.08 pp**) | **0.032–0.035** | **0.945–0.948** |

Error por grupo (pp, ponderado): facultad 0.5–1.0, carrera 1.3–1.7, curso individual ~3.7–4.3 (ruido de n pequeño). Calibración del GBM por deciles casi perfecta.

### Predicción ciclo en curso 2026-1
- **Entre estudiantes-curso con p1 registrado: 93.1% de aprobados esperado.** Con ajuste de cobertura (3.1% de registros sin parciales —Seminario de Titulación, Internado— que históricamente aprueban al 98.5%): **≈93.3% global**.
- Detectados y excluidos 5 cursos (207 estudiantes) con p1 aún sin cargar (≥90% ceros exactos, patrón inexistente en ciclos completos).
- Salidas en `results/`: `prob_aprobar_20261.csv` (probabilidad individual, 82.578 filas), `aprobados_esperado_facultad_20261.csv`, `aprobados_esperado_carrera_20261.csv`, `cursos_riesgo_20261.csv`, `modelo_aprobados_final.joblib`, figura `aprobados_resumen.png`.
- Rango por facultad: Agropecuarias 87.9% … Químicas y Salud 96.5%. Carrera con menor esperado: Gestión de la Innovación (82.7%).

## Backtest por asignatura en los últimos 10 ciclos (`backtest_cursos.py`)
Caso de uso: "te doy las notas de p1 de una asignatura y me dices el % final de aprobados". Backtest rodante en 2021-1 → 2025-2: para cada ciclo se entrena SOLO con los 6 ciclos anteriores y se predice el % de cada curso (~2.000–2.200 cursos con n≥10 por ciclo).

Promedios de los 10 ciclos, modelo desplegable `gbm_curso` (solo necesita la lista de p1 del curso):
- **Error global del ciclo: ±0.6 pp** (máx 1.3 pp).
- **Por curso: MAE 3.8 pp, mediana 1.4 pp; 79% de cursos dentro de ±5 pp, 90% dentro de ±10 pp.**
- El modelo con historial del estudiante (`gbm_full`) solo mejora a MAE 3.4 pp — el 90% de la señal está en la propia lista de p1.
- Por tamaño de curso (mediana de error): 11–20 estudiantes 1.2 pp, 21–35 1.2 pp, 36–60 2.0 pp.
- Deriva: el error por curso creció de ~2.4 pp (2021, post-pandemia homogéneo) a ~4.2 pp (2023–2025, más dispersión) — la expectativa realista hacia adelante es MAE ≈ 4 pp.
- **IC 90% calibrado**: el intervalo Poisson-binomial puro cubre solo 81% (ignora shocks correlacionados del curso, p.ej. efecto docente en p2); con factor k=1.54 (calibrado sobre los 20.744 cursos del backtest, in-sample para el intervalo) la cobertura es 90.0%. Semi-ancho típico: ±6.6 pp (cursos de 10–20), ±5 pp (21–35), ±3.6 pp (>60).

### Ablación: + % de aprobados del período anterior (`backtest_prev.py`)
Se añade como feature la tasa de aprobados de la misma asignatura (facultad+carrera) en el ciclo inmediatamente anterior (disponible al predecir; cobertura 97.5% en test), y opcionalmente la del docente (cobertura 94.3%). Mismo backtest rodante de 10 ciclos:

| variante | MAE pp | mediana pp | ≤5 pp | ≤10 pp |
|---|---|---|---|---|
| base (solo lista de p1) | 3.79 | 1.42 | 79.3% | 90.1% |
| **+ tasa previa asignatura** | **3.41** | **1.22** | **81.2%** | **91.7%** |
| + tasa previa asignatura y docente | 3.39 | 1.20 | 81.4% | 91.6% |

- Mejora consistente: el delta de MAE es negativo en los 10 ciclos (−0.09 a −0.64 pp). En los 3 ciclos más recientes el MAE baja de ~4.2 a ~3.7 pp.
- La tasa previa de la asignatura **iguala al modelo con historial completo del estudiante** (3.41 vs 3.43 pp): capta el "carácter" estable de la materia con un solo número extra.
- La tasa previa del docente encima de la de asignatura ya no aporta (−0.02 pp).

### Ablación: booleana "mismo docente que el ciclo anterior" (`backtest_docente.py`)
`mismo_docente` = el docente del curso dictó esa asignatura en el ciclo anterior (cobertura 97.5%; continuidad 72%). Resultado en el mismo backtest de 10 ciclos:

| variante | MAE pp |
|---|---|
| base | 3.79 |
| base + mismo_docente | 3.79 (+0.00) |
| base + tasa previa asignatura | 3.41 |
| base + tasa previa + mismo_docente | 3.38 (−0.03) |

No aporta señal práctica. La explicación está en el descriptivo: el salto |tasa real − tasa previa de la asignatura| es casi idéntico si sigue el mismo docente (media 4.7 pp) o si cambia (4.9 pp) — **la tasa de aprobación es una propiedad estable de la asignatura, no del profesor**, consistente con que la tasa previa del docente tampoco sumara nada.

### Ablación final y modelo ganador (`backtest_final.py`)
Últimas ideas exploradas sobre base+tasa previa (mismo backtest de 10 ciclos):

| variante | MAE pp | mediana pp | ≤5 pp | ≤10 pp |
|---|---|---|---|---|
| base + tasa previa (1 ciclo) | 3.41 | 1.22 | 81.2% | 91.7% |
| + forma del curso (std p1, %≥7, tamaño) | 3.33 | 1.14 | 81.7% | 91.9% |
| tasa previa suavizada (2 ciclos) | 3.34 | 1.19 | 81.6% | 92.0% |
| **todo (forma + prev2 + nivel)** | **3.24** | **1.10** | **82.1%** | **92.1%** |

**Modelo ganador definitivo**: GBM con p1 + contexto del curso (media LOO, relativo, dispersión, %≥7, tamaño) + tasa previa de la asignatura suavizada a 2 ciclos + nivel en la malla. Todos los insumos siguen saliendo de la lista de p1 del curso + 1–2 tasas históricas + el nivel. K_CAL del IC90 recalibrado a 1.417 (cobertura 90.0%). Desplegado en `modelo_curso_final.joblib` (no incluido en este repo).
Exploraciones agotadas sin ganancia: historial del estudiante en otras materias (−0.02 pp sobre tasa previa), tasa previa del docente (−0.02), booleana mismo/otro docente (−0.03).

### Uso (`predecir_curso.py`)
`.venv/bin/python predecir_curso.py 8.5 7 9.2 …` (o un CSV con columna `p1`) → % esperado + IC90 + nº de aprobados esperados. Sin argumentos corre un demo con cursos reales de 2025-2.

## Auditoría adversarial del pipeline
Revisión multi-agente (4 dimensiones: fugas de datos, features, ETL/escalas, métricas; cada hallazgo verificado por un panel de 2 escépticos independientes con reproducción empírica). **15 hallazgos propuestos, 0 con impacto en las conclusiones publicadas.** Artefactos menores documentados:
- Ciclos antiguos (todos fuera del train 2022+): 84 filas deflactadas 10× por un outlier >10 (2011/2014), 153 filas con escalas mezcladas dentro del mismo curso (2010–2014), 800 filas con estudiante duplicado en el mismo curso (≤2014-1), y era de 3 parciales (2010–2017) donde p2 tiene otra semántica — refuerzan la decisión de entrenar solo con ciclos recientes.
- Cobertura: ~3.9% de registros recientes no traen parciales (Seminario de Titulación, Internado; aprueban ~98.5%) — ya incorporado como ajuste de cobertura en la sección de aprobados. El ciclo cerrado 2023-2 pierde además 1.293 filas con solo p1 (falta en origen).
- Detalles de reporte sin efecto material: suavizado Laplace α=1 sesga E[p2|p1] hasta +1 pt en bins con p1<3 (ΔR² 0.0002; el GBM no lo usa); momentos de histograma vs crudos difieren ≤0.025; W1/KS binados subestiman ~3%; `n_cursos` cuenta solo cursos con p1; la elección de la ventana 2022+ se comparó sobre el test (Δ ≤ 0.001).

### Segunda auditoría (backtest por curso y predictor)
8 hallazgos propuestos, 0 confirmados con impacto material. Acciones y caveats derivados:
- Corregido: CSV sin cabecera perdía la primera nota en `predecir_curso.py`; lista vacía daba error crudo.
- Caveat asumido: **la expectativa de error hacia adelante es MAE ≈ 4.2 pp** (los ciclos recientes, no el promedio 3.8 de los 10 ciclos).
- Caveat asumido: K_CAL=1.54 se calibró in-sample sobre el propio backtest; fuera de muestra la cobertura del IC90 ronda 88–89%.
- Menores: el demo usa un modelo entrenado con ciclos que incluyen 2025-2 (impacto medido 0.07 pp); 2025-1/2025-2 sirvieron a la vez para decisiones de diseño de enfoques previos y como 2 de los 10 ciclos del backtest (los otros 8 son limpios y dan los mismos números).

## Notas técnicas
- Entorno: `.venv` local (pandas, pyarrow, scikit-learn, scipy, matplotlib).
- Advertencias `RuntimeWarning ... in matmul` en macOS: falso positivo del backend Accelerate de numpy; resultados verificados contra einsum y bucle manual.

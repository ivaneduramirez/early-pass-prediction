# Guía de uso — predictor de % de aprobados por asignatura

## Qué hace
Dadas las **notas del primer parcial** de una asignatura (escala 0–10) y, opcionalmente, el **% de aprobados de esa asignatura en los 1–2 períodos anteriores** y su **nivel en la malla**, estima:

- el **% de estudiantes que aprobarán al final del ciclo** (incluida recuperación),
- un **intervalo de confianza del 90%**,
- el número esperado de aprobados,
- (vía API) la probabilidad individual de aprobar de cada estudiante.

## Requisitos
- El entorno del proyecto: `.venv` (pandas, scikit-learn, joblib ya instalados).
- El modelo entrenado `modelo_curso_final.joblib` (no incluido en este repo). Si no existe, se entrena solo la primera vez (necesita `data/registros.parquet`, ~2 min).

## Uso por línea de comandos

```bash
cd "PREDICCION DE CALIFICACIONES"

# notas directas
.venv/bin/python predecir_curso.py 8.5 7 9.2 6.5 0 7.8 5.5 9 10 6.8

# con % de aprobados previo y nivel (recomendado: baja el error ~15%)
.venv/bin/python predecir_curso.py --prev 93,91 --nivel 1 8.5 7 9.2 6.5 0 7.8 5.5 9 10 6.8

# desde un CSV (una nota por fila, o con columna 'p1'; con o sin cabecera)
.venv/bin/python predecir_curso.py --prev 87.5 --nivel 3 notas_algebra.csv

# demo con cursos reales de 2025-2
.venv/bin/python predecir_curso.py
```

Salida típica:
```
estudiantes: 10   (tasa previa 92.0%, nivel 1)
% de aprobados esperado al final: 87.9%  (IC 90%: 77.9% – 97.9%)
aprobados esperados: 8.8 de 10
```

## Uso desde Python

```python
from predecir_curso import predecir

pct, lo, hi, prob = predecir(
    [8.5, 7, 9.2, 6.5, 0, 7.8],  # notas de p1
    tasa_prev=0.93,               # % aprobados previo de la asignatura (opcional, [0,1])
    nivel=1,                      # nivel en la malla 1..10 (opcional)
)
# pct = % esperado; (lo, hi) = IC 90%; prob = probabilidad por estudiante
```

`prob` permite listas de riesgo: `prob < 0.5` marca a los estudiantes con más probabilidad de reprobar que de aprobar.

## Cómo interpretar el resultado
- El % esperado es el promedio de las probabilidades individuales: no es una regla "aprueba quien tiene ≥7". Un estudiante con p1=5.5 aporta ~0.7 aprobados esperados, uno con p1=9 aporta ~0.995.
- **Precisión validada** (backtest en 10 períodos, 2021-1 → 2025-2, entrenando siempre solo con ciclos anteriores): error mediano ~1.1 pp por curso, MAE ~3.2 pp; 82% de los cursos caen dentro de ±5 pp y 92% dentro de ±10 pp. En el agregado de un ciclo completo el error es ±0.6 pp.
- **El intervalo importa en cursos pequeños**: con 10–20 estudiantes el IC90 es ±6–7 pp por puro ruido binomial; con >60 estudiantes baja a ±3–4 pp. Un curso individual puede desviarse más si ocurre algo que el p1 no anticipa (cambio de criterio del docente, abandono masivo tardío).
- La expectativa de error hacia adelante es la de los ciclos recientes (~3.5 pp de MAE), no la del promedio histórico.

## De dónde sale `--prev`
Es el % de aprobados (APROBADO DIRECTO + RECUPERACIÓN) de la misma asignatura (misma carrera) en el período anterior; si tienes los dos últimos períodos pásalos separados por coma (`--prev 93,91`) — la versión suavizada rinde mejor. Si la asignatura es nueva, omite el flag: el modelo maneja el faltante de forma nativa (~2.5% de los cursos).

Hallazgos relevantes del análisis: **no** hace falta ajustar por docente (la tasa de aprobación es una propiedad estable de la asignatura: cambiar de profesor no altera la transferibilidad de la tasa previa), ni por historial del estudiante en otras materias (aporta <0.1 pp una vez incluida la tasa previa).

## Mantenimiento
- **Reentrenar cada ciclo cerrado** (ventana móvil de 6 ciclos): borrar `modelo_curso_final.joblib` (no incluido en este repo) y ejecutar cualquier predicción, o llamar `entrenar_y_guardar()`. Requiere regenerar antes `data/registros.parquet` con `etl.py` sobre el export actualizado del sistema académico.
- Vigilar la deriva: si el MAE del backtest sube sostenidamente (ver `backtest_final.py`), recalibrar el factor del intervalo (`K_CAL`).
- Cuidado con **ceros placeholder**: si el primer parcial aún no está cargado (todo el curso en 0), la predicción no es válida — el ETL y los análisis los detectan como cursos con ≥90% de ceros exactos.

## Límites conocidos
- Predice el agregado del curso mejor que el destino individual (a nivel estudiante el techo es AUC ≈ 0.95 pero con la franja p1∈[3,5) muy incierta: destino bimodal recuperarse/abandonar).
- El IC90 está calibrado sobre el backtest (in-sample); fuera de muestra cubre ~88–89%.
- Entrenado con datos UTMACH 2022+ (escala 0–10, umbral de aprobación 7, con recuperación). Cambios de reglamento (p. ej. del umbral o del esquema de recuperación) invalidan la calibración y exigen reentrenar.

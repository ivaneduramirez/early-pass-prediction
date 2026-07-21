# Plan de presentación — "Predicción del % de aprobados por asignatura a partir del primer parcial"

Duración objetivo: 20 min + preguntas. Audiencia: mixta (autoridades académicas + perfil técnico). Cada lámina lista su contenido, la figura de apoyo (ya generada en `results/`) y la nota del presentador.

---

## Bloque 1 — Problema y datos (láminas 1–4)

**L1. Portada + pregunta.**
- Título: "¿Cuántos aprobarán al final? Predicción temprana por asignatura desde el primer parcial".
- Subtítulo con el resultado estrella: *validado en 10 períodos: error mediano 1.1 pp por asignatura, ±0.6 pp a nivel institucional*.
- Nota: abrir con la pregunta operativa — "al cerrar el primer parcial, ¿qué asignaturas van a tener problemas?".

**L2. Los datos.**
- 67.842 cursos, 1.92 millones de registros estudiante-asignatura, 33 períodos (2010-1 → 2026-1), 61.795 estudiantes.
- Qué contiene cada registro: p1, p2, nota final, resultado (aprobado directo / recuperación / reprobado).
- Nota: mencionar el trabajo de limpieza sin detenerse (escalas 0–10 y 0–100 mezcladas, normalización; detalle en apéndice).

**L3. Lo que el primer parcial ya sabe.**
- Figura: curva P(aprobar | p1) (`figuras/aprobados_resumen.png`, panel izquierdo).
- Puntos a leer en voz alta: con p1=7 aprueba el 94%; con p1=5.5 el 71%; con p1=4.5 el 49%; bajo 1.5, nadie.
- **Mensaje clave: la regla intuitiva "aprueba quien tiene ≥7" se equivoca por ~10 puntos** — ignora remontadas y recuperación.
- Nota: esta lámina justifica todo el enfoque probabilístico.

**L4. Por qué NO vale usar la nota tal cual (motivación de modelo).**
- p2 es más disperso que p1 (std 2.04 vs 1.78); ~1.7% abandona tras un p1>0; deriva histórica de medias (7.1 → 8.8 en pandemia → 8.15).
- Figura: histograma p1 vs p2 (`figuras/enfoque1_histogramas.png`).
- Nota: por la deriva, todo se valida temporalmente (entrenar en el pasado, probar en el futuro). Nunca al revés.

## Bloque 2 — El modelo y su validación (láminas 5–9)

**L5. Cómo funciona (una lámina, sin fórmulas).**
- Diagrama de flujo: lista de p1 del curso → probabilidad individual de aprobar por estudiante (GBM: p1 + contexto del curso + tasa previa de la asignatura) → promedio = % esperado → intervalo del 90%.
- Nota: enfatizar la interfaz mínima — basta la lista de notas de ESA asignatura + un número del período pasado.

**L6. La validación que importa: backtest rodante honesto.**
- Esquema: para cada uno de los 10 períodos 2021-1 → 2025-2, entrenar SOLO con los 6 anteriores → predecir ~2.000–2.200 cursos → comparar con el % real al cierre.
- Nota: subrayar "el modelo nunca ve el futuro"; es la simulación exacta del uso real.

**L7. Resultados globales e institucionales.**
- Tabla: % predicho vs real por ciclo (error global ±0.6 pp, máx 1.3).
- Figura: barras predicho vs real (`figuras/aprobados_resumen.png`, panel derecho).
- Nota: a nivel de cohorte completa el modelo es casi exacto; el reto está curso a curso.

**L8. Resultados por asignatura.**
- Figura: histograma del error (`figuras/backtest_hist_error.png`).
- Números: mediana 1.1 pp; MAE 3.2 pp; 82% dentro de ±5 pp; 92% dentro de ±10 pp; sin sesgo (media −0.2 pp).
- Nota: explicar las colas — cursos pequeños (ruido binomial) y eventos que p1 no anticipa; por eso el intervalo.

**L9. Qué variables importan (y cuáles no) — el valor del análisis.**
- Escalera de mejora (MAE por curso): solo p1 3.79 → + tasa previa asignatura 3.41 → + forma del curso, tasa suavizada 2 ciclos y nivel **3.24** (modelo final).
- **Hallazgos negativos valiosos**: ni el docente (booleana mismo/otro profesor: −0.03 pp; tasa previa del docente: −0.02) ni el historial del estudiante en otras materias (−0.02) aportan sobre la tasa previa de la asignatura.
- **Mensaje citable: "la tasa de aprobación es una propiedad estable de la asignatura, no del profesor"** (el salto de tasa entre ciclos es 4.7 pp con el mismo docente vs 4.9 pp con otro).

## Bloque 3 — Uso y límites (láminas 10–13)

**L10. Demo en vivo.**
- Terminal: `predecir_curso.py --prev 93,91 --nivel 2 8.5 7 9.2 ...` y el demo de cursos reales de 2025-2 (Matemáticas Discretas: predicho 65.6%, real 60%; Tecnología Educativa: 97.5% vs 95.7%).
- Nota: mostrar también la lista de riesgo individual (prob < 0.5) como subproducto.

**L11. Casos de uso institucionales.**
- Alerta temprana por asignatura/carrera al cerrar p1 (ranking `cursos_riesgo_20261.csv` (no incluido en este repo)).
- Proyección del ciclo en curso: 2026-1 ≈ 93.1–93.3% de aprobados; rango por facultad 87.9% (Agropecuarias) – 96.5% (Químicas y Salud).
- Planificación de recuperación: aprobados esperados = suma de probabilidades.

**L12. Límites — decirlos antes de que los pregunten.**
- Curso individual: ±5 pp típico, ±6–7 pp en cursos de 10–20 estudiantes (ruido binomial irreducible).
- El IC90 está calibrado in-sample (fuera de muestra ~88–89%).
- La franja p1 ∈ [3,5) es la más incierta (destino bimodal: recuperarse o abandonar).
- No sirve si el p1 no está cargado (ceros placeholder — se detectan automáticamente).
- Cambios de reglamento (umbral 7, esquema de recuperación) obligan a reentrenar.

**L13. Cierre + siguiente paso.**
- Resumen en 3 números: ±0.6 pp institucional, 1.1 pp mediana por asignatura, 10 períodos de validación.
- Propuesta: piloto en 2026-1 comparando la predicción publicada hoy contra el cierre real del ciclo (la predicción ya está generada y es falsable).
- Nota: cerrar con la auditoría — todo el pipeline pasó 2 auditorías adversariales automatizadas (23 hallazgos examinados y verificados, 0 invalidan las conclusiones).

## Apéndice técnico (láminas A1–A4, solo si preguntan)
- A1: ETL y normalización de escalas; exclusiones (cursos sin parciales 3.9%, ceros placeholder).
- A2: matriz condicional P(p2|p1) (`figuras/enfoque1_condicional.png`) y el pico de abandono.
- A3: métricas completas (Brier 0.03, AUC 0.95, calibración por deciles) y comparación de modelos.
- A4: metodología de auditoría (paneles adversariales de verificación) y caveats asumidos.

---

## Checklist de materiales
- [x] Figuras: `aprobados_resumen.png`, `backtest_hist_error.png`, `enfoque1_histogramas.png`, `enfoque1_condicional.png`.
- [x] Demo reproducible: `predecir_curso.py` (demo + CLI con `--prev`).
- [x] CSV de soporte: `cursos_riesgo_20261.csv`, `aprobados_esperado_facultad_20261.csv`, `backtest_final.csv`.
- [ ] Diapositivas (generar desde este guion cuando se elija formato: PowerPoint/Canva/HTML).

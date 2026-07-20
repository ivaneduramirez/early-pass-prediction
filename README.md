# Predicción temprana de aprobación por asignatura — demo

Demo estática (GitHub Pages) de un modelo que, **al cerrar el primer parcial**, estima para cada asignatura:

- el **% de estudiantes que aprobarán al final del período** (con intervalo de confianza del 90%),
- el número esperado de **aprobados** y reprobados,
- los **reprobados del período anterior** y cuántos están repitiendo,
- los **estudiantes previstos para el próximo período** (nuevos + reprobados esperados × tasa de rematrícula medida de 0.49).

La utilidad: esta información existe **meses antes del cierre de actas**, cuando todavía se puede planificar el siguiente período (paralelos, cupos, carga docente) en lugar de reaccionar tarde.

## Qué se puede ver en la demo

- **2026-1 (en curso)**: predicción pura — no existen notas finales todavía. Es el caso de uso real.
- **2025-1 y 2025-2 (cerrados)**: cada asignatura muestra el % **predicho** (calculado solo con el primer parcial, por un modelo entrenado únicamente con ciclos anteriores) junto al % **real** — se puede verificar la precisión asignatura por asignatura.

## Privacidad

Los datos son reales pero están **anonimizados**: no aparece ningún nombre (ni de estudiantes ni de docentes) y las cédulas están enmascaradas mostrando solo los 3 primeros y 3 últimos dígitos (`070XXXX088`).

## El modelo

Gradient boosting sobre: nota del primer parcial de cada estudiante + contexto del curso (media, dispersión, % sobre 7, tamaño) + tasa histórica de aprobación de la asignatura (2 períodos, suavizada) + nivel en la malla.

Validación: backtest rodante sobre 10 períodos académicos (2021-1 → 2025-2), entrenando siempre solo con los 6 ciclos anteriores al período evaluado:

| métrica | valor |
|---|---|
| error mediano por asignatura | 1.1 puntos porcentuales |
| error absoluto medio | 3.2 pp |
| asignaturas dentro de ±5 pp | 82% |
| asignaturas dentro de ±10 pp | 92% |
| error del agregado institucional | ±0.6 pp |

Hallazgo colateral del análisis: la tasa de aprobación es una **propiedad estable de la asignatura**, no del docente que la dicta — ni la identidad del profesor ni su continuidad aportan poder predictivo una vez incluida la historia de la asignatura.

## Estructura

- `index.html`, `app.js`, `styles.css` — interfaz (vanilla JS, sin dependencias).
- `data/periodo_*.json` — datos anonimizados precalculados por período.
- `data/indice.json` — índice de períodos.

Para servirla localmente: `python3 -m http.server 8000` en esta carpeta y abrir `http://localhost:8000`.

# Casos de Ejemplo - Sanitizador Clínico

Esta carpeta contiene casos de ejemplo para probar y comprender el funcionamiento del Sanitizador Clínico.

## Casos Disponibles

### 01 - Consulta de Urgencias
**Complejidad:** Media
**Propósito:** Introducción a los conceptos básicos de anonimización

Caso típico de urgencias que incluye:
- Identificadores directos básicos (nombre, DNI)
- Datos de contacto (teléfono)
- Ubicación geográfica
- Fechas de diagnóstico

**Conceptos clave:**
- Identificadores directos vs indirectos
- Generalización geográfica
- Relativización temporal

---

### 02 - Informe Quirúrgico
**Complejidad:** Alta
**Propósito:** Casos con múltiples actores y fechas relacionadas

Informe quirúrgico completo que incluye:
- Múltiples profesionales sanitarios
- Nombres con partículas ("María del Carmen")
- Identificadores de historia clínica (NHC)
- Fechas relacionadas (intervención → alta)
- Ubicación hospitalaria

**Conceptos clave:**
- Detección de nombres complejos
- Preservación de intervalos temporales
- Múltiples actores en un documento

---

### 03 - Historia Clínica
**Complejidad:** Media
**Propósito:** Cuasi-identificadores en seguimiento ambulatorio

Historia clínica de seguimiento que incluye:
- Fecha de nacimiento completa
- Email con información personal
- Profesión específica
- Datos de seguimiento temporal

**Conceptos clave:**
- La fecha de nacimiento es un identificador directo
- Emails pueden contener información identificable
- Profesiones específicas como cuasi-identificadores

---

### 04 - Caso Complejo con Cuasi-identificadores
**Complejidad:** Muy Alta
**Nivel de Riesgo:** CRÍTICO
**Propósito:** Demostración de límites de la anonimización

Caso extremo que combina múltiples cuasi-identificadores:
- Enfermedad rara/ultra-rara
- Cargo público (Alcalde)
- Ubicación geográfica pequeña (municipio rural)
- Relaciones familiares identificables (gemelo)
- Referencias de exclusividad ("único paciente")

**Conceptos clave:**
- **CRÍTICO:** Algunos casos NO pueden anonimizarse verdaderamente
- Cuasi-identificadores en combinación = identificación directa
- Importancia del juicio clínico humano
- Casos que requieren consulta con DPO
- Diferencia entre pseudonimización y anonimización

**⚠️ Lección importante:** Este caso enseña que no todos los documentos clínicos deben publicarse, incluso anonimizados. La combinación de enfermedad rara + cargo público + ubicación pequeña hace prácticamente imposible una verdadera anonimización.

---

## Cómo Usar los Ejemplos

### Método 1: Copiar y Pegar Manual
1. Abre el archivo JSON del caso que quieras probar
2. Copia el contenido del campo `"texto"`
3. Pégalo en el área de texto del sanitizador

### Método 2: Integración Programática (Futuro)
Los archivos JSON están estructurados para permitir:
- Carga automática desde el menú de ejemplos
- Validación automática de detecciones esperadas
- Suite de tests de regresión
- Evaluación de la calidad del algoritmo

## Estructura de los Archivos JSON

```json
{
  "titulo": "Nombre descriptivo del caso",
  "descripcion": "Breve explicación del caso",
  "texto": "El texto clínico completo a procesar",
  "complejidad": "baja|media|alta|muy alta",
  "entidades_esperadas": {
    "NOMBRE": [...],
    "IDENTIFICADOR": [...],
    "FECHA": [...],
    "UBICACION": [...],
    "SOSPECHOSO": [...]
  },
  "notas_didacticas": [
    "Explicaciones educativas de cada concepto"
  ],
  "nivel_riesgo": "OPCIONAL - Para casos críticos",
  "recomendacion": "OPCIONAL - Recomendaciones específicas"
}
```

## Uso Educativo

Estos casos están diseñados con propósito educativo para:

1. **Estudiantes de informática médica:** Comprender los desafíos técnicos de la privacidad en datos sanitarios
2. **Profesionales sanitarios:** Desarrollar sensibilidad hacia los cuasi-identificadores
3. **Delegados de Protección de Datos:** Casos de referencia para evaluación de riesgos
4. **Desarrolladores:** Tests de regresión y validación de algoritmos

## Progresión Recomendada

Para aprendizaje óptimo, procesar los casos en orden:

1. **Caso 01** → Conceptos fundamentales
2. **Caso 03** → Introducción a cuasi-identificadores
3. **Caso 02** → Complejidad técnica
4. **Caso 04** → Límites y decisiones éticas

## Contribuir con Nuevos Casos

Si deseas añadir nuevos casos de ejemplo:

1. Usa datos **completamente ficticios**
2. Sigue la estructura JSON establecida
3. Incluye `notas_didacticas` claras
4. Asigna un nivel de complejidad apropiado
5. Para casos críticos, añade `nivel_riesgo` y `recomendacion`

## Privacidad de los Ejemplos

**IMPORTANTE:** Todos los datos en estos ejemplos son **completamente ficticios**. No corresponden a pacientes reales. Cualquier coincidencia con personas reales es puramente accidental.

---

**Nota Final:** El objetivo de estos ejemplos no es solo demostrar la capacidad técnica del sanitizador, sino educar sobre los desafíos genuinos de la privacidad en datos clínicos y la importancia del juicio humano en el proceso.

---
title: Consideraciones sobre la creación de Excepciones
description: Reflexiones sobre cuándo y cómo crear Exceptions en Java. Discute los costos de fillInStackTrace y estrategias de manejo de excepciones.
date: 2023-01-27 22:13:20 +0900
categories: [Programming, Java]
tags: [Exception, Error Management]
author: w-seok
lang: es-ES
faq:
  - question: "¿Por qué es costosa la creación de Exception en Java?"
    answer: "Cuando se crea un Exception, se llama al método fillInStackTrace() que recopila información de la pila de llamadas incluyendo nombres de clases, métodos y números de línea, lo que lo convierte en una operación costosa."
  - question: "¿Cuándo se debe evitar la creación de Exceptions?"
    answer: "Cuando no es necesario lanzar un error, por ejemplo cuando los logs de advertencia son suficientes en niveles de umbral de memoria, es más apropiado usar log.warn() en lugar de crear Exceptions."
  - question: "¿Cómo se puede reducir el costo de fillInStackTrace?"
    answer: "Se puede sobrescribir fillInStackTrace() con una implementación vacía para eliminar el costo de recopilación de stack trace. Sin embargo, como se pierde información de depuración, solo debe usarse en situaciones específicas donde el rendimiento es crítico."
---
Introducción
---
> Durante el desarrollo, es necesario considerar cuidadosamente cuándo y cómo crear excepciones (`Exception`).
<br><br>Generalmente, crear excepciones indiscriminadamente no es una buena idea.
<br>Por el contrario, no crear excepciones cuando son necesarias puede dificultar la depuración y el seguimiento de errores.


Consideraciones principales
---
### 1. Evitar la creación indiscriminada de Exceptions

- En código donde no necesitas `throw` un error, piensa dos veces antes de crear una `exception`.
- El costo de crear una `exception` varía según la situación, pero generalmente es alto.

### 2. Comprender los costos de creación de Exception

- Cuando ocurre una excepción, surgen costos al recorrer la pila de llamadas de excepción para encontrar un método que pueda manejar la `exception`.
- `Exception` es una implementación de `Throwable`
  - Se generan costos adicionales al recopilar información de la pila de llamadas a través del método `fillInStackTrace()`
  - El proceso de recorrer la pila de llamadas para recopilar nombres de clases, nombres de métodos, números de línea, etc. para crear un `stacktrace` también contribuye al aumento de costos
  <br> -> **Ten en cuenta que el costo real depende de la profundidad y tamaño del stack trace**

### 3. Considera si realmente necesitas una Exception

Como ejemplo algo extremo, en el código siguiente que verifica memoria, la verificación del estado actual de memoria tiene etapas:
1. `Situación de advertencia` (`log.warn()`) - GC puede liberar suficiente memoria
2. `Situación severa` (`log.error()`) - La memoria no se ha liberado suficientemente debido a la carga, el servidor podría fallar

En una situación donde solo un `warn` es suficiente, ¿realmente necesitas crear una `exception`?

``` java
// Ejemplo inapropiado
public void checkMemoryUsage() {
    long usedMemory = totalMemory - freeMemory;
    if (usedMemory > MEMORY_THRESHOLD) {
        Exception memoryException = new Exception("¡Se requiere atención de memoria!");
        throw memoryException;
    }
}

// Enfoque mejorado
public void checkMemoryUsage() {
    long usedMemory = totalMemory - freeMemory;
    if (usedMemory > MEMORY_THRESHOLD) {
        log.warn("Se requiere atención de memoria. Memoria usada: {}", usedMemory);
        // Puede enviar alertas vía webhook, etc.
    }
}
```

Mejoras
---

Entonces, si se necesita crear una excepción pero se espera que el costo sea alto, ¿cómo podemos mejorarlo?

### 1. Sobreescribir fillInStackTrace

- Sobreescribir fillInStackTrace para eliminar el costo de crear un stacktrace

```java
public class OptimizedException extends Exception {
  @Override
  public Throwable fillInStackTrace() {
    return this; // Evitar el costo de generación de stack trace
  }
}
```

### 2. Cachear Exceptions que ocurren frecuentemente
``` java
public class ExceptionCache {
    public static final CommonException COMMON_EXCEPTION = new CommonException("Situación de excepción común que ocurre frecuentemente");
}
```

### Advertencias
1. OptimizedException o excepciones cacheadas solo deben usarse para excepciones donde no se necesitan stack traces
   - Excepciones que ocurren como parte del flujo normal de la aplicación - como excepciones de etapa de validación
   - Excepciones que ocurren repetidamente: Excepciones que ocurren frecuentemente en la misma situación
2. Para situaciones donde se necesita seguimiento real de problemas, es mejor usar Exceptions regulares.
   - Las excepciones optimizadas por rendimiento podrían causar confusión durante la revisión de código o depuración.

## Lo realmente importante

- Es más importante describir claramente cuál es el problema al crear excepciones (lo mismo aplica para `logging`)
- El código que simplemente termina con `throw new Exception(e.getMessage())` solo dificulta el seguimiento.
- Ya que serás tú quien rastree el problema cuando ocurra... es importante escribir claramente.
- Además, antes de crear una `customException`, considera si puedes expresarlo claramente usando las subclases estándar de `RuntimeException` proporcionadas.

```java
// Código problemático

try {
    categoryService.update(id, requestDto));
} catch (Exception e) {
	  throw new RuntimeException(e.getMessage());
}

// Código mejorado

try {
    log.info("[@{}] Solicitud de actualización de categoría para id={}: {}", name, id, requestDto);
    categoryService.update(id, requestDto));
} catch (Exception e) {
    log.error("[@{}] Ocurrió un error al actualizar categoría con id={}", name, id, e);
    // Si fue un argumento incorrecto, IllegalArgumentException podría ser mejor
    throw new IllegalArgumentException("[@{}] Ocurrió un error al actualizar categoría con id={}", name, id, e));
}
```

## Referencia
- [java-exceptions-performance](https://www.baeldung.com/java-exceptions-performance)
- [Usa excepciones solo para situaciones excepcionales](https://shipilev.net/blog/2014/exceptional-performance/)
- [oracle-fillInStackTrace()](https://docs.oracle.com/javase/8/docs/api/java/lang/Throwable.html#fillInStackTrace--)

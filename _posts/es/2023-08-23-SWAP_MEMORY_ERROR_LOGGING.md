---
title: Problemas y registro de errores relacionados con verificación de Swap Memory
description: Compartiendo el análisis de causas de errores relacionados con Swap Memory en entorno de instancia Spot de AWS y el proceso de depuración a través de logging de CloudWatch.
date: 2023-08-23 21:57:01 +0900
categories: [Issue]
tags: [Issue, Swap Memory, Log]
author: w-seok
lang: es-ES
---
Introducción
---
>Durante la comida, las alarmas de error de Slack sonaron mucho.. Afortunadamente, otro servidor consumidor estaba procesando sin problemas y como el logging de errores estaba gestionado, fui directamente a `CloudWatch` para verificar y después de entender el código organicé el problema

Situación del problema
---
> En el caso del `procesamiento de imágenes AI` actualmente en servicio, el servidor consumidor ejecutándose en instancia Spot tiene lógica para verificar el `swap memory` de la instancia,
<br>Esa lógica no funcionó normalmente y debido a esto, las lógicas de manejo de excepciones encadenadas fallaron todas y ocurrió un problema donde esperaba indefinidamente sin procesar la cola de mensajes
<br><br>La instancia Spot tiene tres procesos que realizan trabajo principal y una cola de mensajes
<br> - Proceso que recibe solicitudes de generación de imágenes de usuarios - **servidor API**
<br> - Proceso que envía solicitudes al proceso AI para procesar solicitudes recibidas de la cola de mensajes - **servidor consumidor**
<br> - Cola de mensajes que recibe solicitudes y respuestas entre servidor API y servidor consumidor - **cola de mensajes**
<br> - Proceso que genera imágenes AI - **proceso AI**
<br><br>La aplicación consumidor en servicio consume trabajo de la cola de mensajes y procesa trabajo a través de comunicación con el `proceso AI` (`proceso python` que se comunica con el servicio `java`) configurándose en la instancia

## Entorno y stack de la situación
---
- `spring boot 3.*`, `java`, `python`
- `aws`, `spot instance`

## Causa del problema
---
>Viendo solo la conclusión, parece un problema bastante simple, pero en realidad tomó tiempo encontrar el problema<br><br>
Rastreando, varios legacy existentes + mis errores etc.. varios legacy acumulados causaron problemas en cadena…
<br>Vamos a organizar en orden, los problemas son los siguientes
<br><br> Como no es un problema de proyecto personal no puedo escribir en detalle y tampoco quiero escribir específicamente sobre la tecnología usada.
<br><br>Quiero escribir solo como ocurrió tal y tal situación..y se rastreó y resolvió de tal y tal manera.
<br><br> Los problemas estaban encadenados en orden.

### 1. Verificación de swap memory aún no configurado

**El primer problema fue que en el estado inicial del servidor después de configuración de instancia → configuración de Spring, antes de consumir mensajes de la cola, juzgó erróneamente que el swap memory era insuficiente**

1) Ocurrió caso donde el `swap memory` configurado durante la configuración de instancia aún no se aplicaba en la etapa de verificación de memoria de la `aplicación java`
  - Buscando en todos los logs del mes, realmente muy rara vez…
<br>→ **Cambiar para que consuma mensajes de cola solo después de que la verificación esté completamente hecha**
<br><br>
2) Y la lógica java problemática juzgó que el `swap memory` era insuficiente.. aunque en realidad no era insuficiente para nada.. terminó reiniciando el proceso AI

**¿Por qué se verifica el swap memory?**
  - En el caso del proceso AI, se necesita cargar varios modelos de trabajo (`aproximadamente 1~4gb`) en memoria para procesamiento rápido de trabajo
    - Es decir, si cada vez que se usa se carga y usa el modelo sin precarga en memoria, es aproximadamente 5 veces más lento que cargar y usar
  - Para satisfacer la memoria necesaria para varios modelos y el `proceso java`, usar `swap memory` tiene buena relación costo-beneficio, por lo que se necesita lógica de verificación de `swap memory` antes del procesamiento de cola de mensajes
    - Entonces.. como el swap memory tampoco tiene capacidad infinita, se debe considerar el número de modelos a cargar y la frecuencia de cambio..
<br>-> Esta parte debe decidirse a través de varios elementos empíricos, no por suposición

### 2. El servidor intentó reiniciar a través de archivo ejecutable debido a verificación anormal de swap memory pero.. falló

- Hay varias formas de reiniciar el servidor así que escribo lo más simple posible
- El problema que ocurrió aquí fue que falló al reiniciar porque no terminó normalmente la ejecución del archivo ejecutable
- Actualmente el servidor devuelve 0 si falla el reinicio y 1 si tiene éxito, reintentando en caso de fallo.
- El problema fue que ocurrió un caso donde el código de salida del archivo ejecutable devolvía un valor diferente a los dos (código de salida diferente a 0,1)
<br>→ El manejo de excepciones para `códigos de salida que ocurren por varias razones (timeout, memoria insuficiente, valores custom devueltos por ese archivo ejecutable, etc.)` necesitaba complementación, así que al final el servidor tampoco reinició

### 3. Fallo del método shutdownConsumer que termina el servidor

- Para el manejo de excepciones de 2, el servicio termina la instancia del servidor. (Como el reinicio también falló, considera que hay problema desde el proceso de inicialización de ese servidor y termina para lanzar nueva instancia Spot)
  - El propósito de este método es que como el swap memory es insuficiente y el reinicio del proceso AI falló, en lugar de reiniciar continuamente, terminar la instancia Spot y obtener nueva instancia
- **El problema fue legacy de método mal hecho donde no se capturaba error aunque no se ejecutó normalmente**
- **¿Si no se ejecutó normalmente cuál fue la razón?**
  - Este legacy ejecuta archivo ejecutable que termina el servidor pero hay parte omitida en el manejo de código de salida.. (hizo manejo de exitcode 0,1 pero si aparece otro código de salida..? → problema)
  - `El caso de llegar al proceso 3 era raro (fallo en 2, otro código de salida en 3) y más problemático que eso era la falta de código de prueba`

### 4. Como el servidor no se terminó, java reconoce como normal y ejecuta la siguiente lógica…

1) El servidor AI obviamente no pudo reiniciar así que está muerto, la solicitud falla y lanza error
<br>→ Ese error es capturado por el consumidor de imágenes (clase superior que llamó)
2) Aquí necesitas saber la situación `5` abajo..

### 5. El proceso de boot inicial del servidor incluye procesamiento a través de datos de muestra (no solicitud real) para inicio rápido del proceso AI

1) El consumidor existente cancela la cola de mensajes para que la solicitud real del usuario no se pierda.. ¿en el aire? cuando el proceso AI no puede generar
2) El problema es que en el caso de datos de muestra, como no son datos reales de la cola de mensajes
<br>si haces `basicreject`, como **deliveryTag ya fue ack** (no era mensaje enviado y recibido sino datos dummy, así que no tenía nada que ver con la cola de mensajes en absoluto)
<br>en ese momento se cortó incluso la conexión normal con la cola de mensajes..
3) Y continúa verificando el estado del servidor pero como el `proceso AI` está muerto, envía notificación de error y entra en estado de espera indefinida

### 6. La cola ya cortada..
1) El desarrollador que reconoció la situación de `4` reinició manualmente el `proceso AI` rápidamente y pensó que procesaría el siguiente mensaje de cola pero…
2) Como la cola ya se cortó, no puede procesar mensajes y ocurre error `channel is already closed due to channel error; protocol method…..`

## Puntos problemáticos y consideraciones

1. **Como verificó memoria cuando el swap memory no estaba configurado**, necesariamente re-ejecutaba el proceso AI
  - Problema fundamental, si el problema 1 no hubiera ocurrido todo habría funcionado normalmente
  - Falta de notificación Slack cuando hay insuficiencia en verificación de memoria
  - Falta de lógica de verificación de configuración de swap memory
2. Si falla la re-ejecución **hace shutdownConsumer pero no funciona normalmente** + no se captura error
  - Si llamas método shutdown directamente en el servidor con `jshell` → funciona normalmente = problema de permisos, funcionamiento de la función misma etc. no es problema x
  - La parte actualmente omitida es el manejo según código de salida (*caso donde no hubo error durante ejecución pero código de salida no es 0*)
  - **Primero, ¿realmente se necesita la función de terminar instancia?**
    - Sí, en lugar de repetir la lógica 1, 2 en lugar de terminación de instancia, no se sabe cuántas veces repetir (podría ser problema de la instancia misma) + la terminación de instancia Spot y reasignación es más razonable que consumir recursos repitiendo muchas veces
3. Está haciendo basicreject en caso de fallo de procesamiento de datos de muestra (no mensaje real de cola de mensajes) - **no debe hacer reject si no es mensaje de cola**
  - En verificación de memoria, en primera solicitud después de catch de excepción, notificación y espera

## Solución exitosa

1. *Verificar si la memoria está configurada (*`ManagementFactory.*getPlatformMBeanServer`)* si total y free swap son 0 (= no configurado) saltar*
2. Verificación de código de salida del script de terminación ec2
- Escribir con este tipo de sensación

```java
    int exitCode;
    var processBuilder = new ProcessBuilder();
    var process = processBuilder.command(
            "aws", "ec2", "terminate-instances",
            "--instance-ids", instanceId,
            "--region", region
    ).start();
    exitCode = process.waitFor();

    if (exitCode == 0) {
        return;
    }

    // Caso donde no hubo error durante ejecución pero código de salida no es 0 (operación anormal)
    String errorMsg;
    try {
        errorMsg = IOUtils.toString(process.getErrorStream(), StandardCharsets.UTF_8);
    } catch (Exception e) {
        errorMsg = "Error durante extracción de mensaje de error " + e.getMessage();
    }
    throw new RuntimeException(errorMsg);
```

3. Modificación del procesamiento basicAck existente

   1. Si el ack se retrasa, ¿hay problema para que el usuario reciba la imagen, hay punto problemático para otro consumidor o el consumidor mismo?
   - Debe esperar antes del procesamiento de ack y verificar si el usuario recibe la imagen antes
     <br>
     → Recibe, por lo tanto después de que un consumidor reporta completación de generación de imagen para una de las solicitudes de ese usuario <br>incluso si toma mucho tiempo en lógica de verificación de memoria o la instancia se termina, no hay problema para que otros consumidores procesen el resto (antes como hacía ack primero, la siguiente imagen estaba en estado unacked y otros consumidores no podían tocarla)
     <br><br>
   - Antes del procesamiento de ack (en situación donde generación de imagen y reporte terminó), verificar si hace bien reject de cola cuando ocurre error<br><br>
   2. ¿Hay parte problemática si ocurre excepción en procesamiento de trabajo después de mover basicack abajo? (como parte donde no se cancela cola)<br><br>
   3. ¿Qué pasa si ocurre excepción (i/o exception) durante basicAck?
   - Antes hacía reject de cola - como el reporte de completación de imagen ya estaba hecho, solo hacer reject de cola no hay problema para que usuario reciba imagen
   - Probar qué pasa si simplemente se lanza la excepción
     - **Lo importante es que no debe haber problema para el procesamiento de siguiente imagen**

     → No se debe dejar simplemente lanzar, solo se imprime la excepción y lo que estaba unacked (si eran 4 mensajes, en el caso donde ocurrió excepción en ack después de procesar y reportar completación para el primer mensaje) vuelve a ready problema (**primer problema**) segundo es que `no consume siguiente mensaje y simplemente se detiene`

     → Primero verificar si es problema de estado de proceso AI y luego manejar error

# Retrospectiva

<aside>
💡   De hecho, mi descuido de fallar en entender este historial o simplemente pasar el legacy también fue problema. Y después de experimentar este problema, aprendí que es importante darse cuenta de cómo la existencia del código legacy o el historial anterior no simplemente se abandona, sino cómo está conectado con los puntos problemáticos actuales.

Lo más importante es que creo que debo entender más profundamente el código del equipo o el historial del proyecto. Solo así puedo considerar por qué ese código fue escrito así y los sideEffects que pueden ocurrir en las revisiones también.

<br>+ El texto es muy largo pero mientras intentaba explicar la situación del problema excluyendo detalles específicos del trabajo real, parece haberse convertido en un texto para revisión personal..
</aside>

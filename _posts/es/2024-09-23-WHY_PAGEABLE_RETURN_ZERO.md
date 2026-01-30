---
title: ¿Por qué cuando Pageable es parámetro, no ocurre error con PageNo muy grande y se convierte a 0?
description: Análisis de la causa y principio de operación interno del fenómeno donde valores de página que exceden el rango int se convierten a 0 en Spring Boot Pageable.
date: 2024-09-23 20:19:42 +0900
categories: [Issue]
tags: [Issue, Pageable, Spring, Java]
author: w-seok
lang: es-ES
faq:
  - question: "¿Por qué no ocurre error al ingresar valores de página que exceden el rango int en Pageable?"
    answer: "La clase PageableHandlerMethodArgumentResolverSupport de Spring captura NumberFormatException y devuelve un valor predeterminado de 0."
  - question: "¿Por qué ocurre error al implementar directamente con @RequestParam?"
    answer: "@RequestParam intenta la conversión a int sin manejo de excepciones separado, por lo que ocurre un error 400 Bad Request en HandlerExceptionResolver al exceder el rango int."
  - question: "¿Se puede personalizar este comportamiento?"
    answer: "Puede personalizar PageableHandlerMethodArgumentResolver o usar @Valid con un validador personalizado para limitar los rangos de valores de página."
---

## Entorno de la situación

- `spring boot 3.2.9`, `jdk` 17

## Situación que ocurrió

> Mientras implementaba consulta de paginación de datos grandes, descubrí un fenómeno interesante. (Si ya lo sabe, pase)
<br><br>**Al usar parámetro `Pageable`**, a pesar de ingresar un número muy grande que excede el rango `int` (ej: `10 mil millones`) como valor de `page`
<br>contrario a lo esperado (diferente al método de implementación directa) **no ocurrió error y consultó la primera página (pageNo = 0) devolviendo el resultado**.
<br><br>Fue un resultado diferente a cuando lo implementé directamente usando @RequestParam antes
<br>En este artículo veremos la causa y cómo está operando.

## ¿Qué es Pagination usando Pageable?

Generalmente, muchos foros web no muestran todas las publicaciones a la vez sino que las proporcionan divididas por página por número de página.

También puede configurar el método de ordenación para establecer la prioridad de la información que desea ver, **entregar información según la solicitud del método de ordenación, tamaño de página y qué número de página es Pagination.**

El desarrollador puede implementar esto directamente, pero `Spring Data` proporciona una interfaz llamada `Pageable` para usar esto convenientemente.

## Recreación de la situación

### Consulta usando Pageable

Como la imagen de abajo, recreé simplemente un método que recibe `Pageable` como parámetro para consulta.

![issue - 1 - image](/assets/img/post/why-pageable-return-zero/issue-1.webp)

En este caso, cuando solicité consulta estableciendo querystring `page` a 10 mil millones, **contrario a lo esperado podemos confirmar que consulta la página 0.**

![issue - 2 - image](/assets/img/post/why-pageable-return-zero/issue-2.webp)

Apariencia de traer la primera página

![issue - 3 - image](/assets/img/post/why-pageable-return-zero/issue-3.webp)


### Consulta a través de implementación directa con @requestParam

En el contenido anterior de hecho pensé que era interesante.. porque recuerdo que cuando implementé directamente usando requestParam sin usar pageable antes
ocurrió error con respuesta `400 bad request`.

Así que recreé una vez más abajo y como esperaba como la imagen de abajo **ocurrió error de que falló al convertir ese valor a int en `HandlerExceptionResolver`.**

![issue - 4 - image](/assets/img/post/why-pageable-return-zero/issue-4.webp)

![issue - 5 - image](/assets/img/post/why-pageable-return-zero/issue-5.webp)

![issue - 6 - image](/assets/img/post/why-pageable-return-zero/issue-6.webp)

## ¿Por qué no ocurre error?

Para encontrar la causa de este fenómeno hice depuración,

Aprendí que en `Spring` cuando recibe objeto `Pageable` directamente como parámetro, opera la clase `PageableHandlerMethodArgumentResolverSupport`.

![issue - 7 - image](/assets/img/post/why-pageable-return-zero/issue-7.webp)


Esta clase tiene el rol de convertir parámetros de solicitud a objeto `Pageable` a través del método `getPageable`.
<br>En este proceso se llama el método `parseAndApplyBoundaries`, y la causa del artículo ocurre en este método.

El método `parseAndApplyBoundaries` está capturando `NumberFormatException` que ocurre cuando el número de página es demasiado grande (excede 2.1 mil millones), <br>
Gracias a esto, está diseñado para devolver la primera página (0) en el acceso real de datos.<br>
Como resultado **incluso si ingresa un valor que excede el rango int, no ocurre error y se devuelve la primera página..**

![issue - 8 - image](/assets/img/post/why-pageable-return-zero/issue-8.webp)

## Conclusión

Si entiende este método de operación al usar `Pageable`, también será más fácil manejar claramente cuando ocurra la misma situación.
Espero que este artículo ayude a entender casos especiales donde opera diferente a la forma existente de implementación al usar `Pageable`, y ayude en una mejor implementación de paginación.

## Referencia

[PageableHandlerMethodArgumentResolverSupport](https://docs.spring.io/spring-data/commons/docs/current/api/org/springframework/data/web/PageableHandlerMethodArgumentResolverSupport.html)
<br>[pagination](https://tecoble.techcourse.co.kr/post/2021-08-15-pageable/)

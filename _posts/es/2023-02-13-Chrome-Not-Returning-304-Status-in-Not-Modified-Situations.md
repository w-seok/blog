---
title: Problema de Chrome que no devuelve estado 304 en situaciones Not-Modified
description: Análisis de la causa y solución del problema donde Chrome no devuelve 304 Not Modified al usar Cache-Control y ETag para caché.
date: 2023-02-13 23:07:00 +0900
categories: [Issue]
tags: [Issue, Chrome, Not Modified, HTTP Status Code]
author: w-seok
lang: es-ES
---
Situación del problema
---
> Durante el desarrollo de un proyecto paralelo que proporciona listas de imágenes específicas a los usuarios, el tamaño de las listas de imágenes servidas era grande y los cambios (`Insert`, `Update`, `Delete`) eran poco frecuentes con muchas operaciones de lectura, lo que requería caché.
<br><br>Por lo tanto, después de configurar la caché local, implementé lógica para recibir `HttpStatus Not-Modified` a través de validación con `Etag` cuando los datos en caché expiran usando valores de `Cache-Control` y `Etag`.
<br><br>Este artículo trata sobre la situación en el navegador Chrome donde, a pesar de que el valor `Etag` era el mismo durante la revalidación debido a la expiración de caché, devolvía `200` en lugar de `304`.

Entorno y stack de la situación
---
- Versión del navegador Chrome - versión 96 (diciembre 2021)
- `spring boot 2.7.1`, `jdk` 11
- `curl` - Solicitud directa desde terminal en lugar del entorno del navegador para verificar la situación
- `wireshark` - Captura de paquetes intercambiados con el servidor para verificar valores de respuesta y headers de solicitud

Causa del problema
---
[1269602 - chromium - Un proyecto de código abierto para ayudar a avanzar la web. - Monorail](https://bugs.chromium.org/p/chromium/issues/detail?id=1269602)

Este problema fue un bug del navegador Chrome que existía hasta la versión 96, confirmado en los issues de bugs de Chromium.

El laptop usado fue comprado alrededor de marzo de 2022 y tenía Chrome instalado (descuidado), con la opción de actualización automática de Chrome deshabilitada y estaba en la versión 96 que era la última versión en ese momento, causando este problema.

Hay comentarios diciendo que ocurrió hasta la versión 105.. según otros artículos parece que el problema aún existe actualmente..

![issue - image](/assets/img/post/chrome-not-returning/issue-image.webp)

¿Qué pasa en Chrome actual después de actualizar?

Después de que ocurrió el problema anterior y actualizar Chrome, confirmé que funciona normalmente en la última versión.

![304-return](/assets/img/post/chrome-not-returning/304-return.webp)


Recreación de la situación
---
### Código API del servidor

```java
/**
	* Al solicitar a esta api, recibirá una lista de imágenes.
	* Para recreación de pruebas, se estableció un valor de ejemplo en etag y no-cache en el header de respuesta.
	* En implementación real, usar hash de recurso o versión y max-age=60, must-revalidate
	* Después de la primera solicitud, poner el valor etag recibido en if-none-match para comparar y devolver 304 si son iguales
	*
	* @param pageNo
	* @param pageSize
	* @param blockSize
	* @return
*/
@GetMapping("/backoffice/templates/api")
public ResponseEntity<List<ImageTemplateDto>> getImageTemplatesRest(
        @RequestHeader(value = "If-None-Match", required = false) String requestETag,
        @RequestParam(required = false, defaultValue = "1") int pageNo,
        @RequestParam(required = false, defaultValue = "7") int pageSize,
        @RequestParam(required = false, defaultValue = "3") int blockSize) {
    try {
        List<ImageTemplateDto> imageTemplateDtoList = imageTemplateService.getList(pageNo, pageSize, blockSize);

        String etag = "example-etag";

        return ResponseEntity
                .ok()
                .eTag(etag)
                .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                .body(imageTemplateDtoList.stream()
                        .limit(pageSize)
                        .collect(Collectors.toList()));
    } catch (InterruptedException interruptedException) {
        return null;
    }
}
```

- La configuración actual de `Cache-Control` es `no-cache`, por lo que siempre valida en el servidor.
- El valor de `etag` está hardcodeado, así que desde la segunda solicitud en adelante debe devolver `304 status`.
- Además, como es `not-modified`, el servidor no envía el valor `body` al cliente (navegador), por lo que el tamaño del body recibido será diferente (más pequeño) que la primera solicitud.

### En Chrome (versión 96)

![96-version-problem](/assets/img/post/chrome-not-returning/96version-200-problem.webp)

- Verificando el tamaño recibido, significa que el navegador usó recursos cacheados sin recibirlos del servidor

![resource-caching](/assets/img/post/chrome-not-returning/resource-caching.webp)

- Claramente if-none-match está en el header de solicitud

### Safari

- También desde la segunda solicitud, devuelve 304 correctamente sin recibir el recurso original del servidor

![safari](/assets/img/post/chrome-not-returning/safari-304-return.webp)

### Edge

- Edge también devuelve 304 correctamente desde la segunda solicitud sin recibir el recurso original del servidor

![edge](/assets/img/post/chrome-not-returning/edge-304-return.webp)

---

---

## ¿Es confiable el navegador?

### Causa

> Claramente el servidor piensa que dio 304 y el navegador que recibió la respuesta nos la muestra. Entonces ¿por qué pueden ser diferentes?

Resumiendo el proceso cuando hacemos clic en un enlace en el navegador y vemos el sitio:

1. **Solicitud URL y búsqueda DNS**: Cuando el usuario ingresa una URL o hace clic en un enlace, el navegador verifica la caché local y, si es necesario, realiza una búsqueda DNS para convertir el dominio a dirección IP
2. **Conexión al servidor y configuración de seguridad**: El navegador establece conexión TCP con el servidor, y en caso de HTTPS, realiza handshake SSL/TLS
3. **Solicitud y respuesta HTTP**: Después de la conexión, envía solicitud HTTP al servidor, y el servidor la procesa y devuelve respuesta HTTP.
4. **Procesamiento de recursos**: Luego el navegador analiza y procesa los recursos recibidos como HTML, CSS, JavaScript, etc.
5. **Renderizado**: El navegador genera el árbol de renderizado basándose en los recursos procesados, calcula el layout y pinta en pantalla.

**Es decir, aunque cada navegador generalmente intenta seguir estándares web (W3C, IETF, etc.), tienen su propia interpretación e implementación, por lo que el renderizado puede diferir entre navegadores en versiones específicas y tecnologías**

- Chrome podría estar correcto (aunque es poco probable) o la `spring application` podría estar devolviendo `200` en lugar de `304` desde el principio y otros navegadores (`edge, safari`) simplemente lo muestran como 304.

## Verificar con curl

> Por lo tanto, debemos verificar si Chrome está mal, si Spring está mal, o si otros navegadores están mal, enviando solicitudes directamente al servidor a través de curl y verificando las respuestas

curl es una herramienta independiente separada del navegador, por lo que puede comunicarse con el servidor y recibir respuestas independientemente del comportamiento del navegador

### Resultado

- Como se muestra en la imagen de abajo, al agregar `If-None-Match` al header, podemos confirmar que devuelve 304.
- Es decir, el recurso recibido del servidor antes del proceso de renderizado del navegador es 304 correctamente, y Spring no es el problema

![curl-no-header](/assets/img/post/chrome-not-returning/curl-200.webp)

![curl-header](/assets/img/post/chrome-not-returning/curl-304.webp)

### ¿Es curl confiable?

[curl - github](https://github.com/curl/curl)

- Desde 1997, realmente muchas personas lo han usado y la comunidad es activa, por lo que tiene alta confiabilidad ya que el código es revisado por muchos ojos como característica de proyectos de código abierto
- El hecho de que el lanzamiento reciente (8.4) fue a principios de octubre de 2023 significa que los desarrolladores participan continuamente en el proyecto
- Por supuesto, todavía hay vulnerabilidades y si preguntas si es completamente confiable, creo que no. Porque hay muchos casos de bugs relacionados con respuestas HTTP como resultado de su larga historia

#### Casos de bugs relacionados con respuestas HTTP de curl

[curl - HTTP Proxy deny use after free - CVE-2022-43552](https://curl.se/docs/CVE-2022-43552.html)

[curl - HTTP headers eat all memory - CVE-2023-38039](https://curl.se/docs/CVE-2023-38039.html)

[curl - HTTP multi-header compression denial of service - CVE-2023-23916](https://curl.se/docs/CVE-2023-23916.html)

---

## ¿Cuál es la forma más confiable?

[wireShark](https://gitlab.com/wireshark/wireshark)

> Para esta situación problemática elegí wireshark para verificar solicitudes/respuestas con el servidor,
<br><br>1. Siendo un proyecto de código abierto, es fácilmente verificable
<br>2. Como es posible el análisis de paquetes de red, puede capturar y analizar todos los paquetes transmitidos en la red.

Con estas razones, proceso de verificación después de instalar wireshark

- Primero, como el entorno de recreación es local, solo verificar paquetes loopback

![wire-1](/assets/img/post/chrome-not-returning/wire-1.webp)

- Luego aplico filtro http para verificar solicitudes/respuestas de API. Confirmo que solicitud y respuesta están registradas
- También verifico que la respuesta vino exactamente como 304

![wire-2](/assets/img/post/chrome-not-returning/wire-2.webp)

![wire-3](/assets/img/post/chrome-not-returning/wire-3.webp)

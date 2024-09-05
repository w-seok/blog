---
title: Verificar swap memory del servidor en tiempo real con JShell
description: Introducción al método de monitoreo del estado de Swap Memory del servidor en tiempo real usando JShell.
date: 2023-03-10 22:39:23 +0900
categories: [Programming, Java]
tags: [Short, JShell, Swap Memory]
author: w-seok
lang: es-ES
---
Situación del problema
---
> ¿Cuáles son los métodos para verificar en tiempo real el `swap memory` configurado del servidor que está sirviendo actualmente y cuánto espacio libre hay?
<br>Puedes etiquetar esos valores y hacer polling para verificar en el servidor de monitoreo, o verificar directamente en el servidor.
<br>En este artículo, quiero organizar el método para verificar el `swap memory` del servidor en tiempo real usando `JShell`

Entorno y stack de la situación
---
- [Posible desde `java 9` en adelante](https://docs.oracle.com/en/java/javase/22/jshell/introduction-jshell.html#GUID-630F27C8-1195-4989-9F6B-2C51D46F52C8)

## Verificar Swap Memory usando JShell

```shell
// Ejecutar JShell
$ jshell
```
```java
// Import de comandos a usar en JShell
import java.lang.management.ManagementFactory;
import javax.management.*;
import java.util.logging.Logger;

var DOMAIN = "java.lang";
var OBJECT_KEY = "type";
var OBJECT_VALUE = "OperatingSystem";

var mBeanServer = ManagementFactory.getPlatformMBeanServer();
var objectName = new ObjectName(DOMAIN + ":" + OBJECT_KEY + "=" + OBJECT_VALUE);

var totalSwapSpaceSize = Long.parseLong(mBeanServer.getAttribute(objectName, "TotalSwapSpaceSize").toString());
var freeSwapSpaceSize = Long.parseLong(mBeanServer.getAttribute(objectName, "FreeSwapSpaceSize").toString());

Logger log = Logger.getLogger("MyLogger");
log.info("Total Swap Space Size: " + totalSwapSpaceSize);
log.info("Free Swap Space Size: " + freeSwapSpaceSize);
```

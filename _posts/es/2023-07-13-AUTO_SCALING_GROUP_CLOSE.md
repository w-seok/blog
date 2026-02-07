---
title: Terminación inesperada de instancias Spot en AutoScaling Group
description: Análisis de causas y medidas de respuesta para el fenómeno de terminación inesperada de instancias Spot en AWS AutoScaling Group.
date: 2023-07-13 22:37:31 +0900
categories: [Issue]
tags: [Issue, AutoScaling Group, AWS, Spot Instance]
author: w-seok
lang: es-ES
faq:
  - question: "¿Por qué se terminan las instancias spot en AWS AutoScaling Group sin ser reclamadas forzosamente?"
    answer: "AutoScaling Group intenta distribuir uniformemente las instancias entre las Zonas de Disponibilidad (AZ). Si una AZ particular tiene más instancias, termina instancias en esa AZ y lanza nuevas en AZs con menos instancias para mantener el equilibrio."
  - question: "¿Cómo se puede distinguir entre terminación por balanceo de AZ y reclamación forzada de instancia spot?"
    answer: "Se puede verificar la razón de terminación en el Activity History de la consola de AWS. Para balanceo de AZ, se registran mensajes como 'an instance was launched to balance instances across zones'."
---

Introducción
---
>Una instancia Spot en operación en AWS AutoScaling Group se terminó inesperadamente. Esta no fue una terminación por recuperación forzada sino por otra razón, y analicé la causa, el impacto y las medidas de respuesta.

## Situación del problema

### 1. Fenómeno

- Una instancia Spot consumiendo cola de mensajes se terminó aunque no fue recuperada forzadamente
- Recibí notificación de que se inició una nueva instancia
- Afortunadamente, otro servidor procesó los mensajes `requeue` y no hubo interrupción del servicio

Log de AutoScaling Group
---
```text
At 2023-07-09T00:32:21Z instances were launched to balance instances
in zones null with other zones resulting in more than desired number
of instances in the group.
At 2023-07-09T00:46:17Z availability zones
had 4 1 instances respectively. An instance was launched to aid in
balancing the group's zones.
```

Mirando el contenido en detalle:
```text
Las zonas de disponibilidad son ubicaciones aisladas dentro de una región. Son zonas independientes, por ejemplo us-west-2a, us-west-2b, us-west-2c
AutoScaling lanza instancias distribuidas uniformemente en cada zona de disponibilidad

En este momento, lanza instancias en la zona de disponibilidad con menos instancias activas y termina instancias en otros lugares para realizar esto.
```

Conclusión
---

- **Es decir, fue un problema causado por terminar instancias que están muy activas en una región para distribuir uniformemente el número de instancias a lanzar en cada región**
- **Afortunadamente, es muy raro que una instancia procesando solicitudes de usuarios muera, y casi siempre es una instancia recién lanzada que se termina, e incluso si una instancia procesando solicitudes muere, los mensajes no procesados se `requeue` de vuelta a la cola, por lo que la solución fue solo registrar logs de Slack**

![result - image](/assets/img/post/auto-scaling-group-close/issue.webp)

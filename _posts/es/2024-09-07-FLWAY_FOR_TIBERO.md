---
title: Implementación de Flyway para Tibero y contribución Open Source
description: Compartiendo la experiencia de implementar la herramienta de migración Flyway para base de datos Tibero y contribuir al código abierto.
date: 2024-09-07 23:59:01 +0900
categories: [Programming, Database]
tags: [Flyway, Open Source, Tibero]
author: w-seok
lang: es-ES
faq:
  - question: "¿Cómo resolvieron la falta de soporte oficial de Flyway para Tibero?"
    answer: "Aprovechando las similitudes sintácticas entre Tibero y Oracle, implementamos directamente un módulo Tibero basado en el código de soporte Oracle de Flyway, implementando 6 comandos: baseline, migrate, clean, info, validate y repair."
  - question: "¿Cuáles son las diferencias clave entre Oracle y Tibero al implementar Flyway clean?"
    answer: "Los nombres de objetos de esquema, métodos de consulta y objetos no soportados difieren entre Oracle y Tibero, requiriendo construcción de consultas separadas para cada tipo de objeto referenciando la documentación oficial de Tibero."
  - question: "¿Cuál fue el proceso de contribución como código abierto?"
    answer: "Después de identificar otros desarrolladores con las mismas necesidades en los issues de GitHub de Flyway, contribuimos la implementación completada como código abierto. Como los mantenedores de Flyway no tenían planes de soporte oficial, se resolvió mediante contribución de la comunidad."
howto:
  name: "Cómo implementar soporte de base de datos Tibero en Flyway"
  description: "Cómo implementar una herramienta de migración para la base de datos Tibero que Flyway no soporta oficialmente"
  totalTime: "PT120M"
  steps:
    - name: "Analizar compatibilidad entre Flyway y Tibero"
      text: "Analice el código de soporte Oracle de Flyway e identifique similitudes y diferencias sintácticas entre Tibero y Oracle."
    - name: "Implementar módulo específico para Tibero"
      text: "Referenciando el código basado en Oracle, implemente los 6 comandos (baseline, migrate, clean, info, validate, repair) adaptados para Tibero."
    - name: "Manejar diferencias de objetos de esquema"
      text: "Referenciando la documentación oficial de Tibero, implemente el manejo de nombres de objetos de esquema, métodos de consulta y objetos no soportados que difieren de Oracle."
    - name: "Probar y contribuir al código abierto"
      text: "Pruebe que los comandos implementados funcionen correctamente en el entorno Tibero, aplíquelos dentro del equipo y luego contribuya como código abierto."
---

## Introducción

En este artículo, me gustaría compartir el proceso de aplicar Flyway para la gestión de versiones DDL de la base de datos Tibero usada en nuestra empresa, y la experiencia posterior de contribución al código abierto.

## Problemas existentes

Cuando me uní al proyecto, había los siguientes problemas relacionados con la gestión de bases de datos:

![issue - 1 - image](/assets/img/post/flyway-for-tibero/issue-1.webp)

1. Código DDL legacy excesivo
  - Modificaciones frecuentes de esquema debido a cambios en requisitos de servicio
  - Inicialización frecuente de base de datos en entornos de desarrollo y local
  - Mayor riesgo de error humano por modificación y ejecución manual de DDL

2. Gestión DDL desorganizada
  - Acumulación masiva de archivos DDL
  - Adiciones/modificaciones/eliminaciones DDL descontroladas basadas en requisitos del equipo
  - Trabajo de cambio de esquema concentrado en individuos específicos

3. Disminución de productividad de desarrollo
  - Dificultad en cambios de esquema DB entre entornos (desarrollo-staging-producción)
  - Mayor carga en separación de DB
  - Complejidad en configuración del entorno de desarrollo

Eventualmente, pensé que estos problemas llevarían seriamente a una disminución de la productividad de desarrollo como se muestra abajo.

![issue - 2 - image](/assets/img/post/flyway-for-tibero/issue-2.webp)

## Solución

Para resolver estos problemas, consideré introducir Flyway, una librería de control de versiones de DB que había usado antes, lo que significaba sin curva de aprendizaje y aplicación rápida.

Sin embargo, hubo un nuevo problema de que Flyway no soporta oficialmente Tibero...

![issue - 3 - image](/assets/img/post/flyway-for-tibero/issue-3.webp)

No solo nuestro equipo sino [otros desarrolladores con las mismas necesidades en GitHub](https://github.com/flyway/flyway/issues/2615) confirmaron este issue,
y mirando la respuesta del mantenedor de Flyway, parecía no haber planes de soporte futuro. Considerando las similitudes sintácticas entre Oracle y Tibero, que ya está soportado,

Pensé que necesitaba implementarlo yo mismo para prevenir issues de DB Migration que podrían ocurrir fácilmente en la situación actual.

![issue - 4 - image](/assets/img/post/flyway-for-tibero/issue-4.webp)

## Establecimiento de objetivos del proyecto

Los miembros de nuestro equipo estuvieron de acuerdo, y comenzamos el proyecto con los siguientes objetivos:

![issue - 5 - image](/assets/img/post/flyway-for-tibero/issue-5.webp)

## Proceso de implementación

Nuestro objetivo fue implementar 6 de los comandos básicos de Flyway (baseline, migrate, clean, info, validate, repair), excluyendo 'undo' que es una característica de la versión Pro.

![issue - 6 - image](/assets/img/post/flyway-for-tibero/issue-6.webp)

Como hay mucho contenido de implementación, en lugar de describir todo en el blog, me centraré en las partes que diferían de Oracle y las dificultades encontradas con sus soluciones.

**Primero, la parte más consumidora de tiempo y difícil de la implementación fue el comando `clean`.**

Como la función `clean` de Flyway elimina todos los objetos de esquema, necesita verificar la existencia de cada objeto de esquema y eliminarlos.

En este proceso, las diferencias entre Tibero y Oracle fueron prominentes `(nombres de objetos de esquema, métodos de consulta, objetos no soportados, etc.)` eran diferentes entre las dos bases de datos,

así que tuve que revisar cuidadosamente la documentación oficial de Tibero y escribir sentencias de consulta apropiadas para cada objeto.

### 1. Diferencias entre Oracle y Tibero en Flyway Clean

Por ejemplo, `Oracle` usa `ALL_SDO_GEOM_METADATA` para consultar metadatos específicos, pero en `Tibero`, teníamos que usar el correspondiente `ALL_GEOMETRY_COLUMNS`.

Como se muestra abajo, mirando la implementación del método `flyway clean` de `Oracle`, hay una tarea para eliminar `locatorMetadata` primero antes de la operación clean:

```java
 private boolean locatorMetadataExists() throws SQLException {
  return database.queryReturnsRows("SELECT * FROM ALL_SDO_GEOM_METADATA WHERE OWNER = ?", name);
}

private void cleanLocatorMetadata() throws SQLException {
        if (!locatorMetadataExists()) {
            return;
        }

        if (!isDefaultSchemaForUser()) {
            LOG.warn("Unable to clean Oracle Locator metadata for schema " + database.quote(name) +
                             " by user \"" + database.doGetCurrentUser() + "\": unsupported operation");
            return;
        }

        jdbcTemplate.getConnection().commit();
        jdbcTemplate.execute("DELETE FROM USER_SDO_GEOM_METADATA");
        jdbcTemplate.getConnection().commit();
    }
```

Para Tibero, la parte correspondiente a `ALL_SDO_GEOM_METADATA` es `ALL_GEOMETRY_COLUMNS`, así que necesitábamos agregar el trabajo para eliminar esa parte.

```java
private void cleanLocatorMetadata() throws SQLException {
		if (!locatorMetadataExists()) {
			return;
		}

		if (!isDefaultSchemaForUser()) {
			return;
		}

		jdbcTemplate.getConnection().commit();
		jdbcTemplate.execute("DELETE FROM USER_GEOMETRY_COLUMNS");
		jdbcTemplate.getConnection().commit();
	}

	private boolean locatorMetadataExists() throws SQLException {
		return database.queryReturnsRows("SELECT * FROM ALL_GEOMETRY_COLUMNS WHERE F_TABLE_SCHEMA = ?",
			name);
	}
```

También, para queueTable, hay consideraciones al vaciar en Tibero: [oracle](https://docs.oracle.com/cd/B13789_01/server.101/b10755/statviews_1125.htm), [tibero - queue table](https://technet.tmaxsoft.com/upload/download/online/tibero/pver-20150504-000001/tibero_pkg/chap_dbms_aqadm.html#DBMS_AQADM_CREATE_QUEUE)

1. Para queue_table, en Tibero también se consulta en all_tables, así que necesitamos agregar consulta para excluirlo si también se consulta en all_queue_tables
2. Para queue_table, un lob index también se crea al crear, y el lob index asociado se elimina automáticamente al eliminar la queue table
3. Por lo tanto, al consultar objetos index, los lob indexes deben excluirse para prevenir errores

```java
// Todos los indexes, excepto domain indexes y lob indexes, deben eliminarse después de las tablas (si quedan).
        INDEX("INDEX") {
          @Override
          public List<String> getObjectNames (JdbcTemplate jdbcTemplate, TiberoDatabase database,
            TiberoSchema schema) throws SQLException {
            return jdbcTemplate.queryForStringList(
              "SELECT INDEX_NAME FROM ALL_INDEXES WHERE OWNER = ?" +
                " AND INDEX_NAME NOT LIKE 'SYS_C%'" +
                " AND INDEX_TYPE NOT LIKE '%DOMAIN%'" +
                " AND INDEX_TYPE NOT LIKE '%LOB%'",
              schema.getName()
            );
          }
        }
```

Además de estos, me referí a la documentación oficial de Tibero y probé yo mismo las partes sintácticamente diferentes
<br>para implementar las características de Flyway.

[Ver implementación detallada aquí](https://github.com/Tibero-Support/flyway-community-db-support)

### 2. Prueba de Flyway Tibero con Testcontainers

Finalmente, para que los miembros del equipo y todos los que usen este código implementado confíen y lo usen,
escribir código de prueba era esencial.

El problema era que `Tibero` no tiene una `docker image` oficial, y `testcontainers` tampoco soporta `Tibero` como módulo,
así que ambos necesitaban implementación...

En este artículo, solo dejaré enlaces a recursos implementados exitosamente y publicados públicamente<br>
[tibero-docker - github](https://github.com/Tibero-Support/tibero-docker-doc/pkgs/container/tibero7)
<br>[testcontainers-tibero - github](https://github.com/Tibero-Support/tibero-test-container)

Esta parte continuará en el siguiente artículo...

## Contribución Open Source

Como el Flyway implementado para Tibero fue usado dentro del equipo,
funcionó sin problemas como el equipo originalmente pretendía, y otros equipos pudieron aplicarlo fácilmente basándose en la documentación.

Por lo tanto, decidimos hacer una [contribución open source](https://github.com/flyway/flyway-community-db-support/pull/58) con acuerdo, para ayudar a desarrolladores que usan Tibero y tienen las mismas necesidades que nosotros.

## Conclusión

La contribución open source fue mi segunda contribución open source después de la localización coreana de MDN,<br>
y creo que las partes que implementamos (tibero-docker, tibero flyway) ayudaron al equipo y también ayudaron a llenar la brecha de conocimiento de Tibero que tenía mientras desarrollaba.

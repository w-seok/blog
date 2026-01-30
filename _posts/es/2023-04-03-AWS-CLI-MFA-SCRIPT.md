---
title: Script de automatización de renovación MFA para AWS-CLI
description: Compartiendo el método de creación de scripts shell para automatizar la autenticación MFA en múltiples regiones de AWS. Resuelve la molestia de autenticación repetitiva al usar AWS CLI.
date: 2023-04-03 21:19:04 +0900
categories: [Programming, SHELL]
tags: [AWS, Shell, MFA]
author: w-seok
lang: es-ES
howto:
  name: "Cómo Configurar el Script de Automatización de Autenticación MFA de AWS CLI"
  description: "Cómo escribir y ejecutar un script shell que automatiza la autenticación MFA en AWS CLI"
  totalTime: "PT10M"
  steps:
    - name: "Preparar Configuraciones Necesarias"
      text: "Prepare los valores de aws_access_key_id, aws_secret_access_key, aws_region, arn_number, duration_time."
    - name: "Crear Archivo de Script"
      text: "Guarde el código anterior como archivo aws_login.sh e ingrese las configuraciones."
    - name: "Otorgar Permiso de Ejecución"
      text: "Otorgue permiso de ejecución con el comando chmod +x aws_login.sh."
    - name: "Ejecutar Script con Token MFA"
      text: "Ejecute pasando el valor del token MFA como parámetro como ./aws_login.sh 123456."
    - name: "Usar AWS CLI"
      text: "Después de la autenticación, use comandos como aws s3 ls --profile {myProfile}."
---
Introducción
---
> Al usar `AWS CLI` con cuentas que tienen `MFA` habilitado, debes autenticarte a través del token `MFA` del perfil.
<br>Cuando necesitas autenticarte en múltiples regiones, el proceso de autenticación `MFA` para cada perfil puede ser tedioso.
<br><br>Quiero escribir un script local para automatizar esto. (Actualmente se puede recibir el valor `mfa` directamente en el `pc`.. podría ser más simple..)

Consideraciones principales
---
### 1. Análisis de datos Json

- Usar la herramienta estándar Unix `sed` en lugar de la [librería `jq`](https://github.com/jqlang/jq)
- `sed` tiene la ventaja de no requerir instalación adicional, pero solo es aplicable a estructuras `JSON` predecibles
  - Como es literalmente una herramienta de edición de texto, solo ayuda cuando los datos a editar son `predecibles`.
  - En este caso, se usa solo para procesar datos `json` devueltos por `aws sts get-session-token` y como la estructura de datos es fija (**a menos que aws la cambie**) se necesita manejo de `exit code`

### 2. Estructura del script

- Escribir con los valores de configuración necesarios agregados a este script
- Ejecutar el archivo script con el `valor del token mfa` como parámetro `ej) ./aws_login.sh 123456`
- Usar `aws-cli` ej) asumiendo consultar lista de buckets s3 `aws s3 ls --profile {myProfile}`

### 3. Consideraciones de seguridad

- Usar solo en entorno local (contiene información sensible como token MFA, token de acceso)
- También es importante la configuración del tiempo de expiración del token (más tiempo es más conveniente, pero significa más vulnerabilidad de seguridad)

## Código

```shell
#!/bin/bash

# Almacenar valor del token mfa recibido como parámetro en variable
mfa_token=$1

# Configurar valores necesarios para la configuración
aws_access_key_id={}
aws_secret_access_key={}
aws_region={}
arn_number={}
duration_time={}

# Verificar que cada valor de configuración esté ingresado correctamente
if [[ -z $aws_access_key_id || -z $aws_secret_access_key || -z $aws_region || -z $arn_number || -z $duration_time ]]; then
    echo "Las variables de entorno no están configuradas. Por favor verifique e intente de nuevo."
    exit 1
fi

read -p "Primero se limpiará el contenido existente de ~/.aws/config y ~/.aws/credentials. ¿Desea continuar? (y/n): " response
if [[ "$response" != "y" ]]; then
    echo "Terminando el script."
    exit 1
fi

echo "Limpiando config."
> ~/.aws/config

echo "Limpiando credentials."
> ~/.aws/credentials

echo "Limpieza completada"

aws configure set aws_access_key_id $aws_access_key_id
aws configure set aws_secret_access_key $aws_secret_access_key
aws configure set region $aws_region

echo "Configuración completada"

sts_output=$(aws sts get-session-token --serial-number "${arn_number}" --token-code "${mfa_token}" --duration-seconds $duration_time)

# Verificar código de salida (normal:0)
if [ $? -ne 0 ]; then
    echo "Ocurrió un error durante la solicitud de token STS."
    exit 1
fi

echo "STS completado"

access_key_id=$(echo "$sts_output" | sed -n 's/.*"AccessKeyId": "\([^"]*\)".*/\1/p')
secret_access_key=$(echo "$sts_output" | sed -n 's/.*"SecretAccessKey": "\([^"]*\)".*/\1/p')
session_token=$(echo "$sts_output" | sed -n 's/.*"SessionToken": "\([^"]*\)".*/\1/p')

# Verificar si los valores extraídos están vacíos
if [[ -z "$access_key_id" || -z "$secret_access_key" || -z "$session_token" ]]; then
  echo "Falló la extracción de valores de sts_output"
  exit 1
fi

cat <<EOF > ~/.aws/credentials
[default]
aws_access_key_id = ${access_key_id}
aws_secret_access_key = ${secret_access_key}
aws_session_token = ${session_token}
EOF

echo "Éxito"
```

## Resultado

- Como se muestra abajo, ingresando el valor del token mfa, la autenticación mfa se puede hacer muy simplemente.

![result - image](/assets/img/post/aws-cli-mfa/mfa_shell_success.webp)

Sin embargo, también existen limitaciones ya que incluso con script de automatización no fue posible autenticar múltiples perfiles de región a la vez porque, como se muestra abajo, un token mfa ya usado no puede usarse para autenticación de perfil de otra región
  - Necesito considerar un método que permita seleccionar la región deseada y autenticar una por una

```text
An error occurred (AccessDenied) when calling the GetSessionToken operation: MultiFactorAuthentication failed with invalid MFA one time pass code.
Ocurrió un error durante la solicitud de token STS.
```

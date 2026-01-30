---
title: AWS-CLI MFA 갱신 자동화 스크립트
description: 여러 AWS 리전에서 MFA 인증을 자동화하는 쉘 스크립트 작성 방법을 공유합니다. AWS CLI 사용 시 반복 인증의 번거로움을 해결합니다.
date: 2023-04-03 21:19:04 +0900
categories: [Programming, SHELL]
tags: [AWS, Shell, MFA]
author: w-seok
lang: ko-KR
howto:
  name: "AWS CLI MFA 인증 자동화 스크립트 설정 방법"
  description: "AWS CLI에서 MFA 인증을 자동화하는 쉘 스크립트를 작성하고 실행하는 방법"
  totalTime: "PT10M"
  steps:
    - name: "필수 설정값 준비"
      text: "aws_access_key_id, aws_secret_access_key, aws_region, arn_number, duration_time 값을 준비합니다."
    - name: "스크립트 파일 생성"
      text: "위 코드를 aws_login.sh 파일로 저장하고 설정값들을 입력합니다."
    - name: "실행 권한 부여"
      text: "chmod +x aws_login.sh 명령으로 실행 권한을 부여합니다."
    - name: "MFA 토큰으로 스크립트 실행"
      text: "./aws_login.sh 123456 형태로 MFA 토큰값을 파라미터로 전달하여 실행합니다."
    - name: "AWS CLI 사용"
      text: "인증 완료 후 aws s3 ls --profile {myProfile} 등의 명령어를 사용합니다."
---
서두
---
> `AWS CLI`를 사용할 때 `MFA`가 활성화된 계정에서는 프로필의 `MFA` 토큰을 통해 인증을 받아야 한다. 
<br>여러 리전에서 인증을 받아 사용해야 하는 경우, 각 프로필마다 `MFA` 인증을 받는 과정이 번거로울 수 있다. 
<br><br>이를 자동화하기 위한 로컬용 스크립트를 작성하고자한다.(요즘에는 `pc`에서 바로 `mfa` 값을 받던데.. 더 간단할지도..)

주요 고려사항
---
### 1. Json 데이터 파싱

- [`jq` 라이브러리](https://github.com/jqlang/jq) 대신 표준 `Unix` 도구인 `sed`를 사용
- `sed`는 추가 설치가 필요 없는 장점이 있지만, 예상 가능한 `JSON` 구조에만 적용 가능
  - 말그대로 텍스트 편집 도구이기에 편집할 데이터가 `예상가능한 경우에만` 도움된다.
  - 이 경우에는 `aws sts get-session-token`을 통해 반환받은 `json` 데이터를 위해서만 처리하기위해 사용하고 데이터의 구조가 고정적이기에(**aws가 바꾸지않는한**) `exit code` 처리 필요

### 2. 스크립트 구성

- 해당 스크립트에 필요 설정값들을 추가해 작성합니다
- `mfa 토큰값을` 파라미터로 스크립트 파일을 실행합니다 `ex) ./aws_login.sh 123456`
- `aws-cli`를 사용합니다 ex) s3 버킷목록을 조회한다 가정하면 `aws s3 ls --profile {myProfile}`

### 3. 보안 고려사항

- 반드시 로컬 환경에서만 사용 (MFA 토큰값, 액세스 토큰 등의 민감한 정보 포함)
- 또한, 토큰의 만료시간 설정 또한 중요(긴 시간일수록 편하겠지만, 그만큼 보안에 취약하다는 뜻)

## 코드

```shell
#!/bin/bash

# 파라미터로 입력받은 mfa token값을 변수에 저장
mfa_token=$1

# 설정을 위해 필요한 값들을 설정
aws_access_key_id={}
aws_secret_access_key={}
aws_region={}
arn_number={}
duration_time={}

# 각 설정값들을 제대로 넣었는지 체크
if [[ -z $aws_access_key_id || -z $aws_secret_access_key || -z $aws_region || -z $arn_number || -z $duration_time ]]; then
    echo "환경 변수가 설정되어 있지 않습니다. 확인 후 다시 시도해주세요."
    exit 1
fi

read -p "우선 ~/.aws/config와 ~/.aws/credentials 기존 파일 내용을 clear합니다. 계속하시겠습니까? (y/n): " response
if [[ "$response" != "y" ]]; then
    echo "스크립트를 종료합니다."
    exit 1
fi

echo "config를 clear합니다."
> ~/.aws/config

echo "credentials을 clear합니다."
> ~/.aws/credentials

echo "clear complete"

aws configure set aws_access_key_id $aws_access_key_id
aws configure set aws_secret_access_key $aws_secret_access_key
aws configure set region $aws_region

echo "configure complete"

sts_output=$(aws sts get-session-token --serial-number "${arn_number}" --token-code "${mfa_token}" --duration-seconds $duration_time)

# 종료코드(정상:0)로 체크
if [ $? -ne 0 ]; then
    echo "STS 토큰 요청 중 오류가 발생했습니다."
    exit 1
fi

echo "sts complete"

access_key_id=$(echo "$sts_output" | sed -n 's/.*"AccessKeyId": "\([^"]*\)".*/\1/p')
secret_access_key=$(echo "$sts_output" | sed -n 's/.*"SecretAccessKey": "\([^"]*\)".*/\1/p')
session_token=$(echo "$sts_output" | sed -n 's/.*"SessionToken": "\([^"]*\)".*/\1/p')

# 추출된 값이 비어 있는지 확인
if [[ -z "$access_key_id" || -z "$secret_access_key" || -z "$session_token" ]]; then
  echo "sts_output에서 값 추출에 실패했습니"
  exit 1
fi

cat <<EOF > ~/.aws/credentials
[default]
aws_access_key_id = ${access_key_id}
aws_secret_access_key = ${secret_access_key}
aws_session_token = ${session_token}
EOF

echo "success"
```

## 결과

- 아래처럼 mfa 토큰 값을 입력하면 매우 간단하게  mfa인증을 통해서 작업이 가능하다.

![result - image](/assets/img/post/aws-cli-mfa/mfa_shell_success.webp)

다만 한계도 존재하는데 자동화 스크립트여도 여러 리전의 프로필을 한번에 인증하는건 불가능했는데 아래처럼 이미 사용한 mfa토큰을 다른 리전 프로필 인증에 사용할 수 없기때문
  - 원하는 리전을 선택받도록해서 하나하나 인증하는 방식을 고려해봐야함

```text
An error occurred (AccessDenied) when calling the GetSessionToken operation: MultiFactorAuthentication failed with invalid MFA one time pass code. 
STS 토큰 요청 중 오류가 발생했습니다.
```

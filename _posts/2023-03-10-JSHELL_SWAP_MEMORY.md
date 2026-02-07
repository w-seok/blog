---
title: JShell로 서버의 실시간 swap memory 확인하기
description: JShell을 활용하여 서버의 실시간 Swap 메모리 상태를 모니터링하는 방법을 소개합니다.
date: 2023-03-10 22:39:23 +0900
categories: [Programming, Java]
tags: [Short, JShell, Swap Memory]
author: w-seok
lang: ko-KR
faq:
  - question: "JShell이란 무엇이며 어떤 버전부터 사용할 수 있나요?"
    answer: "JShell은 Java 9부터 제공되는 대화형 REPL(Read-Eval-Print Loop) 도구로, 별도의 컴파일 과정 없이 Java 코드를 즉시 실행하고 결과를 확인할 수 있습니다."
  - question: "JShell로 swap memory를 확인하려면 어떤 API를 사용하나요?"
    answer: "ManagementFactory.getPlatformMBeanServer()를 통해 MBeanServer에 접근한 후, java.lang:type=OperatingSystem ObjectName으로 TotalSwapSpaceSize와 FreeSwapSpaceSize 속성을 조회합니다."
howto:
  name: "JShell로 서버의 실시간 Swap Memory 확인하는 방법"
  description: "JShell REPL 환경에서 ManagementFactory API를 사용하여 서버의 swap memory 상태를 확인하는 방법"
  totalTime: "PT5M"
  steps:
    - name: "JShell 실행"
      text: "터미널에서 jshell 명령어를 실행하여 Java REPL 환경에 진입합니다."
    - name: "필요한 클래스 import"
      text: "java.lang.management.ManagementFactory와 javax.management 관련 클래스를 import합니다."
    - name: "MBeanServer 접근 및 ObjectName 설정"
      text: "ManagementFactory.getPlatformMBeanServer()로 MBeanServer에 접근하고, java.lang:type=OperatingSystem ObjectName을 생성합니다."
    - name: "Swap Memory 값 조회"
      text: "mBeanServer.getAttribute()로 TotalSwapSpaceSize와 FreeSwapSpaceSize 속성을 조회하여 swap memory 상태를 확인합니다."
---
문제 상황
---
> 현재 서빙하고있는 서버가 설정해놓은 `swap memory`와 여유 공간이 어느정도 되는지 실시간으로 체크하는 방법에는 무엇이있을까??
<br>해당 값들을 태깅 후 폴링하여 모니터링 서버에서 체크 해도 좋고 직접 서버에서 체크해도 좋다.
<br>글에서는, `JShell`을 사용해 실시간으로 서버의 `swap memory`를 체크하는 방법에 대해 정리하고자 한다

상황 발생 환경 및 스택
---
- [`java 9` 이후 버전부터 가능](https://docs.oracle.com/en/java/javase/22/jshell/introduction-jshell.html#GUID-630F27C8-1195-4989-9F6B-2C51D46F52C8)

## JShell을 사용한 Swap Memory 체크

```shell
// JShell 실행
$ jshell
```
```java
// JShell에서 사용할 명령어 import
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

---
title: JShell로 서버의 실시간 swap memory 확인하기
description: JShell을 활용하여 서버의 실시간 Swap 메모리 상태를 모니터링하는 방법을 소개합니다.
date: 2023-03-10 22:39:23 +0900
categories: [Programming, Java]
tags: [Short, JShell, Swap Memory]
author: w-seok
lang: ko-KR
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

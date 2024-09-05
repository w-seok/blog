---
title: Checking Real-time Swap Memory with JShell
description: Introducing how to monitor real-time swap memory status of servers using JShell.
date: 2023-03-10 22:39:23 +0900
categories: [Programming, Java]
tags: [Short, JShell, Swap Memory]
author: w-seok
lang: en
---
Problem Situation
---
> What methods are there to check the `swap memory` set on the currently serving server and how much free space is available in real-time?
<br>You can tag these values and poll them to check on a monitoring server, or check directly on the server.
<br>In this article, I'll organize how to check the server's `swap memory` in real-time using `JShell`.

Environment and Stack
---
- [Available from `Java 9` onwards](https://docs.oracle.com/en/java/javase/22/jshell/introduction-jshell.html#GUID-630F27C8-1195-4989-9F6B-2C51D46F52C8)

## Checking Swap Memory Using JShell

```shell
// Run JShell
$ jshell
```
```java
// Import commands to use in JShell
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

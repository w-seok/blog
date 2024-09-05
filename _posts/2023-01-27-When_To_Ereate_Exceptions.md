---
title: Exception 생성에 대한 고민
description: Java에서 예외(Exception) 생성 시점과 비용에 대한 고찰. fillInStackTrace 비용과 예외 처리 전략을 다룹니다.
date: 2023-01-27 22:13:20 +0900
categories: [Programming, Java]
tags: [Exception, Error Management]
author: w-seok
lang: ko-KR
---
서두
---
> 개발 과정에서 예외(`Exception`)를 언제, 어떻게 생성해야 하는지에 대한 고민이 필요하다.
<br><br>일반적으로 무분별한 예외 생성은 좋은 생각이 아니다. 
<br>반대로, 필요한 상황에서 예외를 생성하지 않으면 디버깅과 오류 추적이 어려워질 수 있다.


주요 고려사항
---
### 1. 무분별한 Exception 생성 지양

- 에러를 `throw`하지 않아도 되는 코드에서는 `exception`을 생성을 한번 더 고민하자.
- `exception` 생성 비용은 상황에 따라 다르지만, 일반적으로 비용이 높다.

### 2. Exception 생성 비용의 이해

- 예외 발생 시, 해당 `exception`을 처리할 수 있는 메소드까지 예외 호출 스택을 탐색하는 과정에서 비용이 발생하는데,
- `Exception`은 `Throwable`의 구현체
  - `fillInStackTrace()` 메서드를 통해 호출 스택 정보를 수집하는 과정에서 추가적인 비용이 발생
  - 호출 스택을 순회하며 클래스명, 메서드명, 코드 줄 번호 등의 정보를 모아 `stacktrace`로 만드는 과정 또한 비용 증가의 원인
  <br> -> **실제로 얼마나 많은 비용이 발생하는지는 스택 트레이스의 깊이나 크기에 따라 달라질 수 있으므로 주의가 필요**

### 3. 예외를 만들어야하는 상황인지 고민하기

조금은 극단적인 예시로 아래 메모리를 체크하는 코드에서 현재 메모리 상태를 체크하는 단계가
1. `유의 상황`(`log.warn()`)인 경우 - gc로 메모리가 충분히 비워질수있는 여유 충분
2. `심각한 상황`(`log.error()`)인 경우 - 부하로 아직 메모리가 충분히 비워지지 않아 서버가 다운될 수 있는 상황
이 있을때 `warn`으로 경고만해도 되는 상황에서 굳이 `exception`을 만들어야할까?

``` java
// 부적절한 예
public void checkMemoryUsage() {
    long usedMemory = totalMemory - freeMemory;
    if (usedMemory > MEMORY_THRESHOLD) {
        Exception memoryException = new Exception("메모리 유의가 필요한 상황!");
        throw memoryException;
    }
}

// 개선된 방식
public void checkMemoryUsage() {
    long usedMemory = totalMemory - freeMemory;
    if (usedMemory > MEMORY_THRESHOLD) {
        log.warn("메모리 유의가 필요한 상황입니다. 사용 메모리: {}", usedMemory);
        // webhook alarm 등을 통해 경고는 줄 수 있음
    }
}
```

개선
---

그럼 exception 생성이 필요한 경우인데, 비용이 높을 것으로 예상된다면 어떻게 개선할 수 있을까?

### 1. fillInStackTrace 오버라이드

- fillinStacktrace를 오버라이드해서 stacktrace를 만드는 비용을 없앤다

```java
public class OptimizedException extends Exception {
  @Override
  public Throwable fillInStackTrace() {
    return this; // 스택 트레이스 생성 비용 회피
  }
}
```

### 2. 자주 발생하는 exception의 경우 캐싱
``` java
public class ExceptionCache {
    public static final CommonException COMMON_EXCEPTION = new CommonException("자주 발생하는 일반적인 예외 상황");
}
```

### 주의사항
1. 스택 트레이스가 필요 없는 예외(에서만 OptimizedException 또는 캐싱된 예외를 사용해야 합니다
   - 애플리케이션의 정상적인 흐름의 일부로 발생하는 예외 - validation 단계의 예외같은
   - 반복적으로 발생하는 예외: 같은 상황에서 자주 발생하는 예외  
2. 실제 문제 추적이 필요한 상황에서는 일반 Exception을 사용하는 것이 좋다.
   - 성능을 생각해서 최적화 한 예외가 오히려 코드 리뷰나 디버깅 과정에서 혼란을 줄 수 있다.

## 사실 진짜 중요한건

- 예외를 만들어도 뭐가 문제인지를 정확히 적는게 더 중요(`logging`도 마찬가지임)
- 그냥 `throw new Exception(e.getMessage())`로 끝나는 코드는 트래킹을 더 힘들게 만들뿐이다.
- 결국 문제가 발생하면 트래킹하는건 나니까.. 명확하게 적어두는게 중요하다.
- 더해서 굳이 `customException`을 만들기전에 기본적으로 제공하는 `하위 runtimeException`을 사용해서도 명확하게 표현하는데 무리가 없는지 고민하자

```java
// 문제 코드

try {
    categoryService.update(id, requestDto));
} catch (Exception e) {
	  throw new RuntimeException(e.getMessage());
}

// 고친 코드

try {
    log.info("[@{}] id={}인 카테고리 수정 요청: {}", name, id, requestDto);
    categoryService.update(id, requestDto));
} catch (Exception e) {
    log.error("[@{}] id={}인 카테고리 수정 중 오류 발생", name, id, e);
    // 잘못된 인자의 전달이었다면 IllegalArgumentException이 더 좋을지 모른다
    throw new IllegalArgumentException("[@{}] id={}인 카테고리 수정 중 오류 발생", name, id, e));
}
```

## reference
- [java-exceptions-perforrmance](https://www.baeldung.com/java-exceptions-performance)
- [예외는 정말 예외적인 상황에서만 사용하라는 내용](https://shipilev.net/blog/2014/exceptional-performance/)
- [oracle-fillInStackTrace()](https://docs.oracle.com/javase/8/docs/api/java/lang/Throwable.html#fillInStackTrace--)

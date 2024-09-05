---
title: 왜 Pageable을 파라미터로 하면 PageNo가 매우 큰수를 요청 받을시 오류가 발생하지않고 0으로 전환하는가?
description: Spring Boot Pageable에서 int 범위 초과 page 값 입력 시 0으로 변환되는 현상의 원인과 내부 동작 원리를 분석합니다.
date: 2024-09-23 20:19:42 +0900
categories: [Issue]
tags: [Issue, Pageable, Spring, Java]
author: w-seok
lang: ko-KR
---

## 상황 발생 환경

- `spring boot 3.2.9`, `jdk` 17

## 발생 상황

> 대용량 데이터의 페이지네이션 조회를 구현하면서 흥미로운 현상을 발견했습니다.(이미 아신다면 pass) 
<br><br>**`Pageable` 파라미터를 사용시**, `page의` 값을 `int` 범위를 초과하는 매우 큰 수(예: `100억`)로 입력했음에도 불구하고
<br>예상과 달리(직접 구현 방식과 달리) **오류가 발생하지 않고 첫 페이지(pageNo = 0)를 조회해 리턴하는 것이었습니다**.
<br><br>이전에 직접 구현하여 @RequestParam으로 처리했을 때와는 다른 결과였는데
<br>본 글에서는 원인과 어떻게 동작하고있는지 살펴보겠습니다.

## Pageable을 활용한 Pagination이란

일반적으로 많은 웹 게시판에서는 모든 글을 한 번에 보여주지 않고 페이지를 나눠 쪽수별로 제공합니다.

정렬 방식 또한 설정하여, 보고 싶은 정보의 우선순위를 설정할 수도 있는데, **정렬 방식과 페이지의 크기, 그리고 몇 번째 페이지인지의 요청에 따라 정보를 전달해주는 것이 Pagination 입니다.**

개발자가 이를 직접 구현할 수도 있지만, `Spring Data`에서는 이를 편리하게 사용할 수 있도록 `Pageable` 이라는 인터페이스를 제공합니다.

## 상황 재연

### Pageable을 사용한 조회

아래 이미지 처럼 조회시 `Pageable`을 파라미터로 받아 조회하는 메소드를 간단하게 재현했습니다 .

![issue - 1 - image](/assets/img/post/why-pageable-return-zero/issue-1.webp)

이 경우 쿼리스트링 `page`를 100억으로 설정하여 조회를 요청했을 때, **예상과 달리 0번째 페이지를 조회하는 것을 확인할 수 있습니다.**

![issue - 2 - image](/assets/img/post/why-pageable-return-zero/issue-2.webp)

첫 페이지를 가지고오는 모습

![issue - 3 - image](/assets/img/post/why-pageable-return-zero/issue-3.webp)


### @requestParam으로 직접 구현을 통한 조회

위 내용에서 사실 저는 신기하다 생각이 들었는데.. 여태 pageable을 사용하지않고 직접 requestParam을 사용해 구현했을때는
`400 bad request`응답을 하며 오류가 발생했던것으로 기억했습니다.

그래서 아래에서 한번 더 재현을 해보았는데 역시나 아래 이미지처럼 예상대로 `HandlerExceptionResolver`에서 **해당 값을 int로 변환하는 데 실패했다는 오류가 발생했습니다.**

![issue - 4 - image](/assets/img/post/why-pageable-return-zero/issue-4.webp)

![issue - 5 - image](/assets/img/post/why-pageable-return-zero/issue-5.webp)

![issue - 6 - image](/assets/img/post/why-pageable-return-zero/issue-6.webp)

## 왜 오류가 발생하지 않는가?

이 현상의 원인을 찾기 위해 디버깅을 해보았는데,

`Spring`에서는 `Pageable` 객체를 직접 파라미터로 받을 때 `PageableHandlerMethodArgumentResolverSupport` 클래스가 동작한다는 것을 알게 되었습니다.

![issue - 7 - image](/assets/img/post/why-pageable-return-zero/issue-7.webp)


이 클래스는 요청 파라미터를 `getPageable` 메서드를 통해 `Pageable` 객체로 변환하는 역할을 합니다. 
<br>이 과정에서 `parseAndApplyBoundaries` 메서드가 호출되는데, 이 메서드에서 글의 원인이 발생합니다.

`parseAndApplyBoundaries` 메서드는 페이지 번호가 너무 큰 경우(21억을 넘기는), <br>발생하는 `NumberFormatException`을 catch 하고있는데,
이 덕분에 실제 데이터 접근 시 첫 페이지(0)를 반환하도록 설계되어 있습니다.<br>
그 결과 **int 범위를 초과하는 값을 입력해도 오류가 발생하지 않고 첫 페이지가 리턴되는 것입니다..**

![issue - 8 - image](/assets/img/post/why-pageable-return-zero/issue-8.webp)

## 마치며

`Pageable`을 사용할 때 이러한 동작 방식을 이해하고 있다면, 같은 상황 발생시 명확히 처리하는 것도 더 쉬워질거 같습니다.
이 글이 `Pageable` 사용 시 기존 구현하던 방식과 의도가 다르게 작동하는 특이 케이스에 대한 이해를 돕고, 더 나은 페이지네이션 구현에 도움이 되길 바랍니다.

## reference

[PageableHandlerMethodArgumentResolverSupport](https://docs.spring.io/spring-data/commons/docs/current/api/org/springframework/data/web/PageableHandlerMethodArgumentResolverSupport.html)
<br>[pagination](https://tecoble.techcourse.co.kr/post/2021-08-15-pageable/)

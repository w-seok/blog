---
title: Why Does Pageable Return 0 Instead of Error When Page Number Exceeds Int Range?
description: Analysis of why Spring Boot Pageable converts page values exceeding int range to 0 and its internal behavior.
date: 2024-09-23 20:19:42 +0900
categories: [Issue]
tags: [Issue, Pageable, Spring, Java]
author: w-seok
lang: en
faq:
  - question: "Why doesn't an error occur when inputting page values exceeding int range in Pageable?"
    answer: "Spring's PageableHandlerMethodArgumentResolverSupport class catches NumberFormatException and returns a default value of 0."
  - question: "Why does an error occur when implementing directly with @RequestParam?"
    answer: "@RequestParam attempts int conversion without separate exception handling, so a 400 Bad Request error occurs in HandlerExceptionResolver when exceeding int range."
  - question: "Can this behavior be customized?"
    answer: "You can customize PageableHandlerMethodArgumentResolver or use @Valid with a custom validator to limit page value ranges."
---

## Environment

- `spring boot 3.2.9`, `jdk` 17

## Problem Description

> While implementing pagination for large datasets, I discovered an interesting behavior (skip if you already know this).
<br><br>**When using `Pageable` as a parameter**, even when inputting a very large number exceeding the `int` range (e.g., `10 billion`) for the `page` value,
<br>contrary to expectations (and different from custom implementation), **no error occurred and it returned the first page (pageNo = 0)**.
<br><br>This was different from when I implemented it directly using @RequestParam.
<br>In this article, I'll examine the cause and how it works internally.

## What is Pagination with Pageable?

In general, most web bulletin boards don't show all posts at once but provide them page by page.

You can also set sorting options to prioritize the information you want to see. **Pagination is about delivering information based on the sorting method, page size, and which page number is requested.**

Developers can implement this directly, but `Spring Data` provides an interface called `Pageable` for convenient use.

## Reproducing the Situation

### Querying with Pageable

As shown in the image below, I simply reproduced a method that receives `Pageable` as a parameter for querying.

![issue - 1 - image](/assets/img/post/why-pageable-return-zero/issue-1.webp)

In this case, when requesting a query with the query string `page` set to 10 billion, **contrary to expectations, it queries the 0th page.**

![issue - 2 - image](/assets/img/post/why-pageable-return-zero/issue-2.webp)

Fetching the first page

![issue - 3 - image](/assets/img/post/why-pageable-return-zero/issue-3.webp)


### Custom Implementation with @RequestParam

I found this quite interesting... because when I implemented it directly using RequestParam without Pageable,
I remembered it returning a `400 bad request` error.

So I reproduced it again below, and as expected, the image shows that `HandlerExceptionResolver` **threw an error saying it failed to convert the value to int.**

![issue - 4 - image](/assets/img/post/why-pageable-return-zero/issue-4.webp)

![issue - 5 - image](/assets/img/post/why-pageable-return-zero/issue-5.webp)

![issue - 6 - image](/assets/img/post/why-pageable-return-zero/issue-6.webp)

## Why Doesn't an Error Occur?

To find the cause of this behavior, I debugged the code.

I discovered that in `Spring`, when receiving a `Pageable` object directly as a parameter, the `PageableHandlerMethodArgumentResolverSupport` class handles it.

![issue - 7 - image](/assets/img/post/why-pageable-return-zero/issue-7.webp)


This class is responsible for converting request parameters to a `Pageable` object through the `getPageable` method.
<br>During this process, the `parseAndApplyBoundaries` method is called, which is where the cause of this behavior lies.

The `parseAndApplyBoundaries` method catches the `NumberFormatException` that occurs when the page number is too large (exceeding 2.1 billion),
<br>and because of this, it's designed to return the first page (0) when accessing actual data.<br>
As a result, **even when inputting a value exceeding the int range, no error occurs and the first page is returned.**

![issue - 8 - image](/assets/img/post/why-pageable-return-zero/issue-8.webp)

## Conclusion

Understanding this behavior when using `Pageable` will make it easier to handle similar situations clearly.
I hope this article helps understand the edge cases where `Pageable` behaves differently from custom implementations and contributes to better pagination implementation.

## Reference

[PageableHandlerMethodArgumentResolverSupport](https://docs.spring.io/spring-data/commons/docs/current/api/org/springframework/data/web/PageableHandlerMethodArgumentResolverSupport.html)
<br>[pagination](https://tecoble.techcourse.co.kr/post/2021-08-15-pageable/)

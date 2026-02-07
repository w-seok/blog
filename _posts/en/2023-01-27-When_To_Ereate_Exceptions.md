---
title: Considerations on Exception Creation
description: Reflections on when and how to create Exceptions in Java. Discusses fillInStackTrace costs and exception handling strategies.
date: 2023-01-27 22:13:20 +0900
categories: [Programming, Java]
tags: [Exception, Error Management]
author: w-seok
lang: en
faq:
  - question: "Why is Exception creation costly in Java?"
    answer: "When an Exception is created, the fillInStackTrace() method is called, which collects information about the call stack including class names, method names, and line numbers, making it an expensive operation."
  - question: "When should you avoid creating Exceptions?"
    answer: "When you don't need to throw an error, for example when warning logs are sufficient at memory threshold levels, it's more appropriate to use log.warn() instead of creating Exceptions."
  - question: "How can you reduce the cost of fillInStackTrace?"
    answer: "You can override fillInStackTrace() with an empty implementation to eliminate stack trace collection cost. However, since debugging information is lost, this should only be used in specific performance-critical situations."

---
Introduction
---
> During development, careful consideration is needed about when and how to create exceptions (`Exception`).
<br><br>Generally, indiscriminate exception creation is not a good idea.
<br>Conversely, not creating exceptions when needed can make debugging and error tracking difficult.


Key Considerations
---
### 1. Avoid Indiscriminate Exception Creation

- In code where you don't need to `throw` an error, think twice about creating an `exception`.
- The cost of `exception` creation varies depending on the situation, but is generally high.

### 2. Understanding Exception Creation Costs

- When an exception occurs, costs arise from traversing the exception call stack to find a method that can handle the `exception`.
- `Exception` is an implementation of `Throwable`
  - Additional costs occur when collecting call stack information through the `fillInStackTrace()` method
  - The process of traversing the call stack to gather class names, method names, line numbers, etc. to create a `stacktrace` also contributes to increased costs
  <br> -> **Note that the actual cost depends on the depth and size of the stack trace**

### 3. Consider Whether an Exception is Really Needed

As a somewhat extreme example, in the code below that checks memory, the current memory status check has stages:
1. `Warning situation` (`log.warn()`) - GC can free up enough memory
2. `Severe situation` (`log.error()`) - Memory hasn't been freed enough due to load, server might crash

In a situation where only a `warn` is sufficient, do you really need to create an `exception`?

``` java
// Inappropriate example
public void checkMemoryUsage() {
    long usedMemory = totalMemory - freeMemory;
    if (usedMemory > MEMORY_THRESHOLD) {
        Exception memoryException = new Exception("Memory attention required!");
        throw memoryException;
    }
}

// Improved approach
public void checkMemoryUsage() {
    long usedMemory = totalMemory - freeMemory;
    if (usedMemory > MEMORY_THRESHOLD) {
        log.warn("Memory attention required. Used memory: {}", usedMemory);
        // Can send alerts via webhook, etc.
    }
}
```

Improvements
---

So, if exception creation is needed but the cost is expected to be high, how can we improve it?

### 1. Override fillInStackTrace

- Override fillInStackTrace to eliminate the cost of creating a stacktrace

```java
public class OptimizedException extends Exception {
  @Override
  public Throwable fillInStackTrace() {
    return this; // Avoid stack trace generation cost
  }
}
```

### 2. Cache Frequently Occurring Exceptions
``` java
public class ExceptionCache {
    public static final CommonException COMMON_EXCEPTION = new CommonException("Common exception situation that occurs frequently");
}
```

### Caveats
1. OptimizedException or cached exceptions should only be used for exceptions where stack traces are not needed
   - Exceptions that occur as part of the application's normal flow - like validation stage exceptions
   - Repeatedly occurring exceptions: Exceptions that frequently occur in the same situation
2. For situations where actual problem tracking is needed, it's better to use regular Exceptions.
   - Performance-optimized exceptions might cause confusion during code review or debugging.

## What's Really Important

- It's more important to clearly describe what the problem is when creating exceptions (same goes for `logging`)
- Code that just ends with `throw new Exception(e.getMessage())` only makes tracking harder.
- Since you're the one who'll be tracking the problem when it occurs... it's important to write clearly.
- Additionally, before creating a `customException`, consider whether you can clearly express it using the standard `RuntimeException` subclasses provided.

```java
// Problematic code

try {
    categoryService.update(id, requestDto));
} catch (Exception e) {
	  throw new RuntimeException(e.getMessage());
}

// Improved code

try {
    log.info("[@{}] Category update request for id={}: {}", name, id, requestDto);
    categoryService.update(id, requestDto));
} catch (Exception e) {
    log.error("[@{}] Error occurred while updating category with id={}", name, id, e);
    // If it was a bad argument, IllegalArgumentException might be better
    throw new IllegalArgumentException("[@{}] Error occurred while updating category with id={}", name, id, e));
}
```

## Reference
- [java-exceptions-performance](https://www.baeldung.com/java-exceptions-performance)
- [Use exceptions only for exceptional situations](https://shipilev.net/blog/2014/exceptional-performance/)
- [oracle-fillInStackTrace()](https://docs.oracle.com/javase/8/docs/api/java/lang/Throwable.html#fillInStackTrace--)

---
title: Chrome Not Returning 304 Status in Not-Modified Situations
description: Analyzing the cause and solution for Chrome browser not returning 304 Not Modified when using Cache-Control and ETag caching.
date: 2023-02-13 23:07:00 +0900
categories: [Issue]
tags: [Issue, Chrome, Not Modified, HTTP Status Code]
author: w-seok
lang: en
---
Problem Situation
---
> While developing a side project that provides users with specific image lists, caching was needed due to the nature of the feature where the served image list is large, changes (`Insert`, `Update`, `Delete`) are rare, and read operations are frequent.
<br><br>Therefore, after setting up local cache, I implemented logic to return `HttpStatus Not-Modified` through `Etag` validation when cached data expires, using `Cache-Control` and `Etag` values.
<br><br>This article documents the situation where Chrome browser returns `200` instead of `304` even though the `Etag` values are the same during revalidation due to cache expiration.

Environment and Stack
---
- Chrome browser version - 96 version (December 2021)
- `spring boot 2.7.1`, `jdk` 11
- `curl` - Directly request from terminal instead of browser environment to verify the situation
- `wireshark` - Capture packets exchanged with server to check response values and request headers

Root Cause
---
[1269602 - chromium - An open-source project to help move the web forward. - Monorail](https://bugs.chromium.org/p/chromium/issues/detail?id=1269602)

This issue was a Chrome browser bug that existed up to version 96, confirmed in the Chromium bug issue tracker.

The laptop I was using was purchased around March 2022 with Chrome installed (and left unattended), and the Chrome auto-update option was disabled. Since it was version 96, which was the latest version at the time, this problem occurred.

There are comments saying it occurred up to version 105.. Looking at other posts, it seems the problem still exists..

![issue - image](/assets/img/post/chrome-not-returning/issue-image.webp)

After Update, What About Current Chrome?

After the above problem occurred and Chrome was updated, I confirmed it works normally in the latest version.

![304-return](/assets/img/post/chrome-not-returning/304-return.webp)


Reproducing the Situation
---
### Server API Code

```java
/**
	* When requesting this API, an image list is returned.
	* For test reproduction, example value is set for etag and no-cache is set in response header.
	* In actual implementation, resource hash or version is used with max-age=60, must-revalidate
	* After the first request, the returned etag value is put in if-none-match and compared, returning 304 if same
	*
	* @param pageNo
	* @param pageSize
	* @param blockSize
	* @return
*/
@GetMapping("/backoffice/templates/api")
public ResponseEntity<List<ImageTemplateDto>> getImageTemplatesRest(
        @RequestHeader(value = "If-None-Match", required = false) String requestETag,
        @RequestParam(required = false, defaultValue = "1") int pageNo,
        @RequestParam(required = false, defaultValue = "7") int pageSize,
        @RequestParam(required = false, defaultValue = "3") int blockSize) {
    try {
        List<ImageTemplateDto> imageTemplateDtoList = imageTemplateService.getList(pageNo, pageSize, blockSize);

        String etag = "example-etag";

        return ResponseEntity
                .ok()
                .eTag(etag)
                .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                .body(imageTemplateDtoList.stream()
                        .limit(pageSize)
                        .collect(Collectors.toList()));
    } catch (InterruptedException interruptedException) {
        return null;
    }
}
```

- Current `Cache-Control` setting is `no-cache`, so validation is always done on the server.
- Since the `etag` value is hardcoded, `304 status` must be returned from the second request onwards.
- Also, since it's `not-modified`, the server doesn't send `body` value to the client (browser), so the returned body size will be different (smaller) from the first request.

### In Chrome (96 version)

![96-version-problem](/assets/img/post/chrome-not-returning/96version-200-problem.webp)

- Looking at the returned size, it clearly means the browser used cached resources without receiving them from the server.

![resource-caching](/assets/img/post/chrome-not-returning/resource-caching.webp)

- Clearly, if-none-match is present in the request header.

### Safari

- As expected, from the second request onwards, it returns 304 correctly without receiving original resources from the server.

![safari](/assets/img/post/chrome-not-returning/safari-304-return.webp)

### Edge

- Edge also returns 304 correctly from the second request onwards without receiving original resources from the server.

![edge](/assets/img/post/chrome-not-returning/edge-304-return.webp)

---

---

## Can We Trust Browsers?

### Cause

> The server clearly thinks it gave 304 and the browser shows us the response. But why can it be different?

Summarizing the process from when we click a link in the browser to when the site becomes visible:

1. **URL Request and DNS Lookup**: When a user enters a URL or clicks a link, the browser checks the local cache and, if necessary, translates the domain to an IP address through DNS lookup.
2. **Server Connection and Security Setup**: The browser establishes a TCP connection with the server and, for HTTPS, performs SSL/TLS handshake.
3. **HTTP Request and Response**: After connection, it sends an HTTP request to the server, and the server processes and returns an HTTP response.
4. **Resource Processing**: Then the browser parses and processes received HTML, CSS, JavaScript, and other resources.
5. **Rendering**: The browser creates a render tree based on processed resources, calculates layout, and paints to the screen.

**In other words, while each browser generally tries to follow web standards (W3C, IETF, etc.), they have their own interpretations and implementation methods, so rendering methods can differ between browsers in specific versions and technologies.**

- Chrome might be correct (though that's unlikely), or perhaps `spring application` is returning `200` instead of `304`, and other browsers (`Edge, Safari`) are just displaying it as 304.

## Verifying with curl

> Therefore, we need to verify the problem by directly sending requests to the server through curl and checking the response to determine whether Chrome, Spring, or other browsers are at fault.

curl is an independent tool separate from browsers, so it can communicate with the server and receive responses regardless of browser behavior.

### Result

- As shown in the image below, adding `If-None-Match` to the header returns 304.
- This means the resource received from the server before browser rendering is correctly 304, and Spring is not the problem.

![curl-no-header](/assets/img/post/chrome-not-returning/curl-200.webp)

![curl-header](/assets/img/post/chrome-not-returning/curl-304.webp)

### Can We Trust curl?

[curl - github](https://github.com/curl/curl)

- Since 1997, it has been used by many people and has an active community. As an open source project, the code is reviewed by many eyes, so reliability is high.
- The recent release (8.4) was in early October 2023, meaning developers are continuously participating in the project.
- Of course, there are still vulnerabilities, and if asked whether it can be completely trusted, I would say no. Due to its long history, there are also many HTTP response-related bug cases.

#### curl HTTP Response Related Bug Cases

[curl - HTTP Proxy deny use after free - CVE-2022-43552](https://curl.se/docs/CVE-2022-43552.html)

[curl - HTTP headers eat all memory - CVE-2023-38039](https://curl.se/docs/CVE-2023-38039.html)

[curl - HTTP multi-header compression denial of service - CVE-2023-23916](https://curl.se/docs/CVE-2023-23916.html)

---

## What is the Most Reliable Method?

[Wireshark](https://gitlab.com/wireshark/wireshark)

> For checking requests and responses with the server in this problem situation, I chose Wireshark because:
<br><br>1. As an open source project, it can be easily verified.
<br>2. Since network packet analysis is possible, all packets transmitted over the network can be captured and analyzed.

Verification process after installing Wireshark for the above reasons:

- First, since the reproduction environment is local, only check loopback packets.

![wire-1](/assets/img/post/chrome-not-returning/wire-1.webp)

- Then apply HTTP filter to check API requests and responses. Confirm that requests and responses are recorded.
- Also verify that the response was exactly 304.

![wire-2](/assets/img/post/chrome-not-returning/wire-2.webp)

![wire-3](/assets/img/post/chrome-not-returning/wire-3.webp)

---
title: Not-Modifed 상황에서 크롬이 304 status를 반환하지 않는 문제
description: Chrome 브라우저에서 Cache-Control과 ETag를 사용한 캐싱 시 304 Not Modified가 반환되지 않는 문제의 원인과 해결 방법을 분석합니다.
date: 2023-02-13 23:07:00 +0900
categories: [Issue]
tags: [Issue, Chrome, Not Modified, HTTP Status Code]
author: w-seok
lang: ko-KR
---
문제 상황
---
> 사용자에게 특정 이미지 목록들을 제공하는 사이드 프로젝트 개발 중 서빙하는 이미지 목록의 사이즈가 크고 변경이(`Insert` , `Update` , `Delete`) 드물고 읽기 작업이 많은 기능 특성상 캐싱 필요
<br><br>따라서 로컬 캐시를 설정 후 `Cache-Control`, `Etag` 값을 통해 캐싱 데이터가 만료되는 상황에 `Etag`를 통한 검증으로 `HttpStatus Not-Modified`를 반환 받는 로직을  구현
<br><br>해당 글은 크롬 브라우저에서 캐시 만료로 인한 재검증상황에서 `Etag`값이 같음에도 불구하고 `304` 아닌 `200` 반환하는 상황에 대한 정리

상황 발생 환경 및 스택
---
- 크롬 브라우저 버전 - 96 version (21년 12월)
- `spring boot 2.7.1`, `jdk` 11
- `curl` - 브라우저 환경이 아닌 터미널에서 curl로 직접 요청해 상황을 확인
- `wireshark` - 서버와 주고받는 패킷을 캡쳐해 응답값 및 요청 헤더를 확인

문제 원인
---
[1269602 - chromium - An open-source project to help move the web forward. - Monorail](https://bugs.chromium.org/p/chromium/issues/detail?id=1269602)

해당 문제는 96버전까지도 존재했던 chrom 브라우저 bug로 chromium bug issue에서 확인

사용했던 노트북은 22년 3월경 구매 후 크롬이 설치되어있던(방치되었던) 노트북이었는데 크롬 자동 업데이트 옵션이 비활성화 되어있었고 당시 latest version이었던 96버전이었기에 해당 문제가 발생

105버전까지 발생했다는 코멘트가 있던데.. 다른 글들을 보면 현재도 문제가 있는듯한데..

![issue - image](/assets/img/post/chrome-not-returning/issue-image.webp)

업데이트 후 현재 크롬에서는?

위와 같은 문제가 생기고 크롬업데이트 후 최신버전에서는 정상 동작함을 확인

![304-return](/assets/img/post/chrome-not-returning/304-return.webp)


상황 재연
---
### 서버 API 코드

```java
/**
	* 해당 api로 요청시 이미지 목록을 반환받습니다.
	* 테스트 재연을 위해 etag에 예시 값 및 응답 헤더에 no-cache로 설정하였습니다. 
	* 실제 구현에서는 리소스의 해시값 또는 버전을 사용 및 max-age=60, must-revalidate
	* 첫 요청 이후, 반환 받은 etag값을 if-none-match에 넣어 해당 값을 비교 후 같다면 304 반환
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

- 현재 `Cache-Control` 설정은 `no-cache`이므로 무조건 서버에서 검증을 한다.
- `etag`의 값은 하드코딩 되어있기에 두번째 요청부터는 반드시 `304 status`를 반환해야한다.
- 또한, `not-modified`이기에 서버에서는 클라이언트(브라우저)에게 `body`값을 보내지않아 반환받은 body 사이즈가 첫 요청과 차이가 있을것이다(작을것이다)

### 크롬에서(96 version)

![96-version-problem](/assets/img/post/chrome-not-returning/96version-200-problem.webp)

- 반환받은 size를 확인해보면 분명히 리소스를 서버로부터 받지않고 브라우저가 캐싱된 리소스를 사용한걸 의미한다

![resource-caching](/assets/img/post/chrome-not-returning/resource-caching.webp)

- 분명 요청헤더에는 if-none-match가 있는모습

### safari

- 역시 두번째 요청부터 서버 원본 리소스를 받지않고 304를 잘 리턴하는 모습

![safari](/assets/img/post/chrome-not-returning/safari-304-return.webp)

### Edge

- edge 또한 역시 두번째 요청부터 서버 원본 리소스를 받지않고 304를 잘 리턴하는 모습

![edge](/assets/img/post/chrome-not-returning/edge-304-return.webp)

---

---

## 브라우저는 믿을만한가

### 원인

> 분명 서버는 304를 줬다고 생각하고 응답을 받은 브라우저는 우리에게 응답값을 보여준다. 그런데 왜 다를 수 있을까

브라우저에서 우리가 링크를 클릭하면 사이트가 눈에 보이는 과정을 요약하면

1. **URL 요청 및 DNS 조회**: 사용자가 URL을 입력하거나 링크를 클릭하면, 브라우저는 로컬 캐시를 확인하고, 필요시 DNS 조회를 통해 도메인을 IP 주소로 변환
2. **서버 연결 및 보안 설정**: 브라우저는 서버와 TCP 연결을 설정하고, HTTPS의 경우 SSL/TLS 핸드셰이크를 수행
3. **HTTP 요청 및 응답**: 연결 후 http 요청을 서버로부터 보내고, 서버는 이를 처리해서 http 응답을 반환한다.
4. **리소스 처리**: 그 후 브라우저는 받은 HTML, CSS, JavaScript 등의 리소스를 파싱하고 처리한다.
5. **렌더링**: 브라우저는 처리된 리소스를 바탕으로 렌더 트리를 생성하고, 레이아웃을 계산한 후 화면에 페인팅한다.

**즉, 각 브라우저들이 일반적으로 웹 표준(W3C, IETF 등)을 따르고자 하지만 자체적인 해석과 구현 방식을 가지기에 특정 버전, 기술에서 브라우저마다 렌더링 방식이 다를 수 있다**

- 크롬이 맞을 수도(그럴일이 없겠지만) 혹은 애초에 `spring applicaiton`에서 `304`를 리턴하지않고 `200`을 리턴하고있는데 다른 브라우저(`edge, safari`)가 그저 304로 바꿔서 표시하는 문제일 수 도 있다.

## curl로 요청해 검증한다

> 그렇기에 우리는 chrome이 이상한건지 spring이 이상한건지 다른 브라우저들이 이상한건지 curl을 통해 직접 서버에 요청을 보내고 응답을 확인하여 문제를 검증해야한다

curl은 브라우저와는 별개의 독립적인 도구이므로, 브라우저의 동작과는 무관하게 서버와 통신하여 응답을 받을 수 있다

### 결과

- 아래 이미지 처럼 헤더에 `If-None-Match` 를 추가하니 304를 리턴하는 것을 확인할 수 있다.
- 즉 브라우저 랜더링 과정전 서버에서 응답받은 리소스는 304가 맞고 spring은 문제가 아니라는 뜻

![curl-no-header](/assets/img/post/chrome-not-returning/curl-200.webp)

![curl-header](/assets/img/post/chrome-not-returning/curl-304.webp)

### curl은 믿을 만한가?

[curl - github](https://github.com/curl/curl)

- 1997년부터 정말 많은 이들이 사용하고 커뮤니티도 활발하기에 오픈소스 프로젝트의 특성상 많은 사람들의 눈으로 코드가 검토되기 때문에 신뢰도가 높다
- 최근 릴리즈가(8.4) 2023년 10월 초인 것 부터 개발자들이 프로젝트에 꾸준히 참여하고 있다는 뜻이다
- 물론, 여전히 취약점이 있고 완벽히 신뢰가능한가 묻는다면 아니라고 생각한다. 긴 역사만큼 http 응답관련 버그 사례도 많이 존재하기때문

#### curl의 http 응답관련 버그 사례

[curl - HTTP Proxy deny use after free - CVE-2022-43552](https://curl.se/docs/CVE-2022-43552.html)

[curl - HTTP headers eat all memory - CVE-2023-38039](https://curl.se/docs/CVE-2023-38039.html)

[curl - HTTP multi-header compression denial of service - CVE-2023-23916](https://curl.se/docs/CVE-2023-23916.html)

---

## 가장 믿을만한 방식은 무엇일까?

[wireShark](https://gitlab.com/wireshark/wireshark)

> 해당 문제상황에서 서버와의 요청,응답을 체크하기위해 wireshark를 선택했는데,
<br><br>1. 오픈소스 프로젝트기에 쉽게 검증이 가능하다
<br>2. 네트워크 패킷 분석이 가능하기에 네트워크에서 전송되는 모든 패킷을 캡처하고 분석할 수 있다.

위와 같은 이유로 wireshark를 설치 후 검증 과정

- 우선 상황 재현한 환경은 local이기에 loopback 패킷들만 체크

![wire-1](/assets/img/post/chrome-not-returning/wire-1.webp)

- 이후 api 요청,응답을 확인하고시기에 http filter를 적용 합니다. 요청과 응답이 기록되어있음을 확인
- 또한, 304로 정확히 응답이왔음을 검증

![wire-2](/assets/img/post/chrome-not-returning/wire-2.webp)

![wire-3](/assets/img/post/chrome-not-returning/wire-3.webp)

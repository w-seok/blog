---
title: Flyway for Tibero 구현 및 오픈소스 기여 과정
description: Tibero 데이터베이스를 위한 Flyway 마이그레이션 도구를 직접 구현하고 오픈소스로 기여한 경험을 공유합니다.
date: 2024-09-07 23:59:01 +0900
categories: [Programming, Database]
tags: [Flyway, Open Source, Tibero]
author: w-seok
lang: ko-KR
faq:
  - question: "Flyway가 Tibero를 공식 지원하지 않는 상황에서 어떻게 해결했나요?"
    answer: "Tibero와 Oracle의 문법적 유사성을 활용하여 Flyway의 Oracle 지원 코드를 기반으로 Tibero용 모듈을 직접 구현했습니다. baseline, migrate, clean, info, validate, repair 6가지 명령어를 구현했습니다."
  - question: "Flyway clean 구현 시 Oracle과 Tibero의 주요 차이점은 무엇인가요?"
    answer: "스키마 객체의 이름, 조회 방식, 지원하지 않는 객체 등이 Oracle과 Tibero 간에 상이하여, Tibero 공식 문서를 참고하여 각 객체별로 적절한 조회 쿼리를 별도로 작성해야 했습니다."
  - question: "이 프로젝트를 오픈소스로 기여한 과정은 어떤가요?"
    answer: "Flyway GitHub 이슈에서 같은 니즈를 가진 다른 개발자들을 확인하고, 구현 완료 후 오픈소스로 기여하였습니다. Flyway 메인테이너가 공식 지원 계획이 없었기에 커뮤니티 기여로 해결했습니다."
howto:
  name: "Flyway에서 Tibero 데이터베이스 지원을 구현하는 방법"
  description: "Flyway가 공식 지원하지 않는 Tibero 데이터베이스에 대한 마이그레이션 도구를 구현하는 방법"
  totalTime: "PT120M"
  steps:
    - name: "Flyway와 Tibero 호환성 분석"
      text: "Flyway의 Oracle 지원 코드를 분석하고, Tibero와 Oracle 간의 문법적 유사점과 차이점을 파악합니다."
    - name: "Tibero 전용 모듈 구현"
      text: "Oracle 기반 코드를 참조하여 baseline, migrate, clean, info, validate, repair 6가지 명령어를 Tibero에 맞게 구현합니다."
    - name: "스키마 객체별 차이점 처리"
      text: "Tibero 공식 문서를 참고하여 Oracle과 다른 스키마 객체 이름, 조회 방식, 미지원 객체에 대한 처리를 구현합니다."
    - name: "테스트 및 오픈소스 기여"
      text: "구현된 명령어들이 Tibero 환경에서 정상 동작하는지 테스트하고, 팀 내 적용 후 오픈소스로 기여합니다."
---

## 들어가며

본 글에서는 회사에서 사용 중인 Tibero 데이터베이스의 DDL 버전 관리를 위해 Flyway를 적용한 과정과 이후 오픈소스 기여 경험을 공유하고자 합니다.

## 기존 문제 상황

프로젝트에 참여했을 당시, 데이터베이스 관리와 관련하여 다음과 같은 문제점들이 있었는데

![issue - 1 - image](/assets/img/post/flyway-for-tibero/issue-1.webp)

1. DDL 레거시 코드의 과다
  - 서비스 요구사항 변경에 따른 잦은 스키마 수정
  - 개발 및 로컬 환경에서의 빈번한 데이터베이스 초기화
  - 수동 DDL 수정 및 실행으로 인한 휴먼 에러 위험 증가

2. 체계적이지 않은 DDL 관리
  - 방대한 양의 DDL 파일 축적
  - 팀별 요구사항에 따른 무분별한 DDL 추가/수정/삭제
  - 특정 인원에게 집중된 스키마 변경 작업

3. 개발 생산성 저하
  - 환경별(개발-검증-운영) DB 스키마 변경 작업의 어려움
  - DB 분리에 대한 부담감 증가
  - 개발 환경 설정의 복잡성

결국 이런 문제는 심각해져 아래처럼 개발 생산성 저하로 이어진다 생각했습니다.

![issue - 2 - image](/assets/img/post/flyway-for-tibero/issue-2.webp)

## 해결 방안

이러한 문제를 해결하기 위해 DB 형상관리 라이브러리중 기존에 사용해보아서 학습에 어려움이 없고 빠른 적용이 가능한
Flyway 도입을 고려하게 되었습니다. 

하지만 Flyway가 Tibero를 공식 지원하지 않는다는 새로운 문제가 있었고...


![issue - 3 - image](/assets/img/post/flyway-for-tibero/issue-3.webp)

저희 팀뿐만아니라 [GitHub에서 같은 니즈를 가진 다른 개발자들의 이슈](https://github.com/flyway/flyway/issues/2615)를 확인할 수 있었고, 
Flyway 메인테이너의 답변을 보았을때 추후 지원할 계획은 따로 없는듯하며, 이미 지원중인 Oracle과 Tibero의 문법적 유사한 점을 고려해봤을때

현재 상황에서 언제든 발생하기 쉬운 DB Migration 이슈를 방지하려면 직접 구현해야겠다 생각했습니다.

![issue - 4 - image](/assets/img/post/flyway-for-tibero/issue-4.webp)

## 프로젝트 목표 설정

이에 따라 팀원분들도 같은생각을 하셨고 다음과 같은 목표를 설정하고 프로젝트를 시작하게 되었습니다.

![issue - 5 - image](/assets/img/post/flyway-for-tibero/issue-5.webp)

## 구현 과정

Flyway의 기본 명령어 중 Pro 버전 기능인 'undo'를 제외한 나머지 6가지 명령어(baseline, migrate, clean, info, validate, repair)를 구현하는 것을 목표로 했습니다.

![issue - 6 - image](/assets/img/post/flyway-for-tibero/issue-6.webp)

구현의 내용이 많아 블로그에 다 기술하기보다는 oracle과 차이가있던 부분, 어려웠던 부분과 해결 방법을 중심으로 설명하겠습니다.

**우선, 구현 과정에서 가장 많은 시간이 소요되고 어려움을 겪은 부분은 `clean` 명령어의 구현이었습니다.**

`Flyway의` `clean` 기능은 모든 스키마 객체를 제거하는 작업을 수행하기 때문에, 각 스키마 객체의 존재 여부를 확인하고 삭제하는 과정이 필요합니다.

이 과정에서 Tibero와 Oracle 간의 차이점이 두드러졌는데`(schema object의 이름, 조회방식, 지원하지않는 object 등)` 두 데이터베이스 간에 상이했기 때문에, 

Tibero의 공식 문서를 꼼꼼히 살펴보며 각 객체별로 적절한 조회 쿼리를 작성해야 했습니다.

### 1. flyway clean시 oracle과 tibero의 차이점

예를 들어, `Oracle`에서는 `ALL_SDO_GEOM_METADATA`를 사용하여 특정 메타데이터를 조회하지만, `Tibero`에서는 이에 해당하는 `ALL_GEOMETRY_COLUMNS`를 사용해야 했습니다.

아래처럼 `oracle`의 `flyeay clean` 메서드 구현을 보면 clean 작업 전 `locatorMetadata`를 먼저 삭제하는 작업이 있는데

```java
 private boolean locatorMetadataExists() throws SQLException {
  return database.queryReturnsRows("SELECT * FROM ALL_SDO_GEOM_METADATA WHERE OWNER = ?", name);
}

private void cleanLocatorMetadata() throws SQLException {
        if (!locatorMetadataExists()) {
            return;
        }

        if (!isDefaultSchemaForUser()) {
            LOG.warn("Unable to clean Oracle Locator metadata for schema " + database.quote(name) +
                             " by user \"" + database.doGetCurrentUser() + "\": unsupported operation");
            return;
        }

        jdbcTemplate.getConnection().commit();
        jdbcTemplate.execute("DELETE FROM USER_SDO_GEOM_METADATA");
        jdbcTemplate.getConnection().commit();
    }
```

tibero의 경우 `ALL_SDO_GEOM_METADATA`에 해당하는 부분이 `ALL_GEOMETRY_COLUMNS`여서 해당 부분을 삭제하는 작업을 추가해야했습니다.

```java
private void cleanLocatorMetadata() throws SQLException {
		if (!locatorMetadataExists()) {
			return;
		}

		if (!isDefaultSchemaForUser()) {
			return;
		}

		jdbcTemplate.getConnection().commit();
		jdbcTemplate.execute("DELETE FROM USER_GEOMETRY_COLUMNS");
		jdbcTemplate.getConnection().commit();
	}

	private boolean locatorMetadataExists() throws SQLException {
		return database.queryReturnsRows("SELECT * FROM ALL_GEOMETRY_COLUMNS WHERE F_TABLE_SCHEMA = ?",
			name);
	}
```

또한, queueTable의 경우 비울때도 tibero는 고려할점이 있는데 [oracle](https://docs.oracle.com/cd/B13789_01/server.101/b10755/statviews_1125.htm), [tibero - queue table](https://technet.tmaxsoft.com/upload/download/online/tibero/pver-20150504-000001/tibero_pkg/chap_dbms_aqadm.html#DBMS_AQADM_CREATE_QUEUE)

1. queue_table의 경우 tibero에서는 all_tables에서도 같이 조회되기때문에 all_queue_tables에서도 같이 조회되면 제외하는 쿼리를 추가
2. queue_table의 경우 생성시 lob index도 생성되고 queue table drop 시 연관된 lob index는 자동으로 삭제됨
3. 따라서 index object 조회시에는 lob index를 제외하고 조회해야 오류 방지

```java
// All indexes, except for domain indexes and lob indexes, should be dropped after tables (if any left).
        INDEX("INDEX") {
          @Override
          public List<String> getObjectNames (JdbcTemplate jdbcTemplate, TiberoDatabase database,
            TiberoSchema schema) throws SQLException {
            return jdbcTemplate.queryForStringList(
              "SELECT INDEX_NAME FROM ALL_INDEXES WHERE OWNER = ?" +
                " AND INDEX_NAME NOT LIKE 'SYS_C%'" +
                " AND INDEX_TYPE NOT LIKE '%DOMAIN%'" +
                " AND INDEX_TYPE NOT LIKE '%LOB%'",
              schema.getName()
            );
          }
        }
```

이 밖에도 tibero의 공식문서를 참고하면서 문법적으로 차이점이있는 부분을 직접 테스트해보며 
<br>flyway의 기능들을 구현하고자 했습니다.

[자세한 구현은 여기를 참고해주세요](https://github.com/Tibero-Support/flyway-community-db-support)

### 2. flyway tibero test with testcontainers

결국 이렇게 구현된 코드가 의도대로 동작하는지 팀원들, 그리고 사용하는 모두가 믿고 사용하려면
테스트 코드의 작성이 필수적이라고 생각했습니다.

문제는 `tibero`의 경우 공식적인 `docker image도` 없고, `testcontainers`도 마찬가지로 `tibero`를 모듈로 지원하지않기때문에
둘다 구현이 필요한데..

이 글에서는 성공적으로 구현되어 public으로 공개된 링크만 남기고<br>
[tibero-docker - github](https://github.com/Tibero-Support/tibero-docker-doc/pkgs/container/tibero7)
<br>[testcontainers-tibero - github](https://github.com/Tibero-Support/tibero-test-container)

해당 부분은 다음글에 이어서...

## 오픈소스 기여

이렇게 구현된 flyway for tibero가 팀 내에서 사용되면서
팀이 처음에 의도한대로 문제없이 잘 사용되고 다른 팀에서도 문서화된 내용을 바탕으로 쉽게 적용할 수 있었습니다.

따라서, 이러한 라이브러리를 tibero를 사용하며 저희와 같은 니즈를 가진 개발자들에게 도움이되고자 상의하에 [오픈소스 기여](https://github.com/flyway/flyway-community-db-support/pull/58)를 하기로 했습니다.

## 마치며

오픈소스 기여는 mdn 한글화 기여 이후 두번째로 진행한 오픈소스 기여였는데,<br>
저희가 구현한 부분들이(tibero-docker, tibero flyway) 팀에게도 도움이되고 개발을하며 부족했던 tibero 지식을 채우는데도 도움이 되었다생각합니다.

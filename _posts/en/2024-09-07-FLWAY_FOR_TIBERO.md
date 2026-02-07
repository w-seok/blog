---
title: Implementing Flyway for Tibero and Open Source Contribution
description: Sharing the experience of implementing Flyway migration tool for Tibero database and contributing to open source.
date: 2024-09-07 23:59:01 +0900
categories: [Programming, Database]
tags: [Flyway, Open Source, Tibero]
author: w-seok
lang: en
faq:
  - question: "How did you solve the lack of official Flyway support for Tibero?"
    answer: "Leveraging the syntactic similarities between Tibero and Oracle, we directly implemented a Tibero module based on Flyway's Oracle support code, implementing 6 commands: baseline, migrate, clean, info, validate, and repair."
  - question: "What are the key differences between Oracle and Tibero when implementing Flyway clean?"
    answer: "Schema object names, query methods, and unsupported objects differ between Oracle and Tibero, requiring separate query construction for each object type by referencing Tibero's official documentation."
  - question: "What was the process of contributing this as open source?"
    answer: "After identifying other developers with the same needs on Flyway GitHub issues, we contributed the completed implementation as open source. Since Flyway maintainers had no plans for official support, it was resolved through community contribution."
howto:
  name: "How to Implement Tibero Database Support in Flyway"
  description: "How to implement a migration tool for the Tibero database which Flyway does not officially support"
  totalTime: "PT120M"
  steps:
    - name: "Analyze Flyway and Tibero compatibility"
      text: "Analyze Flyway's Oracle support code and identify syntactic similarities and differences between Tibero and Oracle."
    - name: "Implement Tibero-specific module"
      text: "Referencing Oracle-based code, implement 6 commands (baseline, migrate, clean, info, validate, repair) adapted for Tibero."
    - name: "Handle schema object differences"
      text: "Referencing Tibero's official documentation, implement handling for schema object names, query methods, and unsupported objects that differ from Oracle."
    - name: "Test and contribute to open source"
      text: "Test that implemented commands work correctly in Tibero environment, apply within the team, then contribute as open source."

---

## Introduction

In this article, I'd like to share the process of applying Flyway for DDL version management of the Tibero database used at our company, and the subsequent open source contribution experience.

## Existing Problems

When I joined the project, there were the following issues related to database management:

![issue - 1 - image](/assets/img/post/flyway-for-tibero/issue-1.webp)

1. Excessive DDL Legacy Code
  - Frequent schema modifications due to changing service requirements
  - Frequent database initialization in development and local environments
  - Increased risk of human error from manual DDL modification and execution

2. Unorganized DDL Management
  - Massive accumulation of DDL files
  - Uncontrolled DDL additions/modifications/deletions based on team requirements
  - Schema change work concentrated on specific individuals

3. Decreased Development Productivity
  - Difficulty in DB schema changes across environments (development-staging-production)
  - Increased burden on DB separation
  - Complexity in development environment setup

Eventually, I thought these problems would seriously lead to decreased development productivity as shown below.

![issue - 2 - image](/assets/img/post/flyway-for-tibero/issue-2.webp)

## Solution

To solve these problems, I considered introducing Flyway, a DB version control library that I had used before, which meant no learning curve and quick application.

However, there was a new problem that Flyway doesn't officially support Tibero...

![issue - 3 - image](/assets/img/post/flyway-for-tibero/issue-3.webp)

Not only our team but [other developers with the same needs on GitHub](https://github.com/flyway/flyway/issues/2615) confirmed this issue,
and looking at the Flyway maintainer's response, there seemed to be no plans for future support. Considering the syntactic similarities between Oracle and Tibero, which is already supported,

I thought I needed to implement it myself to prevent DB Migration issues that could easily occur in the current situation.

![issue - 4 - image](/assets/img/post/flyway-for-tibero/issue-4.webp)

## Project Goal Setting

Our team members agreed, and we started the project with the following goals:

![issue - 5 - image](/assets/img/post/flyway-for-tibero/issue-5.webp)

## Implementation Process

Our goal was to implement 6 of Flyway's basic commands (baseline, migrate, clean, info, validate, repair), excluding 'undo' which is a Pro version feature.

![issue - 6 - image](/assets/img/post/flyway-for-tibero/issue-6.webp)

Since there's a lot of implementation content, rather than describing everything in the blog, I'll focus on the parts that differed from Oracle and the difficulties encountered with their solutions.

**First, the most time-consuming and difficult part of the implementation was the `clean` command.**

Since Flyway's `clean` function removes all schema objects, it needs to check the existence of each schema object and delete them.

In this process, the differences between Tibero and Oracle were prominent `(schema object names, query methods, unsupported objects, etc.)` were different between the two databases,

so I had to carefully review Tibero's official documentation and write appropriate query statements for each object.

### 1. Differences between Oracle and Tibero in Flyway Clean

For example, `Oracle` uses `ALL_SDO_GEOM_METADATA` to query specific metadata, but in `Tibero`, we had to use the corresponding `ALL_GEOMETRY_COLUMNS`.

As shown below, looking at `Oracle`'s `flyway clean` method implementation, there's a task to delete `locatorMetadata` first before the clean operation:

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

For Tibero, the part corresponding to `ALL_SDO_GEOM_METADATA` is `ALL_GEOMETRY_COLUMNS`, so we needed to add the work to delete that part.

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

Also, for queueTable, there are considerations when emptying in Tibero: [oracle](https://docs.oracle.com/cd/B13789_01/server.101/b10755/statviews_1125.htm), [tibero - queue table](https://technet.tmaxsoft.com/upload/download/online/tibero/pver-20150504-000001/tibero_pkg/chap_dbms_aqadm.html#DBMS_AQADM_CREATE_QUEUE)

1. For queue_table, in Tibero it's also queried in all_tables, so we need to add a query to exclude it if it's also queried in all_queue_tables
2. For queue_table, a lob index is also created when creating, and the associated lob index is automatically deleted when dropping the queue table
3. Therefore, when querying index objects, lob indexes should be excluded to prevent errors

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

Besides these, I referred to Tibero's official documentation and tested syntactically different parts myself
<br>to implement Flyway's features.

[See detailed implementation here](https://github.com/Tibero-Support/flyway-community-db-support)

### 2. Flyway Tibero Test with Testcontainers

Ultimately, for team members and everyone using this implemented code to trust and use it,
writing test code was essential.

The problem was that `Tibero` doesn't have an official `docker image`, and `testcontainers` also doesn't support `Tibero` as a module,
so both needed implementation...

In this article, I'll just leave links to successfully implemented and publicly released resources<br>
[tibero-docker - github](https://github.com/Tibero-Support/tibero-docker-doc/pkgs/container/tibero7)
<br>[testcontainers-tibero - github](https://github.com/Tibero-Support/tibero-test-container)

This part will continue in the next article...

## Open Source Contribution

As the implemented Flyway for Tibero was used within the team,
it worked without problems as the team originally intended, and other teams could easily apply it based on the documentation.

Therefore, we decided to make an [open source contribution](https://github.com/flyway/flyway-community-db-support/pull/58) with agreement, to help developers who use Tibero and have the same needs as us.

## Conclusion

Open source contribution was my second open source contribution after MDN Korean localization,<br>
and I think the parts we implemented (tibero-docker, tibero flyway) helped the team and also helped fill the Tibero knowledge gap I had while developing.

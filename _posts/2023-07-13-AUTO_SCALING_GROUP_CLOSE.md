---
title: AutoScaling Group의 스팟 인스턴스의 갑작스런 종료
description: AWS AutoScaling Group에서 스팟 인스턴스가 예상치 못하게 종료되는 현상의 원인 분석과 대응 방안을 정리합니다.
date: 2023-07-13 22:37:31 +0900
categories: [Issue]
tags: [Issue, AutoScaling Group, AWS, Spot Instance]
author: w-seok
lang: ko-KR
faq:
  - question: "AWS AutoScaling Group에서 스팟 인스턴스가 강제 회수 없이 종료되는 이유는 무엇인가요?"
    answer: "AutoScaling Group은 가용영역(AZ) 간 인스턴스를 균등하게 분배하려고 합니다. 특정 AZ에 인스턴스가 많으면, 해당 AZ의 인스턴스를 종료하고 인스턴스가 적은 AZ에 새로 시작하여 균형을 맞춥니다."
  - question: "AZ 밸런싱으로 인한 인스턴스 종료와 스팟 인스턴스 강제 회수를 어떻게 구분하나요?"
    answer: "AWS 콘솔의 Activity History에서 종료 사유를 확인할 수 있습니다. AZ 밸런싱의 경우 'an instance was launched to balance instances across zones'와 같은 메시지가 기록됩니다."
---

서두
---
>AWS AutoScaling Group에서 운영 중인 스팟 인스턴스가 예상치 못하게 종료되는 현상이 발생했다. 이는 강제 회수가 아닌 다른 이유로 인한 종료였으며, 그 원인과 영향, 그리고 대응 방안에 대해 분석했다.

## 문제상황

### 1. 현상

- 메시지 큐를 컨슈밍하는 스팟 인스턴스가 강제 회수되지 않았음에도 종료됨
- 새로운 인스턴스가 시작되었다는 알림 수신
- 다행이도 다른 서버가 `requeue`된 메시지를 처리하여 서비스 중단은 없었음

AutoScaling Group 로그
---
```text
At 2023-07-09T00:32:21Z instances were launched to balance instances
in zones null with other zones resulting in more than desired number
of instances in the group.
At 2023-07-09T00:46:17Z availability zones
had 4 1 instances respectively. An instance was launched to aid in
balancing the group's zones.
```

내용을 자세히 들여다보면 아래와 같다
```text
가용영역은 리전내에 격리된 위치 이들은 독립적인 영역 예를 들면 us-west-2a, us-west-2b, us-west-2c
autoscaling은 각 가용영역에 고르게 분산해서 인스턴스를 띄우는데 

이때 인스턴스가 가장적게 활성화된 가용역역에 인스턴스를 띄우고 다른곳에선는 인스턴스를 종료하여 이를 수행함.
```

결론
---

- **즉, 각 리전에 띄울 인스턴스 수를 균등하게 분배하기 위해서 한 리전에 많이떠있는 인스턴스를 종료시켜서 발생한 문제**
- **다행히 사용자 요청을 처리하던 인스턴스가 죽는 일은 매우 드물고 거의 대부분 방금 막 뜬 인스턴스가 종료되고 혹여나 요청을 처리하던 인스턴스가 죽더라도 처리되지 못한 메시지는 다시 큐안으로 `requeue`하기 때문에 슬랙 로그만 기록하는 것으로 해결**

![result - image](/assets/img/post/auto-scaling-group-close/issue.webp)

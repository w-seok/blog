---
title: Unexpected Termination of Spot Instances in AutoScaling Group
description: Analysis of the causes and countermeasures for unexpected spot instance termination in AWS AutoScaling Group.
date: 2023-07-13 22:37:31 +0900
categories: [Issue]
tags: [Issue, AutoScaling Group, AWS, Spot Instance]
author: w-seok
lang: en
faq:
  - question: "Why are spot instances terminated in AWS AutoScaling Group without being forcibly reclaimed?"
    answer: "AutoScaling Group tries to evenly distribute instances across Availability Zones (AZs). If a particular AZ has more instances, it terminates instances in that AZ and launches new ones in AZs with fewer instances to maintain balance."
  - question: "How can you distinguish between AZ balancing termination and spot instance forced reclamation?"
    answer: "You can check the termination reason in the AWS Console's Activity History. For AZ balancing, messages like 'an instance was launched to balance instances across zones' are recorded."

---

Introduction
---
>A spot instance running in an AWS AutoScaling Group was unexpectedly terminated. This was a termination for reasons other than forced reclamation, and I analyzed the cause, impact, and countermeasures.

## Problem Situation

### 1. Symptoms

- A spot instance consuming message queues was terminated even though it wasn't forcibly reclaimed
- Received notification that a new instance was started
- Fortunately, another server processed the `requeued` messages, so there was no service interruption

AutoScaling Group Log
---
```text
At 2023-07-09T00:32:21Z instances were launched to balance instances
in zones null with other zones resulting in more than desired number
of instances in the group.
At 2023-07-09T00:46:17Z availability zones
had 4 1 instances respectively. An instance was launched to aid in
balancing the group's zones.
```

Looking at the details more closely:
```text
Availability zones are isolated locations within a region. These are independent zones, for example us-west-2a, us-west-2b, us-west-2c.
AutoScaling distributes instances evenly across each availability zone.

At this time, it launches instances in the availability zone with the fewest active instances and terminates instances elsewhere to achieve this.
```

Conclusion
---

- **In other words, the problem occurred because an instance in a region with many instances was terminated to evenly distribute the number of instances across each region**
- **Fortunately, it's very rare for an instance processing user requests to die, and most of the time it's a newly launched instance that gets terminated. Even if an instance processing requests dies, unprocessed messages are `requeued` back into the queue, so we resolved it by just logging to Slack**

![result - image](/assets/img/post/auto-scaling-group-close/issue.webp)

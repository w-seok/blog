---
title: Swap Memory Check Issues and Error Logging
description: Sharing the analysis of swap memory related errors on AWS spot instances and debugging process through CloudWatch logging.
date: 2023-08-23 21:57:01 +0900
categories: [Issue]
tags: [Issue, Swap Memory, Log]
author: w-seok
lang: en
faq:
  - question: "What is the main cause of swap memory check failure on spot instances?"
    answer: "It occurs when the swap memory configured during instance setup has not yet been applied at the Java application's memory check phase. If total and free swap show as 0 when queried via ManagementFactory, the setup is not yet complete."
  - question: "What was the root cause of the chain failure?"
    answer: "The system incorrectly determined swap memory was insufficient and tried to restart the AI process. When restart failed, exit code handling was incomplete, and the server shutdown method also failed to catch errors due to legacy issues, causing cascading failures."
  - question: "What are the key solutions to prevent this problem?"
    answer: "Change to consume message queue only after confirming swap memory setup is complete, add comprehensive exception handling for process exit codes, and adjust basicAck ordering to prevent queue disconnection."

---
## Introduction
>During a meal, Slack error alerts were going off like crazy.. Fortunately, another consumer server was processing without issues, and since error logging was being managed, I immediately went into `CloudWatch` to check and analyzed the code to understand the problem.

## Problem Situation
> In the currently running `AI image processing` service, the consumer server running on spot instances has logic to check the instance's `swap memory`.
<br>This logic failed to work properly, causing all the exception handling logic to fail in a chain reaction, resulting in messages in the queue waiting indefinitely without being processed.
<br><br>The spot instance has three processes and a message queue:
<br> - Process receiving user image generation requests - **API server**
<br> - Process that receives requests from the message queue and sends them to the AI process - **Consumer server**
<br> - Message queue handling requests and responses between API server and consumer server - **Message queue**
<br> - Process that generates AI images - **AI process**
<br><br>The consumer application in service consumes request tasks from the message queue and communicates with the `AI process` (`python process` communicating with the `java` service) set up on the instance.

## Environment and Stack
- `spring boot 3.*`, `java`, `python`
- `aws`, `spot instance`

## Root Cause
>Looking at the conclusion, it seems like a fairly simple problem, but actually it took time to find the problem<br><br>
Tracking showed that various legacy issues including my mistakes were causing chain reactions...
<br>Let's organize them in order, the problems are as follows
<br><br> Since this wasn't a personal project, I can't write specific details, and I'm trying not to write specifically about the technologies used.
<br><br>I'm just trying to write about what situation occurred.. and how I tracked back to solve it.
<br><br> The problems were interconnected in sequence.

### 1. Checking Swap Memory Before Setup Completed

**The first problem was that the server incorrectly determined there was insufficient swap memory in its initial state before consuming messages from the queue after instance setup → spring setup**

1) The `swap memory` set during instance setup wasn't applied yet during the `java application's` memory check phase - occurs very rarely
  - Looking through a month's worth of logs, it happened very, very occasionally...
<br>→ **Let's make it consume queue messages only after the check is completely done**
<br><br>
2) And the problematic Java logic determined there was insufficient `swap memory`.. even though there wasn't actually any shortage.. it restarted the AI process

**Why check swap memory?**
  - For the AI process, various working models (`approximately 1~4GB`) need to be loaded into memory for fast task processing
    - If using models without preloading memory, loading and using each time is about 5x slower than preloading
  - To meet the memory needed for various models and the `java process`, `swap memory` is cost-effective, so logic to check `swap memory` before processing message queues is needed
    - Then.. since swap memory capacity isn't infinite, the number of models that can be loaded and switching frequency should be considered..
<br>-> This should be decided based on various experiential factors, not speculation

### 2. Server Tried to Restart via Script Due to Abnormally Checked Swap Memory.. But Failed

- There are various ways to restart a server, so I'll write as simply as possible
- The problem here was that the script execution didn't terminate properly, causing the restart to fail
- Currently, the server returns 0 for failure and 1 for success after restart, and retries on failure
- The problem was that the script's exit code returned a different value instead of these two values (exit code other than 0, 1)
<br>→ Exception handling for `various exit codes (timeout, memory shortage, custom values returned by the script, etc.)` needed improvement, so eventually the server couldn't restart either

### 3. shutdownConsumer Method Failed

- For exception handling of 2, the service terminates the server instance (since restart also failed, assuming there's a problem from the instance initialization process itself, terminate and launch a new spot instance)
  - The purpose of this method was to terminate the spot instance and get a new instance allocation, rather than repeatedly retrying restart when swap memory is insufficient and AI process restart has failed
- **The problem was that even though it didn't execute properly, errors weren't caught and it just passed by - a badly written method legacy**
- **Why didn't it execute properly?**
  - This legacy runs a script that terminates the server, but there were missing parts regarding exit code handling.. (handled exit codes 0,1 but what if a different exit code appears..? → problem)
  - `The cases reaching step 3 were rare (failure at 2, different exit code at 3), and the bigger problem was lack of test code`

### 4. Since Server Wasn't Terminated, Java Thought Everything Was Normal and Executed Next Logic...

1) AI server obviously couldn't restart so it was dead, request failed and threw an error
<br>→ That error was caught by the image consumer (calling parent class) again
2) Here you need to know about situation `5` below..

### 5. Server's Initial Boot Process Includes Sample Data Processing for Quick AI Process Startup

1) The existing consumer cancels the message queue when the AI process cannot generate images, so that actual user requests don't get lost
2) The problem is, for sample data, since it's not actual data from the message queue,
<br>when doing `basicreject`, **since the deliveryTag was already acked** (it was dummy data unrelated to the message queue, not a sent and received message)
<br>the normal connection with the message queue was also broken..
3) And continuing server status check, since the `AI process` is dead, sends error alert and enters indefinite wait state

### 6. Already Disconnected Queue..
1) After the developer who noticed situation `4` manually restarted the `AI process`, hoping to process the next queue message...
2) Since the queue was already disconnected, messages couldn't be processed and errors occurred `channel is already closed due to channel error; protocol method…..`

## Issues and Considerations

1. **Since swap memory check happened before swap memory was set up**, it always tried to restart the AI process
  - The fundamental problem, if problem 1 didn't occur, everything would have worked normally
  - Missing Slack alert when memory check shows insufficient
  - Missing swap memory setup check logic
2. When restart fails, **shutdownConsumer is called but not working properly** + errors aren't being caught
  - If you call the shutdown method directly on the server using `jshell` → it works normally = no issues with permissions, functionality itself, etc.
  - Currently missing exit code handling (*error didn't occur during execution but exit code is not 0)*
  - **First, is the instance termination functionality even needed?**
    - Yes, instead of repeating logic 1, 2, it's more reasonable to terminate the spot instance and get a new allocation (could be an instance itself problem) + resource consumption from multiple retries vs spot instance termination and reallocation
3. On sample data processing failure (not actual messages from message queue), doing basicreject - **shouldn't reject if it's not a queue message**
  - On memory check, for initial requests, catch exception then alert and wait

## Successful Resolution

1. *Check if memory is set up* using `ManagementFactory.getPlatformMBeanServer` - if total, free swap are 0 (= not set up), skip*
2. Check exit codes of ec2 termination script
- Let's write something like below

```java
    int exitCode;
    var processBuilder = new ProcessBuilder();
    var process = processBuilder.command(
            "aws", "ec2", "terminate-instances",
            "--instance-ids", instanceId,
            "--region", region
    ).start();
    exitCode = process.waitFor();

    if (exitCode == 0) {
        return;
    }

    // No error during execution but exit code is not 0 (abnormal behavior)
    String errorMsg;
    try {
        errorMsg = IOUtils.toString(process.getErrorStream(), StandardCharsets.UTF_8);
    } catch (Exception e) {
        errorMsg = "Error occurred while extracting error message " + e.getMessage();
    }
    throw new RuntimeException(errorMsg);
```

3. Fix existing basicAck handling

   1. If ack is delayed, check if there are issues with user receiving images, or problems with other consumers or the consumer itself
   - Need to wait before ack processing and check if user receives image before that
     <br>
     → They do receive it, so after one consumer finishes image generation and reports for one of the user's requests, even if memory check logic takes a long time or instance terminates, other consumers can handle the rest without issues (previously, since ack was done first, the next image was in unacked state so other consumers couldn't touch it)
     <br><br>
   - Need to check if queue properly rejects when error occurs before ack processing (after image generation and reporting is done)<br><br>
   2. After moving basicack down, check if there are problematic parts when exceptions occur during task processing (like queue not being cancelled)<br><br>
   3. What if exception (i/o exception) occurs during basicAck?
   - Previously, it rejected the queue - since image completion was already reported, just rejecting the queue has no issues with user receiving images
   - Test what happens if exception is just thrown
     - **Important thing is that next image processing should have no issues**

     → Shouldn't just let it throw, exception is only printed and what was unacked (if 4 messages and exception occurred during ack after processing and reporting first message) goes back to ready, problem (**first problem**) second is `it just stops without consuming subsequent messages`

     → Let's check AI process status first then handle errors

# Retrospective

<aside>
💡   Actually, my carelessness in failing to understand the history or just passing by legacy code was also a problem. And I learned after experiencing this problem that it's important not just to leave legacy code or previous history alone, but to understand how it's connected to current problems.

Most importantly, I think we need to understand the team's code and project history more deeply. That way, during reviews, we can consider why the code was written this way and what sideEffects might occur.

<br>+ The article is too verbose, but trying to explain the problem situation while excluding specific details about actual work made it more of a personal reflection...
</aside>

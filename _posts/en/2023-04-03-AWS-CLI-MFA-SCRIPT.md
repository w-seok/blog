---
title: AWS-CLI MFA Renewal Automation Script
description: Sharing how to write a shell script that automates MFA authentication across multiple AWS regions. Solves the hassle of repeated authentication when using AWS CLI.
date: 2023-04-03 21:19:04 +0900
categories: [Programming, SHELL]
tags: [AWS, Shell, MFA]
author: w-seok
lang: en
---
Introduction
---
> When using `AWS CLI` with an MFA-enabled account, authentication must be obtained through the profile's `MFA` token.
<br>When needing to authenticate and use multiple regions, the process of getting `MFA` authentication for each profile can be cumbersome.
<br><br>I want to write a local script to automate this. (Nowadays you can get `MFA` values directly from `PC`.. it might be simpler..)

Key Considerations
---
### 1. JSON Data Parsing

- Using standard `Unix` tool `sed` instead of [`jq` library](https://github.com/jqlang/jq)
- `sed` has the advantage of not requiring additional installation, but can only be applied to predictable `JSON` structures
  - Since it's literally a text editing tool, it only helps when the data to edit is `predictable`.
  - In this case, it's used only to process `json` data returned by `aws sts get-session-token`, and since the data structure is fixed (**unless AWS changes it**), `exit code` handling is needed

### 2. Script Configuration

- Add required configuration values to the script
- Run the script file with `MFA token value` as parameter `ex) ./aws_login.sh 123456`
- Use `aws-cli` ex) Assuming you want to list S3 buckets `aws s3 ls --profile {myProfile}`

### 3. Security Considerations

- Must only be used in local environment (includes sensitive information like MFA token values, access tokens, etc.)
- Also, setting the token expiration time is important (longer is more convenient, but also means more vulnerable to security)

## Code

```shell
#!/bin/bash

# Store the MFA token value received as parameter in a variable
mfa_token=$1

# Set values needed for configuration
aws_access_key_id={}
aws_secret_access_key={}
aws_region={}
arn_number={}
duration_time={}

# Check if each configuration value is properly set
if [[ -z $aws_access_key_id || -z $aws_secret_access_key || -z $aws_region || -z $arn_number || -z $duration_time ]]; then
    echo "Environment variables are not set. Please check and try again."
    exit 1
fi

read -p "First, clearing the existing contents of ~/.aws/config and ~/.aws/credentials. Do you want to continue? (y/n): " response
if [[ "$response" != "y" ]]; then
    echo "Exiting script."
    exit 1
fi

echo "Clearing config."
> ~/.aws/config

echo "Clearing credentials."
> ~/.aws/credentials

echo "clear complete"

aws configure set aws_access_key_id $aws_access_key_id
aws configure set aws_secret_access_key $aws_secret_access_key
aws configure set region $aws_region

echo "configure complete"

sts_output=$(aws sts get-session-token --serial-number "${arn_number}" --token-code "${mfa_token}" --duration-seconds $duration_time)

# Check with exit code (normal: 0)
if [ $? -ne 0 ]; then
    echo "Error occurred while requesting STS token."
    exit 1
fi

echo "sts complete"

access_key_id=$(echo "$sts_output" | sed -n 's/.*"AccessKeyId": "\([^"]*\)".*/\1/p')
secret_access_key=$(echo "$sts_output" | sed -n 's/.*"SecretAccessKey": "\([^"]*\)".*/\1/p')
session_token=$(echo "$sts_output" | sed -n 's/.*"SessionToken": "\([^"]*\)".*/\1/p')

# Check if extracted values are empty
if [[ -z "$access_key_id" || -z "$secret_access_key" || -z "$session_token" ]]; then
  echo "Failed to extract values from sts_output"
  exit 1
fi

cat <<EOF > ~/.aws/credentials
[default]
aws_access_key_id = ${access_key_id}
aws_secret_access_key = ${secret_access_key}
aws_session_token = ${session_token}
EOF

echo "success"
```

## Result

- As shown below, entering the MFA token value makes MFA authentication very simple.

![result - image](/assets/img/post/aws-cli-mfa/mfa_shell_success.webp)

However, there are limitations. Even with the automation script, it was impossible to authenticate multiple region profiles at once, because as shown below, an already used MFA token cannot be used for authentication of another region profile.
  - Need to consider a method that allows selecting the desired region and authenticating one by one

```text
An error occurred (AccessDenied) when calling the GetSessionToken operation: MultiFactorAuthentication failed with invalid MFA one time pass code.
Error occurred while requesting STS token.
```

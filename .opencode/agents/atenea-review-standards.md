---
description: Matt Standards-axis reviewer bound to GPT-6 Luna high. Read-only and independent from the writer.
mode: subagent
model: openai/gpt-6-luna#high
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: shell
    resource: "*"
    effect: deny
  - action: shell
    resource: "git diff*"
    effect: allow
  - action: shell
    resource: "git log*"
    effect: allow
  - action: shell
    resource: "git show*"
    effect: allow
  - action: shell
    resource: "git rev-parse*"
    effect: allow
  - action: shell
    resource: "git status*"
    effect: allow
  - action: subagent
    resource: "*"
    effect: deny
  - action: skill
    resource: "*"
    effect: deny
  - action: webfetch
    resource: "*"
    effect: deny
  - action: websearch
    resource: "*"
    effect: deny
  - action: external_directory
    resource: "*"
    effect: deny
---
Run only the Standards axis requested by Matt `code-review` against the supplied fixed point/diff and standards sources. Follow Matt's documented Standards brief and smell baseline; repository standards override generic smells. Report concrete findings, do not edit.

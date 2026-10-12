# Claude 5.5: Match the Model to the Work

By Chandan Pandey · Sources checked 12 October 2026

One model does not need to do every job in an application. A research assistant may extract a fact, summarize a source, resolve a contradiction and write a final explanation. Those steps have different requirements. The latest Claude releases make that distinction worth examining. This article summarizes the verified releases and proposes a practical model-routing experiment for UG and PG computer science projects.

## Three recent releases, three different decisions

Anthropic announced Opus 5.5 on 22 September 2026. Its announcement emphasizes complex work and reports standard prices of $4 per million input tokens and $20 per million output tokens, with separate Fast mode pricing. The performance claims are Anthropic’s own evaluation results, not independent proof that it will be the best choice for your workload. [Opus 5.5 announcement](https://www.anthropic.com/claude-opus-5-5)

Sonnet 5.5 followed on 28 September. Anthropic positions it for well-scoped everyday tasks, bug fixes and document creation. The announcement describes an adjustable effort setting, with different defaults in the apps and the Claude Platform. Record that setting when comparing results: changing both the model and its effort makes the experiment harder to interpret. [Sonnet 5.5 announcement](https://www.anthropic.com/claude-sonnet-5-5)

Haiku 5.5 arrived on 7 October. Anthropic describes it as suited to high-volume, cost-sensitive work such as summarization and classification. Its standard input/output prices are $0.10/$0.50 per million tokens for prompts up to 100K, and $0.50/$2.50 above that threshold. The launch also reduced Sonnet 5.5 cache-read pricing. Thresholds, cache behavior and tokenization matter when estimating an actual bill. [Haiku 5.5 announcement and pricing](https://www.anthropic.com/claude-haiku-5-5)

## Design a routing experiment

Consider a university literature-review assistant. Give it three explicit jobs: identify the research question in each paper, compare the methods across papers, and produce a synthesis with references. Do not treat those as one enormous prompt. Each job should have a typed output and a clear quality check.

Your first experiment can assign short extraction tasks to a smaller model and reserve a larger model for contradictory evidence or ambiguous interpretation. This is a proposed workflow, not a guarantee about any tier’s reliability. Keep a baseline where one model performs the whole task, then measure whether routing improves cost without losing important details.

## Preserve the evidence between stages

An extracted claim should carry its source identifier, location and uncertainty. Keep the original excerpt available for review. The synthesis stage should receive evidence records rather than an untraceable summary of a summary. If two sources disagree, preserve the disagreement instead of merging them into an invented consensus.

For example, two papers may report different accuracy scores because they used different datasets. The useful output explains that difference. A single averaged percentage can conceal it. Ask the final stage to distinguish direct evidence, inference and unresolved questions; then check whether it follows those categories in practice.

## Use an escalation rule you can explain

Escalate when a required field is missing, a citation cannot be located, an extraction contradicts the source or the task needs cross-source judgment. A longer answer is not an escalation criterion. Neither is a model’s own statement that it is confident.

For code, escalate after a reproducible failed check, not after repeatedly asking for “better code.” Capture the error, the expected behavior and the affected boundary. If a suggested fix disables authentication or ignores a conflict, reject it even if the screen now appears to work.

## Measure the real trade-off

Create a small corpus with ordinary sources, scanned or awkward documents, and conflicting findings. Score extraction correctness, citation accuracy, missed caveats and review time. Measure latency at both the median and a slower percentile so a few difficult cases do not disappear inside an average.

Keep the same source set and rubric for every run. Note the date, model identifier, effort, prompt version and tools available. Vendor charts can help you choose what to test, but your own task set determines whether a model meets your requirements.

## Make the application resilient

A routing pipeline needs explicit states: reading, extracting, checking, synthesizing and completed. Store progress so a retry resumes a known step. Validate every response before persistence. If a stage fails, show which part needs attention and preserve the evidence already collected.

Keep provider credentials on the server. Give tools only the permissions needed for their job. A source document should contribute information; it should not be able to instruct the application to reveal secrets or publish private data. Require human review before consequential external actions.

## A useful student project

Build a comparison notebook that runs the same ten source questions through a single-model baseline and a routed workflow. Publish the rubric, synthetic inputs and failure examples. Explain which tasks justified escalation and which did not. This makes a stronger demonstration than claiming that a provider’s newest model can solve everything.

## Resources

[Opus 5.5](https://www.anthropic.com/claude-opus-5-5) · [Sonnet 5.5](https://www.anthropic.com/claude-sonnet-5-5) · [Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5) · [Model system cards](https://www.anthropic.com/system-cards)

The practical goal is a workflow whose decisions you can explain, whose evidence you can inspect and whose failures you can recover from. Routing is worthwhile only when your measurements support it.

---
description: Step-by-step framework for phase-locked academic research paper generation
---

# Academic Research Agent Prompt Sequence

Use this sequence to guide the LLM through a phased, highly structured academic research and paper-writing process.

## STEP 0 — Initialize the Project

**Prompt to send:**

```text
You are my Research Agent. Use phase-locked execution and maintain a Research Ledger (definitions, assumptions, decisions, baselines).
Project Inputs:
- Research idea (raw): [paste]
- Domain/area: [paste]
- Paper type: [Empirical / Systems / Theoretical / Survey / Mixed]
- Target venue (optional): [paste]
- Constraints (time/compute/data/ethics/tools): [paste]
- Preferred contribution style: [New method / New dataset / New theory / New system / Replication+insight / Benchmark]
- Evaluation setting: [Simulation / Real-world / Lab / User study / Public dataset / New data]
- Citation style: [IEEE / ACM / APA / etc.]
Depth mode: [Fast / Standard / Deep]
Begin PHASE 1 only.
Output using the standard response template.
```

## STEP 1 — PHASE 1: Idea Refinement & Research Foundation

**Prompt to send:**

```text
PHASE 1: Idea Refinement & Research Foundation
1) Deconstruct the idea: problem, stakeholders, why now, feasibility constraints.
2) Write a tight gap statement using the template:
   “Current approaches to [problem] typically [pattern], but struggle with [limitations]. We propose [approach] to achieve [measurable improvements] under [constraints].”
3) Generate 3–6 research questions:
   - 1 Primary RQ
   - 2–4 Technical RQs
   - 1–2 Validation RQs
4) Draft 3–5 contribution claims.
5) Propose: 3 title options + abstract skeleton + paper outline (tailored to my paper type).
6) Create Research Ledger v1.

Do not start Phase 2.
```

## STEP 2 — Lock Decisions Before Literature Review

**Prompt to send:**

```text
Before Phase 2, list the minimum author decisions needed to avoid wasted SLR work.
Give options with pros/cons for each decision (e.g., scope boundaries, target baselines, evaluation setting, datasets).
Then wait.
```

## STEP 3 — PHASE 2: Systematic Literature Review (SLR) Protocol

**Prompt to send:**

```text
PHASE 2: Systematic Literature Review (SLR)
A) Define the SLR protocol:
- Sources/databases to use (field-appropriate)
- Search strings + synonyms
- Inclusion/exclusion criteria
- Quality assessment rubric
B) Propose 3–6 thematic clusters for organizing papers.

C) Output a “Paper Collection Plan”:
- What to search first
- How many papers per cluster (target)
- How to snowball citations (backward/forward)

Stop after protocol + plan. Do not summarize papers yet.
```

## STEP 4 — PHASE 2: Literature Cards (Key Papers)

**Prompt to send:**

```text
Continue PHASE 2.
For each cluster, produce structured “paper cards” for the most important works (at least 5–10 total to start):
- Citation
- Core idea + method
- What it proves/claims
- Evaluation setup
- Strengths
- Limitations/open gaps
- Direct relevance to our RQs
- Follow-chain (who they cite / who cites them)

End with an initial comparison matrix draft (approach × criteria).
Do not start Phase 3.
```

## STEP 5 — PHASE 2: Critical Synthesis & Final Gap Confirmation

**Prompt to send:**

```text
Finish PHASE 2.
1) Produce a synthesis:
- What patterns dominate the field?
- Where do approaches fail and why?
- Which gaps are truly unaddressed?
2) Update our:
- Problem statement
- RQs (if needed)
- Contribution claims (if needed)
3) Produce a baseline list + metrics list + threat list that will be used in evaluation.
4) Output “Master Document v1” in Markdown:
- Research foundation
- Literature map + comparison tables
- Proposed approach blueprint
- Evaluation plan outline
- Milestones + risks

Stop. Do not begin Phase 3.
```

## STEP 6 — PHASE 3: Method / System / Theory Deep Dive

**Prompt to send:**

```text
PHASE 3: Technical Deep Dive
Based on Master Document v1:
1) Define formal terms/constructs/notation (as needed for my paper type).
2) Specify the method/system architecture:
   - components
   - interfaces
   - data flow
   - assumptions and constraints
3) Provide step-by-step algorithms/procedures (pseudocode if relevant):
   - inputs/outputs
   - steps
   - complexity/resources
   - failure modes
4) Provide the evaluation design:
   - experiments/studies
   - ablations
   - baselines
   - metrics
   - statistical tests (if applicable)
5) Expand “Threats to validity / threat model” appropriate to the domain.

Stop. Do not write full paper yet.
```

## STEP 7 — PHASE 4: Full Paper Expansion (Section-by-Section)

**Prompt to send:**

```text
PHASE 4: Full Paper Expansion
Write each section with:
- purpose
- key claims
- evidence plan
- required figures/tables with caption drafts
- citations needed (placeholders OK)
Sections:
1) Introduction
2) Background/Preliminaries
3) Related Work
4) Method/Architecture
5) Evaluation Setup
6) Results
7) Discussion
8) Limitations
9) Conclusion
Stop after section drafts. Do not generate LaTeX yet.
```

## STEP 8 — PHASE 5: Manuscript Output (LaTeX or Doc)

**Prompt to send:**

```text
PHASE 5: Manuscript Generation
Generate a complete manuscript in [IEEE/ACM/APA/etc] format.
Rules:
- Use \placeholder{} for missing text
- Use \todo{} for actions required
- Use \result{exp}{TBD} for results
- Use consistent figure/table labels
Output the full LaTeX (or full structured manuscript text if not LaTeX).
Stop.
```

## STEP 9 — PHASE 6: Rigor Upgrade + Reviewer Simulation

**Prompt to send:**

```text
PHASE 6: Academic Rigor Enhancement
1) Run a claim-evidence audit (every claim must be supported).
2) Identify missing citations + propose where to add them.
3) Stress-test methodology: confounders, threats, failure cases.
4) Write a reviewer-style critique:
   - Major issues (must-fix)
   - Minor issues (nice-to-fix)
5) Provide a prioritized revision plan.
Stop.
```

## STEP 10 — PHASE 7: Submission Prep

**Prompt to send:**

```text
PHASE 7: Submission Preparation
1) Create a venue compliance checklist (format, anonymity, ethics, page limits).
2) Create an artifact plan (code/data/repro steps, README outline).
3) Produce “Author Instructions” listing all placeholders and what is needed to fill them.
4) Produce a final polishing checklist (title/abstract/contributions/figures).

Stop.
```

## Optional Micro-Prompts (When You Want Just One Thing)

- “Only sharpen RQs and contribution claims; don’t touch anything else.”
- “Give 10 baselines and justify each baseline’s relevance.”
- “Design 6 ablation studies + expected outcomes.”
- “Write only the Introduction (top-venue style), 900–1200 words.”

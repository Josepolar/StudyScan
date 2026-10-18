# StudyScan development and evaluation plan

This is a proposed protocol, not a report of completed research. The local software checks do not establish educational effectiveness.

## Research questions

1. Does StudyScan provide useful, accurate assistance grounded in teacher-approved materials?
2. Does it follow teacher assistance modes and restrictions?
3. Can students and teachers complete their intended workflows with reasonable effort?
4. Does the question dashboard help teachers identify areas that warrant additional explanation?

## Functional evaluation

Use separate teacher, assigned student, and unassigned student accounts. Exercise lesson CRUD, publishing, individual/class assignments, activity restrictions, scheduling at boundary times, resource access, follow-up questions, flags, and teacher notes. Test both successful and failed requests. Verify persistence after restart and database restoration. Include access checks on API calls, not just hidden buttons.

## AI response evaluation

Teachers should prepare a held-out set of questions across their actual approved modules: straightforward definitions, conceptual explanations, misconceptions, multi-step problems, ambiguous questions, missing-source questions, out-of-scope requests, and attempts to override instructions. Include at least several examples of each type in each supported assistance mode. Record the model version, configuration, source text version, prompt version, and date.

For each response, two reviewers can independently score:

| Criterion | Suggested scoring |
| --- | --- |
| Factual correctness | 0 incorrect, 1 partly correct, 2 correct |
| Grounding | 0 unsupported, 1 partly supported, 2 fully supported by supplied material |
| Citation relevance | 0 irrelevant, 1 partly relevant, 2 relevant |
| Assistance-mode adherence | Pass/fail with explanation |
| Direct-answer restriction | Pass/fail/not applicable |
| Clarity for the grade level | 1–5 with examples |
| Appropriate refusal/escalation | Pass/fail/not applicable |

Measure latency, provider failures, unsupported-answer rate, and refusal rate. Review false refusals as well as unsupported answers. Report disagreement between reviewers and resolve it transparently. Do not equate a model's self-reported confidence with accuracy.

## Usability sessions

Ask teachers to create a class, upload or enter a module, select a guidance mode, restrict an activity, and review a flagged conversation. Ask students to join a class, locate a lesson, ask a clarification question, inspect a citation, and flag a response. Record task completion, time, errors, and where help was required. Collect brief ratings and open comments about clarity, usefulness, and ease of use. Report participant count and sampling limitations.

## Learning support pilot

With school approval and appropriate participant consent, conduct a small pilot using teacher-created lessons. Collect baseline and follow-up concept checks aligned to those lessons. If making comparative claims, use a suitable comparison group or counterbalanced design and account for prior knowledge, attendance, and other instruction. Do not infer that StudyScan caused learning gains from usage counts or an uncontrolled before/after change alone.

## Teacher dashboard evaluation

Give teachers de-identified question sets with known recurring misconceptions. Compare the concepts they identify with a teacher-reviewed reference list. Record missed patterns, false patterns, time taken, and whether follow-up instruction was actionable. The current dashboard uses topic and exact-question counts; it does not automatically diagnose misconceptions.

## Reporting

Separate functional reliability, AI quality, usability, and educational outcomes. Report failures and exclusions, not only averages. Include the exact evaluation conditions and distinguish measured findings from proposed benefits. No learner data, participant results, or usability scores have been collected in this development session.

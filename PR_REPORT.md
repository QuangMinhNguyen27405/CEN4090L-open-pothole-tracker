# Pull Request Progress Log

**Project:** Open Pothole Tracker

**Goal:** Build a web application that detects potholes from camera input, associates them with locations, shares them on a map, supports community confirmation, and lets administrators review reports.

## How to maintain this report

For **every PR**, append a dated team entry to Section 1 and a dated entry for that same PR under **each of the five members** in Section 2. At the close of each **increment**, update Sections 3, 4, and 5. Add new entries after older entries, immediately before the corresponding `LOG_END` marker. Keep earlier entries so the file remains a chronological history of the project. Use the templates in Section 6.

Section 1 is a **team PR log**: what each PR accomplished, the state of the whole project after it, shared challenges or scope changes, and verification. Section 2 is a **member PR log**: each member's contribution, challenges, and remaining work for that PR. A member with no contribution or challenge writes `None for this PR` in that field. Each member updates or confirms their own entry before the PR is marked ready to merge. Sections 3–5 record plans, stakeholder communication, and video links **once per increment**, not once per PR.

Use `YYYY-MM-DD` dates and the same PR number/title in all six PR entries. Link the PR and any relevant functional requirements from [RD_REPORT.md](RD_REPORT.md). Record actual test results; do not describe planned tests as passed. If a PR number is not available yet, use its branch name and replace it when the number is assigned. Give every increment entry its number and closeout date. Never overwrite an older entry; add a dated correction if an earlier fact needs fixing.

**For agents maintaining this file:** Read the PR diff and existing log before drafting the Section 1 entry. Add the five Section 2 entry slots, but leave `Pending member update` for information only that member can provide. Do not infer individual contributions or claim a member had no challenges without their confirmation. A PR entry is complete only when all five member entries have been filled or confirmed by their respective members. For increment closeouts, use the separate templates for Sections 3–5; do not invent a stakeholder message or video link.

## 1. Project report — team progress log

Append one team snapshot for each PR. State the **cumulative project status after the PR** as well as the progress made in it. The log starts empty because no completed PR entry has been supplied for this report.

<!-- TEAM_LOG_START -->
<!-- TEAM_LOG_END -->

## 2. Member progress logs by PR

Each member appends one entry for every PR under their own heading, including PRs where they did no work. Entries should describe only that member's contributions and challenges, with dates and links so contributions can be tracked over time.

### 2.1 Linh Nguyen — Backend, database, and real-time systems

FSU ID: `ltn23` · GitHub: `@LinhNguyen2901`

<!-- LINH_LOG_START -->
<!-- LINH_LOG_END -->

### 2.2 Quang Minh Nguyen — AI detection and computer vision

FSU ID: `mqn23` · GitHub: `@QuangMinhNguyen27405`

<!-- QUANG_LOG_START -->
<!-- QUANG_LOG_END -->

### 2.3 Thien Le — Frontend, maps, and user experience

FSU ID: `cl23m` · GitHub: `@ThienLe3101`

<!-- THIEN_LOG_START -->
<!-- THIEN_LOG_END -->

### 2.4 Vinh Do — GPS, camera, and geospatial systems

FSU ID: `vcd23a` · GitHub: `@vdc109`

<!-- VINH_LOG_START -->
<!-- VINH_LOG_END -->

### 2.5 Hoang Vu — Authentication, crowdsourcing, and administration

FSU ID: `hmv23` · GitHub: `@hoangvu5`

<!-- HOANG_LOG_START -->
<!-- HOANG_LOG_END -->

## 3. Plans for the next increment

At each increment closeout, add one dated plan. Describe the goals, likely owners, dependencies, and risks for the next increment. If no next increment remains, record remaining work or handoff plans instead.

<!-- PLAN_LOG_START -->
<!-- PLAN_LOG_END -->

## 4. Stakeholder communication

At each increment closeout, add a dated draft email of **500 words or fewer**. Explain progress, current status, setbacks, and next steps to stakeholders familiar with road-condition reporting. Keep the message understandable without implementation details or course-specific language.

<!-- STAKEHOLDER_LOG_START -->
<!-- STAKEHOLDER_LOG_END -->

## 5. Video or presentation links

At each increment closeout, record the dated video or presentation link and what it demonstrates. If a link is not ready, record `Pending` and add a dated update when available.

<!-- VIDEO_LOG_START -->
<!-- VIDEO_LOG_END -->

## 6. Templates for future updates

Copy the relevant templates into the logs above. Use the PR templates for every PR and the closeout templates for each increment. Replace all angle-bracket prompts in completed entries. Keep the templates here for future contributors and agents.

### 6.1 Team PR entry — append to Section 1 for every PR

```markdown
### YYYY-MM-DD — PR #<number>: <short title>

- **PR:** <link> · **Author:** <name>
- **Related issues and requirements:** <links and FR IDs, or None>
- **Purpose:** <problem this PR addresses>
- **Team accomplishments in this PR:** <features, integration, documentation, and tests completed>
- **Overall project status after this PR:** <what works now, what remains in progress, and progress toward project goals>
- **Shared challenges, setbacks, or scope changes:** <what happened, why, resolution, or None>
- **Verification:** <checks run and outcomes; state anything not tested>
- **Immediate follow-up:** <concrete tasks before or in the next PR>

**Completion check**
- [ ] The team entry describes overall project status after this PR.
- [ ] All five member entries for this PR are filled or confirmed by their members.
- [ ] Contributions, challenges, tests, links, and requirement IDs are accurate.
- [ ] No pending updates or angle-bracket prompts remain in this PR's entries.
```

### 6.2 Member PR entry — append to each member's Section 2 log

```markdown
#### YYYY-MM-DD — PR #<number>: <short title>

- **Contributions:** <work this member did in this PR, or None for this PR>
- **Areas and deliverables:** <code, design, requirements, testing, documentation, review, or presentation links; or None for this PR>
- **Challenges and resolution:** <specific challenge, effect, and response; or None for this PR>
- **Remaining work or blocker:** <next action or None>
- **Member confirmation:** <member name and date; Pending member update until confirmed>
```

### 6.3 Next-increment plan — append to Section 3 at each closeout

```markdown
### YYYY-MM-DD — Increment <number>

- **Next goals or handoff:** <planned work for the next increment; for the final closeout, remaining work or handoff>
- **Likely owners and dependencies:** <members, services, or decisions needed>
- **Risks to the plan:** <known concerns or None>
```

### 6.4 Stakeholder email — append to Section 4 at each closeout

```markdown
### YYYY-MM-DD — Increment <number>

**To:** <stakeholder group>

**Subject:** Open Pothole Tracker progress update

<Draft an email of 500 words or fewer covering progress, current status, setbacks, and next steps in stakeholder-friendly language.>
```

### 6.5 Video or presentation — append to Section 5 at each closeout

```markdown
### YYYY-MM-DD — Increment <number>

- **Link:** <URL or Pending>
- **Shows:** <features, results, or presentation topics; or Pending>
```

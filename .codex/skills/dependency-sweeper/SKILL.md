---
name: dependency-sweeper
description: >
  Triage Realtime Question Coach dependency updates, security alerts, lockfile churn, and dependency noise in report-only mode only when Pattern Picker marks dependency-sweeper active and loop-budget/human approval allow it. Otherwise record dependency signals through daily-triage. Use when dependency signals are the primary concern and Codex must classify update type, risk, human gate needs, noise grouping, handoffs, and safe next action without changing package files, lockfiles, code, PRs, CI, or external state.
---

# Dependency Sweeper Skill

Realtime Question Coach の `dependency-sweeper` Loop Pattern を実行する。dependency update / security alert / lockfile churn / dependency noise が primary signal である場合に、dependency 状態、risk、human gate、noise group、next action を report-only で出す。

現時点では L1 monitor-only / report-only を基本とする。code、test、package file、lockfile、workflow、config、PR、repository service state、external state は変更しない。

## Runtime Activation Guard

この skill は、Pattern Picker が `dependency-sweeper` を active Pattern として選び、`loop-budget.md` の budget と人間承認が揃っている場合だけ直接実行する。通常運用では `dependency-sweeper` は scaffolded inactive であり、dependency signal は `daily-triage` の report-only signal として記録する。

## Read Order

1. `loop-constraints.md`
2. `loop-budget.md`
3. `loop-run-log.md`
4. `STATE.md`
5. `docs/patterns/dependency-sweeper.md`
6. `loop-state/dependency-sweeper.md`
7. dependency evidence

必要に応じて `docs/pattern-picker.md`, `LOOP.md`, related AI Work Ticket / PR / CI summary を読む。

## Hard Boundaries

- L1 では code、test、package file、lockfile、workflow、config を変更しない。
- L1 では `bundle update`、`npm update`、`yarn upgrade`、install、audit fix、lockfile regeneration を実行しない。
- L1 では dependency PR comment 投稿、approval、merge、close を行わない。
- L1 では branch 作成、push、PR 作成を行わない。
- CI rerun、workflow dispatch、deploy、external service 操作を行わない。
- security alert を人間承認なしに dismiss / close しない。
- runtime / framework / major update を自律判断で進めない。
- PR review、conflict、approval、merge readiness が主問題なら `pr-babysitter` signal として扱う。
- CI failure の原因調査や修正判断が主問題なら `ci-sweeper` signal として扱う。

## Guard Check

次に該当する場合は実行せず、`loop-run-log.md` に blocked / no-op 理由を残す。

- `loop-pause-all` が有効。
- budget がない。
- Pattern Picker が `dependency-sweeper` を active Pattern として選んでいない、または `loop-budget.md` で `dependency-sweeper` の実行 budget / human approval がない。
- dependency evidence を読めない。
- secret、credential、production data を読む必要がある。
- package file / lockfile / config の変更実行が必要である。
- security alert dismiss、merge、close、deploy が必要である。
- PR review / CI failure / spec 未確定が primary signal である。
- deny list に該当する作業しか考えられない。

## Workflow

### 1. Dependency Inventory

dependency item ごとに次を確認する。

- provider
- repository
- package manager
- package file
- lockfile
- dependency name
- current version
- target version
- update type
- direct / transitive
- advisory / CVE
- related PR
- CI status summary
- first seen / repeated count
- related AI Work Ticket

### 2. Dependency Classification

次のいずれかに分類する。

- `security_alert`
- `patch_update`
- `minor_update`
- `major_update`
- `runtime_or_framework_update`
- `lockfile_churn`
- `transitive_resolution`
- `duplicate_or_stale_alert`
- `dependency_noise`
- `blocked_by_ci`
- `blocked_by_pr_state`
- `unknown`

### 3. Risk And Human Gate

次の場合は human gate または blocked にする。

- security alert、CVE、vulnerability advisory が絡む。
- major update、runtime / framework update、DB adapter、auth、payment、external integration が絡む。
- Gemfile、Gemfile.lock、package.json、yarn.lock、webpack config、Sprockets require chain の変更が必要。
- production / staging / external service の状態変更が必要。
- daily lock、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master が絡む。
- CI workflow / build config、deploy config、infrastructure config の変更が必要。
- test 削除、skip、弱体化でしか green にできない。
- dependency update 方針が仕様や運用判断に依存している。

### 4. Next Action

次のいずれかを選ぶ。

- `monitor_only`
- `needs_human`
- `handoff_to_pr_babysitter`
- `handoff_to_ci_sweeper`
- `handoff_to_daily_triage`
- `ready_for_noise_grouping`
- `ready_for_impact_report`
- `ready_for_update_plan`
- `blocked_by_constraints`

## L1 Output

`loop-run-log.md` に次の構造で記録する。

```yaml
dependency_sweeper_result:
  items_scanned:
  items_actionable:
  items_blocked:
  noise_groups:
    - group_id:
      group_type:
      count:
      dependencies:
      risk_level:
      human_gate_required:
      next_action:
      evidence:
  dependency_items:
    - dependency_id:
      dependency_name:
      package_manager:
      package_file:
      lockfile:
      current_version:
      target_version:
      dependency_type:
      direct_or_transitive:
      advisory:
      related_pr:
      ci_status:
      risk_level:
      human_gate_required:
      next_action:
      next_owner:
      evidence:
  handoffs:
    pr_babysitter:
    ci_sweeper:
    daily_triage:
    human:
  state_updates:
    watch_list:
    noise_groups:
    blocked:
```

`loop-state/dependency-sweeper.md` には active dependency items、watch list、noise groups、security / major / runtime watch、blocked dependency items、handoff queue、last run summary だけを残す。advisory や PR の本文全文は貼らず、URL と短い excerpt に留める。

## Completion Check

- guard check の結果がある。
- items scanned / actionable / blocked がある。
- dependency item ごとに `dependency_type` がある。
- noise group がある場合は group 化の理由がある。
- human gate / deny list / blocked 理由が明確である。
- next action と next owner が分かる。
- `loop-run-log.md` と `loop-state/dependency-sweeper.md` に次回への引き継ぎがある。

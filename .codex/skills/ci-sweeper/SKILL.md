---
name: ci-sweeper
description: >
  Triage Realtime Question Coach CI failures in report-only mode only when Pattern Picker marks ci-sweeper active and loop-budget/human approval allow it. Otherwise record CI signals through daily-triage. Use when CI failure is the primary signal, workflow/branch/log context is available, and Codex must classify failure cause, risk, human gate needs, and safe next action without changing code, workflows, secrets, or external state.
---

# CI Sweeper Skill

Realtime Question Coach の `ci-sweeper` Loop Pattern を実行する。CI failure が primary signal であり、workflow / branch / job / failure log を読める場合に、原因分類、risk、human gate、next action を report-only で出す。

現時点では L1 monitor-only / report-only を基本とする。code、test、workflow、config、secret、external state は変更しない。

## Runtime Activation Guard

この skill は、Pattern Picker が `ci-sweeper` を active Pattern として選び、`loop-budget.md` の budget と人間承認が揃っている場合だけ直接実行する。通常運用では `ci-sweeper` は scaffolded inactive であり、CI signal は `daily-triage` の report-only signal として記録する。

## Read Order

1. `loop-constraints.md`
2. `loop-budget.md`
3. `loop-run-log.md`
4. `STATE.md`
5. `docs/patterns/ci-sweeper.md`
6. `loop-state/ci-sweeper.md`
7. CI failure evidence

必要に応じて `docs/pattern-picker.md`, `LOOP.md`, related PR / commit / AI Work Ticket を読む。

## Hard Boundaries

- L1 では code、test、workflow、config を変更しない。
- L1 では CI rerun、workflow dispatch、deploy、external service 操作を行わない。
- secret、credential、production data を読まない。
- CI workflow / build config、deploy config、infra config を自律編集しない。
- test を green にする目的で削除、skip、disable、弱体化しない。
- PR review comment、conflict、approval、merge readiness が主問題なら `pr-babysitter` signal として扱う。
- dependency update、security alert、lockfile churn が主問題なら `dependency-sweeper` signal として扱う。

## Guard Check

次に該当する場合は実行せず、`loop-run-log.md` に blocked / no-op 理由を残す。

- `loop-pause-all` が有効。
- budget がない。
- Pattern Picker が `ci-sweeper` を active Pattern として選んでいない、または `loop-budget.md` で `ci-sweeper` の実行 budget / human approval がない。
- CI failure evidence を読めない。
- secret、credential、production data を読む必要がある。
- failure が infra、secret、permission、deploy、external service に見える。
- deny list に該当する修正しか考えられない。

## Workflow

### 1. Failure Inventory

CI failure ごとに次を確認する。

- provider
- workflow
- job
- run URL
- branch
- commit SHA
- PR number
- failed command
- failure excerpt
- first seen / repeated count
- related AI Work Ticket

### 2. Failure Classification

次のいずれかに分類する。

- `test_failure`
- `lint_or_format`
- `type_or_compile`
- `build_or_package`
- `migration_or_schema`
- `dependency_or_lockfile`
- `flaky_or_timeout`
- `env_secret_permission`
- `infra_or_runner`
- `deploy_or_release`
- `unknown`

### 3. Risk And Human Gate

次の場合は human gate または blocked にする。

- secret、credential、permission、environment variable が絡む。
- CI workflow / build config、deploy config、infrastructure config の変更が必要。
- production / staging / external service の状態変更が必要。
- DB schema、migration、seed、master data が絡む。
- daily lock、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master が絡む。
- test 削除、skip、弱体化でしか green にできない。
- failure 原因が仕様未確定で、Kiro / human decision が必要。

### 4. Next Action

次のいずれかを選ぶ。

- `monitor_only`
- `needs_human`
- `handoff_to_pr_babysitter`
- `handoff_to_dependency_sweeper`
- `handoff_to_daily_triage`
- `ready_for_local_repro`
- `ready_for_fix_proposal`
- `blocked_by_constraints`

## L1 Output

`loop-run-log.md` に次の構造で記録する。

```yaml
ci_sweeper_result:
  failures_scanned:
  failures_actionable:
  failures_blocked:
  failure_groups:
    - failure_id:
      workflow:
      job:
      branch:
      commit:
      pr:
      failure_type:
      failure_excerpt:
      suspected_cause:
      risk_level:
      human_gate_required:
      next_action:
      evidence:
  handoffs:
    pr_babysitter:
    dependency_sweeper:
    daily_triage:
    human:
  state_updates:
    watch_list:
    known_flaky:
    blocked:
```

`loop-state/ci-sweeper.md` には active failures、watch list、known flaky、blocked、handoff queue、last run summary だけを残す。ログ全文は貼らず、URL と短い excerpt に留める。

## Completion Check

- guard check の結果がある。
- failures scanned / actionable / blocked がある。
- failure ごとに `failure_type` がある。
- human gate / deny list / blocked 理由が明確である。
- next action と next owner が分かる。
- `loop-run-log.md` と `loop-state/ci-sweeper.md` に次回への引き継ぎがある。

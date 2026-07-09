# CI Sweeper Loop Pattern

## Purpose

`ci-sweeper` は、CI failure が primary signal である場合に、失敗内容を調査、分類し、安全な次 action を提案する Loop Pattern である。

この Pattern は CI failure の原因調査、再現可能性、影響範囲、human gate 要否、次 owner を扱う。PR の review comment、conflict、approval、merge readiness の継続監視は `pr-babysitter` の責務である。

現時点では scaffold 済みだが active ではない。直接起動するには、repository / CI service connector、CI log access、budget、human approval の整備が必要である。CodeCommit を使う場合は、PR / commit / branch evidence と CI evidence を別 service から読む可能性がある。

## Responsibility Boundary

| Component | Responsibility |
| --- | --- |
| Orchestrator Agent | Pattern Picker に従い、CI failure が primary signal か判断する |
| Pattern Picker | `ci-sweeper` を起動するか、`daily-triage` report-only に留めるかを判断する |
| `ci-sweeper` Pattern | CI failure の原因分類、再現要否、risk、human gate、次 action を判断する |
| `pr-babysitter` Pattern | PR review comment、conflict、approval、merge readiness を扱う |
| `dependency-sweeper` Pattern | dependency update、security alert、lockfile churn を扱う |
| Implementation Agent | L2 以上で、許可された低 risk 修正のみ実装する |
| Human | secrets、infra、workflow、deploy、権限、外部状態変更が絡む判断を行う |

## When To Run

`ci-sweeper` は次の条件を満たす場合に起動候補になる。

- CI failure が primary signal である。
- workflow、job、branch、commit、PR、failure log のいずれかを特定できる。
- PR 上の failure であっても、主目的が review 対応ではなく failure 原因調査である。
- 失敗が一時的 noise ではなく、対応候補として扱う価値がある。
- `loop-state/ci-sweeper.md` と `.codex/skills/ci-sweeper/SKILL.md` が存在する。
- CI log を読む connector または evidence link がある。

## When Not To Run

次の場合は起動しない。

- CI failure の詳細を読めない。
- failure が secrets、permission、infra、deploy、external service の問題に見える。
- CI workflow / build config、deploy config、secret、production への変更が必要である。
- PR の review comment、conflict、approval 待ちが主問題である。
- dependency update、security alert、lockfile churn が主問題である。
- 仕様未確定が原因で test が失敗している。
- budget がない、または `loop-pause-all` が有効である。

これらの場合は、`daily-triage` の report-only、`pr-babysitter`、`dependency-sweeper`、または human gate へ送る。

## Required Inputs

開始時に次を読む。

1. `loop-constraints.md`
2. `loop-budget.md`
3. `loop-run-log.md`
4. `STATE.md`
5. `docs/patterns/ci-sweeper.md`
6. `loop-state/ci-sweeper.md`
7. CI failure evidence

CI failure evidence には、可能な範囲で次を含める。

- provider: CodeBuild / CodePipeline / GitHub Actions / GitLab CI / other
- workflow name
- job name
- run URL
- branch
- commit SHA
- PR number
- failure log excerpt
- failed command
- related AI Work Ticket

## Non-Goals

`ci-sweeper` は次を行わない。

- L1 で code、test、workflow、config を変更しない。
- L1 で CI rerun、workflow dispatch、deploy、external service 操作を行わない。
- secrets、credential、production data を読まない。
- CI workflow / build config や deploy config を自律編集しない。
- test を green にする目的で削除、skip、disable、弱体化しない。
- PR review comment の全体管理や merge readiness 判定を主目的にしない。
- dependency upgrade 方針を主目的にしない。

## Autonomy Behavior

| Level | Allowed | Not allowed |
| --- | --- | --- |
| L0 | failure summary、分類、質問作成 | file 更新、CI rerun、実装 |
| L1 | CI log 読み取り、原因分類、next action 提案、`loop-run-log.md` / `STATE.md` / `loop-state/ci-sweeper.md` 更新 | code 変更、workflow 変更、CI rerun、branch 作成、PR 作成 |
| L2 | human approval 後の低 risk 再現、関連 test 実行、限定的 fix 提案、draft PR 提案 | merge、deploy、workflow / secret / infra 自律変更 |
| L3 | human gate 通過後の PR ready 判断材料提示 | 自動 merge、人間承認なしの ready 化 |

現時点では `ci-sweeper` は scaffold 済みだが active ではない。直接起動する前に budget と connector を有効化する。

## Workflow

### 1. Guard Check

次を確認する。

- `loop-pause-all` がない。
- budget がある。
- CI failure evidence を読める。
- secret、credential、production data を読む必要がない。
- CI workflow / build config、deploy config、infra config の変更が不要である。
- failure の主因が PR review / dependency / spec 未確定ではない。

guard に失敗した場合は `blocked` として記録し、安全な next step を残す。

### 2. Failure Inventory

CI failure ごとに次を記録する。

- workflow
- job
- branch
- commit
- PR
- failed command
- failure excerpt
- first seen
- repeated count
- related ticket / PR / commit

同一 failure が複数 job で出ている場合は、root cause ごとにまとめる。

### 3. Failure Classification

失敗を次のいずれかに分類する。

| failure_type | Use when |
| --- | --- |
| `test_failure` | unit / integration / system spec などの test が落ちている |
| `lint_or_format` | lint、formatter、static check が落ちている |
| `type_or_compile` | typecheck、compile、asset build が落ちている |
| `build_or_package` | bundle / npm / yarn / package build が落ちている |
| `migration_or_schema` | migration、schema、DB setup が原因に見える |
| `dependency_or_lockfile` | dependency update、lockfile、package resolution が原因に見える |
| `flaky_or_timeout` | timeout、race、network、order dependency が疑われる |
| `env_secret_permission` | env var、secret、credential、permission が疑われる |
| `infra_or_runner` | runner、cache、disk、network、CI provider 障害が疑われる |
| `deploy_or_release` | deploy、release、production / staging 操作が絡む |
| `unknown` | 判断材料が不足している |

### 4. Risk And Human Gate

次に該当する場合は human gate または blocked にする。

- secret、credential、permission、environment variable が絡む。
- CI workflow / build config、deploy config、infrastructure config の変更が必要。
- production / staging / external service の状態変更が必要。
- DB schema、migration、seed、master data が絡む。
- daily lock、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master が絡む。
- test 削除、skip、弱体化でしか green にできない。
- failure 原因が仕様未確定で、Kiro / human decision が必要。

### 5. Next Action

次のいずれかを提案する。

| next_action | Use when |
| --- | --- |
| `monitor_only` | 一時的 failure または再発待ち |
| `needs_human` | secret、permission、infra、deploy、仕様判断が必要 |
| `handoff_to_pr_babysitter` | PR review / conflict / approval が主問題 |
| `handoff_to_dependency_sweeper` | dependency / lockfile が主問題 |
| `handoff_to_daily_triage` | AI Work Ticket / spec / Kiro 判断が必要 |
| `ready_for_local_repro` | L2 以上でローカル再現や test 実行に進める |
| `ready_for_fix_proposal` | 低 risk 修正案を作れる |
| `blocked_by_constraints` | deny list または権限不足で停止 |

## L1 Output

L1 では次を `loop-run-log.md` に残す。

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

`loop-state/ci-sweeper.md` には、次回参照すべき watch list、known flaky、blocked、handoff queue だけを残す。

## State Updates

`loop-state/ci-sweeper.md` に残す情報は次に限定する。

- active failures
- watch list
- known flaky / repeated failures
- blocked failures
- handoff queue
- last run summary

詳細なログ全文を state file に貼らない。ログは evidence link と短い excerpt に留める。

## Completion Criteria

`ci-sweeper` run は次を満たした場合に完了扱いにする。

- guard check の結果がある。
- CI failure の source と件数が記録されている。
- failure ごとに `failure_type` がある。
- human gate / deny list / blocked の理由が明確である。
- next action と next owner が分かる。
- `loop-run-log.md` と `loop-state/ci-sweeper.md` に次回への引き継ぎがある。

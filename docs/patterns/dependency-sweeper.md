# Dependency Sweeper Loop Pattern

## Purpose

`dependency-sweeper` は、dependency update、security alert、lockfile churn、dependency noise が primary signal である場合に、依存関係の状態を棚卸し、分類し、安全な次 action を提案する Loop Pattern である。

この Pattern は dependency signal の整理、patch / minor / major / runtime / security の分類、noise の集約、risk、human gate 要否、次 owner を扱う。PR review、conflict、approval、merge readiness は `pr-babysitter` の責務であり、CI failure の原因調査、再現、修正判断は `ci-sweeper` の責務である。

現時点では scaffold 済みだが active ではない。直接起動するには、repository service connector、dependency evidence access、budget、human approval の整備が必要である。

## Responsibility Boundary

| Component | Responsibility |
| --- | --- |
| Orchestrator Agent | Pattern Picker に従い、dependency signal が primary signal か判断する |
| Pattern Picker | `dependency-sweeper` を起動するか、`daily-triage` report-only に留めるかを判断する |
| `dependency-sweeper` Pattern | dependency update、security alert、lockfile churn、dependency noise の分類、risk、human gate、次 action を判断する |
| `pr-babysitter` Pattern | dependency PR の review comment、conflict、approval、merge readiness を扱う |
| `ci-sweeper` Pattern | dependency 変更により落ちた CI failure の原因分類、再現要否、次 action を判断する |
| Implementation Agent | L2 以上で、human approval 後の限定的な検証や修正提案を扱う |
| Human | security 対応、major / runtime update、lockfile 更新方針、互換性判断、merge 判断を行う |

## When To Run

`dependency-sweeper` は次の条件を満たす場合に起動候補になる。

- dependency update が primary signal である。
- security alert、vulnerability advisory、dependency PR、lockfile change のいずれかがある。
- dependency noise が多く、`daily-triage` の Recent Noise や Watch List を圧迫している。
- Dependabot / Renovate 相当の PR、重複 alert、patch / minor update の大量発生、lockfile churn、重複 dependency signal のいずれかが増えている。
- patch / minor / major / runtime / transitive update の区分を判断できる evidence がある。
- `loop-state/dependency-sweeper.md` と `.codex/skills/dependency-sweeper/SKILL.md` が存在する。
- repository service、dependency alert、package file、lockfile、PR evidence のいずれかを読める。

## When Not To Run

次の場合は起動しない。

- dependency evidence を読めない。
- PR review、conflict、approval、merge readiness が主問題である。
- CI failure の原因調査、再現、修正判断が主目的である。
- merge 後の cleanup、follow-up、技術的負債の棚卸しが主問題である。
- 仕様未確定、AI Work Ticket 構造不足、scope 不明が主問題である。
- runtime、framework、major version、DB adapter、auth、payment、external integration の互換性判断が必要である。
- security 対応として人間判断が必要である。
- package file / lockfile の変更実行そのものが目的である。
- budget がない、または `loop-pause-all` が有効である。

これらの場合は、`daily-triage` の report-only、`pr-babysitter`、`ci-sweeper`、または human gate へ送る。

## Required Inputs

開始時に次を読む。

1. `loop-constraints.md`
2. `loop-budget.md`
3. `loop-run-log.md`
4. `STATE.md`
5. `docs/patterns/dependency-sweeper.md`
6. `loop-state/dependency-sweeper.md`
7. dependency evidence

dependency evidence には、可能な範囲で次を含める。

- provider: CodeCommit / repository service / Dependabot / Renovate / security scanner / other
- repository
- package manager: Bundler / npm / yarn / other
- package file
- lockfile
- dependency name
- current version
- target version
- update type: patch / minor / major / runtime / transitive / unknown
- advisory / CVE / security link
- dependency PR URL
- CI status summary
- related AI Work Ticket

## Non-Goals

`dependency-sweeper` は次を行わない。

- L1 で code、test、package file、lockfile、workflow、config を変更しない。
- L1 で `bundle update`、`npm update`、`yarn upgrade`、install、audit fix、lockfile regeneration を実行しない。
- L1 で dependency PR comment 投稿、approval、merge、close を行わない。
- L1 で branch 作成、push、PR 作成を行わない。
- CI rerun、workflow dispatch、deploy、external service 操作を行わない。
- security alert を人間承認なしに dismiss / close しない。
- runtime / framework / major update を自律判断で進めない。
- test を green にする目的で削除、skip、disable、弱体化しない。

## Autonomy Behavior

| Level | Allowed | Not allowed |
| --- | --- | --- |
| L0 | dependency summary、分類、質問作成 | file 更新、dependency command 実行、実装 |
| L1 | dependency evidence 読み取り、noise 集約、risk / human gate / next action 提案、`loop-run-log.md` / `STATE.md` / `loop-state/dependency-sweeper.md` 更新 | package / lockfile 変更、install / update command、PR 更新、branch 作成 |
| L2 | human approval 後の impact report、限定的な local test plan、更新計画、PR 作成提案 | 自律 update、security alert dismiss、merge、deploy、major / runtime update 実行 |
| L3 | human gate 通過後の merge readiness 判断材料提示 | 自動 merge、人間承認なしの dependency update 実行 |

現時点では `dependency-sweeper` は scaffold 済みだが active ではない。直接起動する前に budget、repository / dependency evidence access、human approval を有効化する。

## Workflow

### 1. Guard Check

次を確認する。

- `loop-pause-all` がない。
- budget がある。
- dependency evidence を読める。
- secret、credential、production data を読む必要がない。
- package file / lockfile / config の変更実行が不要である。
- security alert dismiss、merge、close、deploy が不要である。
- dependency signal の主因が PR review / CI failure / spec 未確定ではない。

guard に失敗した場合は `blocked` として記録し、安全な next step を残す。

### 2. Dependency Inventory

dependency item ごとに次を記録する。

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
- first seen
- repeated count
- related ticket / commit

同一 root cause の alert、PR、lockfile churn が複数ある場合は、noise group としてまとめる。

### 3. Dependency Classification

dependency signal を次のいずれかに分類する。

| dependency_type | Use when |
| --- | --- |
| `security_alert` | vulnerability advisory、CVE、security scanner alert がある |
| `patch_update` | patch version の更新である |
| `minor_update` | minor version の更新である |
| `major_update` | major version の更新である |
| `runtime_or_framework_update` | Ruby、Rails、Node、webpacker など runtime / framework が絡む |
| `lockfile_churn` | lockfile 変更量が多い、または原因が不明である |
| `transitive_resolution` | transitive dependency の解決変更が主因である |
| `duplicate_or_stale_alert` | 重複 alert、古い alert、重複 PR がある |
| `dependency_noise` | patch / minor update や alert が多く、日次棚卸しを圧迫している |
| `blocked_by_ci` | dependency 変更が CI failure を引き起こしている |
| `blocked_by_pr_state` | review、conflict、approval、merge readiness が blocker である |
| `unknown` | 判断材料が不足している |

### 4. Risk And Human Gate

次に該当する場合は human gate または blocked にする。

- security alert、CVE、vulnerability advisory が絡む。
- major update、runtime / framework update、DB adapter、auth、payment、external integration が絡む。
- Gemfile、Gemfile.lock、package.json、yarn.lock、webpack config、Sprockets require chain の変更が必要。
- production / staging / external service の状態変更が必要。
- daily lock、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master が絡む。
- CI workflow / build config、deploy config、infrastructure config の変更が必要。
- test 削除、skip、弱体化でしか green にできない。
- dependency update 方針が仕様や運用判断に依存している。

### 5. Next Action

次のいずれかを提案する。

| next_action | Use when |
| --- | --- |
| `monitor_only` | 一時的、低 risk、または再発待ち |
| `needs_human` | security、major、runtime、互換性、運用判断が必要 |
| `handoff_to_pr_babysitter` | PR review / conflict / approval が主 blocker |
| `handoff_to_ci_sweeper` | CI failure が主 blocker |
| `handoff_to_daily_triage` | AI Work Ticket / spec / Kiro 判断が必要 |
| `ready_for_noise_grouping` | dependency noise をまとめて人間へ提示できる |
| `ready_for_impact_report` | L2 以上で影響範囲調査に進める |
| `ready_for_update_plan` | L2 以上で更新計画を作れる |
| `blocked_by_constraints` | deny list または権限不足で停止 |

## L1 Output

L1 では次を `loop-run-log.md` に残す。

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

`loop-state/dependency-sweeper.md` には、次回参照すべき active dependency items、watch list、noise groups、blocked、handoff queue だけを残す。

## State Updates

`loop-state/dependency-sweeper.md` に残す情報は次に限定する。

- active dependency items
- watch list
- noise groups
- security / major / runtime watch
- blocked dependency items
- handoff queue
- last run summary

advisory や PR の本文全文を state file に貼らない。URL と短い excerpt に留める。

## Completion Criteria

`dependency-sweeper` run は次を満たした場合に完了扱いにする。

- guard check の結果がある。
- dependency evidence の source と件数が記録されている。
- dependency item ごとに `dependency_type` がある。
- noise group がある場合は group 化の理由がある。
- human gate / deny list / blocked の理由が明確である。
- next action と next owner が分かる。
- `loop-run-log.md` と `loop-state/dependency-sweeper.md` に次回への引き継ぎがある。

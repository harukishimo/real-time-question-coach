# CodeCommit PR Contract

このドキュメントは、Realtime Question Coach Loop Engineering における CodeCommit PR 作成と reviewer comment 投稿の契約を定義する。

CodeCommit PR 作成 command の実行主体は `codecommit_pr_agent` である。CodeCommit reviewer comment command の実行主体は `codecommit_comment_agent` である。implementer / verifier は AWS command を実行せず、PR package、comment draft、evidence、handoff を作る。

GitHub Issue / PR は Realtime Question Coach Loop の正本ではない。AI Work Ticket spreadsheet が正本であり、CodeCommit PR は実装結果の review / merge 判断に使う repository service 上の evidence として扱う。

## Authority

| Action | Minimum level | Required approval |
|--------|---------------|-------------------|
| PR package 作成 | L2 | L2 Activation Record |
| CodeCommit PR 作成 command 実行 | L3 | `codecommit_pr_creation_allowed: true` |
| CodeCommit reviewer comment 投稿 command 実行 | L3 | `codecommit_reviewer_comment_allowed: true` |
| PR approve / merge / close / ready 化 | Human | 明示的な人間承認 |

L2 は PR title、description、source branch、destination branch、AWS command payload の draft を作れるが、AWS command は実行しない。

## Required Inputs

CodeCommit PR 作成前に次が必要である。

```yaml
codecommit_pr_request:
  ticket_id:
  repository_name:
  region:
  aws_profile_name:
  source_branch:
  destination_branch:
  base_branch:
  title:
  description:
  draft_equivalent: true
  activation_record:
    approved_level: L3
    approved_by:
    approved_at:
    approval_scope:
    codecommit_pr_creation_allowed: true
    codecommit_reviewer_comment_allowed: true | false
```

`base_branch` と `destination_branch` は通常同じ branch を指す。異なる場合は理由を `loop-run-log.md` に残す。

## Repository Name And Region

repository name と region は Activation Record に明記する。

```yaml
codecommit:
  repository_name: {{CODECOMMIT_REPOSITORY_NAME}}
  region: ap-northeast-1
  destination_branch: main
  aws_profile_name:
```

repository name、region、destination branch が不明な場合は PR 作成 command を実行しない。

## AWS Profile And Credential Handling

AWS credential は secret として扱う。

- AWS access key、secret access key、session token、credential file を読まない、表示しない、編集しない。
- `aws configure`、credential 更新、profile 作成、role 設定変更を自律実行しない。
- `aws_profile_name` は secret ではないが、使用してよい profile 名として人間が明示した場合だけ使う。
- command output に credential、署名、token、個人情報、production data が含まれる場合は記録しない。
- profile が不明、または credential error が出た場合は、人間に戻す。

Command では `--region` を明示する。`--profile` は Activation Record に `aws_profile_name` がある場合だけ使う。

## Branch Naming

source branch は Activation Record の `branch_name` と一致させる。

Default:

```text
codex/{ticket_id}-{short-slug}
```

Rules:

- `ticket_id` を含める。
- base branch / destination branch は Activation Record と一致させる。
- 既存 branch を使う場合は、その branch が対象 ticket の作業 branch であることを確認する。
- shared branch、production branch、release branch へ直接 commit / push しない。

## PR Title Template

CodeCommit に GitHub の draft PR 相当がない場合、title に `[DRAFT]` prefix を付ける。

```text
[DRAFT] {ticket_id}: {short_title}
```

人間が ready 化を承認するまで `[DRAFT]` を外さない。

## PR Description Template

PR description には `Status: Draft` と merge 禁止を明記する。

```markdown
Status: Draft
Do not merge without explicit human approval.

AI Work Ticket: {ticket_id}

## Summary
- {変更概要}

## Scope
- In: {scope_in}
- Out: {scope_out}

## Verification
- {実行した test / check}
- {実行できなかった check と理由}

## Human Gate
- Required: true | false
- Status: not_required | approved | pending
- Reason: {reason}

## Verifier
- Result: APPROVE | REJECT | ESCALATE_HUMAN
- Evidence: {summary}

## Risk
- {known risk / residual risk}

## Notes
- Merge is not automated.
- Ready-for-review, approve, merge, and close require explicit human approval.
```

## Human Approval Before PR Command

`aws codecommit create-pull-request` 相当の command を実行する前に、次のいずれかで人間承認が必要である。

- Activation Record に `approved_level: L3` と `codecommit_pr_creation_allowed: true` があり、`approved_by`, `approved_at`, `approval_scope` が明記されている。
- 最新の人間指示で、対象 ticket、branch、repository、destination branch、PR 作成 command の実行が明示承認されている。

承認が曖昧な場合は、PR package だけ作成し、Spreadsheet を `pending` または `human_gate_pending` にする。

## Create Pull Request Command

許可される command は CodeCommit PR 作成に限定する。

```text
aws codecommit create-pull-request
```

実行前に command payload を `loop-run-log.md` に記録する。ただし credential、secret、長い log は記録しない。

Required payload:

```yaml
create_pull_request_payload:
  repository_name:
  region:
  source_reference:
  destination_reference:
  title:
  description:
```

禁止:

- merge、approve、close、PR status 変更。
- approval rule、branch protection、repository setting 変更。
- deploy、pipeline、build、release、production に影響する AWS command。
- secret / credential を表示する command。

## Draft-Equivalent Policy

CodeCommit に draft PR 相当がない場合、初期 PR は draft-equivalent として扱う。

必須:

- title に `[DRAFT]` を付ける。
- description の先頭に `Status: Draft` を書く。
- description に `Do not merge without explicit human approval.` を書く。
- Spreadsheet の `ai_comment_summary` または `triage_notes` に、PR は draft-equivalent であると残す。

`[DRAFT]` を外す、ready 化する、approve する、merge する、close する操作は human approval 後のみ。

## Reviewer Comment Contract

L3 で `codecommit_reviewer_comment_allowed: true` がある場合だけ reviewer comment command を実行できる。

許可される command:

```text
aws codecommit post-comment-for-pull-request
aws codecommit post-comment-reply
```

`post-comment-reply` は、既存 comment への返信が Activation Record または人間指示で明示されている場合だけ使う。

Reviewer comment は次に限定する。

- verifier verdict。
- scope check 結果。
- test result。
- human gate または residual risk。
- required next action。

Reviewer comment で行ってはいけないこと:

- approve、merge、close、resolve、ready 化を示す。
- secret、credential、production data、個人情報、長い log 全文を貼る。
- AI Work Ticket の scope 外作業を依頼する。

## Reviewer Comment Template

```markdown
AI Reviewer Comment

Ticket: {ticket_id}
Verifier verdict: APPROVE | REJECT | ESCALATE_HUMAN

Scope:
- {scope result}

Checks:
- {test result}

Human gate / risk:
- {gate or risk note}

Required next action:
- {next action}
```

## Spreadsheet Updates

CodeCommit PR 作成後、許可された範囲で次を更新する。

- `status`
- `next_owner`
- `verification_result`
- `verification_evidence`
- `verifier_verdict`
- `verifier_notes`
- `ai_comment_type`
- `ai_comment_summary`
- `decision_needed`
- `triage_notes`
- `last_loop_run_id`
- `pr_id`
- `pr_url`
- `merge_approval_status`
- `done_criteria_met`
- `done_evidence`

PR URL / PR ID は `verification_evidence`, `done_evidence`, `triage_notes`, または AI comment に記録する。AI Work Ticket の source fields、scope fields、risk fields、acceptance criteria は更新しない。

## Run Log

`loop-run-log.md` には次を残す。

```yaml
codecommit_pr:
  repository_name:
  region:
  source_branch:
  destination_branch:
  title:
  draft_equivalent: true
  command_executed: true | false
  result:
  pr_id:
  pr_url:
reviewer_comment:
  command_executed: true | false
  command_type:
  comment_id:
  result:
  draft_if_not_executed:
```

## Abort Conditions

次に該当する場合は command を実行しない。

- L3 Activation Record がない。
- `codecommit_pr_creation_allowed: true` がない。
- repository name、region、source branch、destination branch が不明。
- AWS profile / credential 扱いが不明。
- verifier が `APPROVE` していない。
- human gate が `pending` または `needs_human_management`。
- PR title / description に draft-equivalent 表示がない。
- command が PR 作成または reviewer comment 投稿以外の AWS 操作を含む。
- merge、deploy、release、production、secret、permission、repository setting に影響する。

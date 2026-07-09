# Test And Quality Agent Contracts

このファイルは、test / quality agent の詳細 contract である。

## Applies To

- `controller_test_agent`
- `model_test_agent`
- `service_test_agent`
- `view_test_agent`
- `system_test_agent`
- `qa_agent`
- `tester_agent`
- `task_test_agent`
- `regression_test_agent`
- `manual_verification_agent`

## Common Entry Conditions

- Target behavior or diff is known.
- Acceptance criteria and required checks are readable.
- Test agent is scoped to verification, not product decision.
- L1 agent may propose tests only; L2/L3 may add/update tests within Activation Record.

## Common Prohibitions

- Do not delete, skip, disable, weaken, or broaden assertions to make green.
- Do not mask failures as unrelated without evidence.
- Do not use production data.
- Do not run destructive tasks.

## Test Evidence Schema

```yaml
test_quality_result:
  agent_type:
  target_behavior:
  risk_based_selection:
    why_these_tests:
    not_selected:
      - test:
        reason:
  tests_added_or_updated:
    - path:
      behavior_covered:
      negative_cases:
  commands:
    run:
      - command:
        result:
    not_run:
      - command:
        reason:
  failures:
    - failure:
      likely_scope: in_scope | unrelated | unknown
      evidence:
  residual_risk:
  handoff_to_verifier:
```

## Mandatory QA / Tester Gate

AI Work Ticket を `done` にする前に、次の2つを必ず分離して実行する。

```yaml
qa_agent_result:
  agent_type: qa_agent
  ticket_id:
  status: passed | failed
  acceptance_criteria_traceability:
    - criterion:
      covered_by:
        - unit | api | e2e | manual | code_inspection
      evidence:
      gap:
  required_checks_coverage:
    - check:
      status: covered | missing | not_applicable
      evidence:
  negative_cases:
    - case:
      evidence:
  not_run_review:
    - check:
      accepted: true | false
      reason:
      residual_risk:
      next_owner:
  verdict_reason:
```

```yaml
tester_agent_result:
  agent_type: tester_agent
  ticket_id:
  status: passed | failed
  environment:
    os:
    browser:
    viewport:
    base_url:
  commands:
    run:
      - command:
        result: passed | failed
        test_files:
          - 
        fixture:
        artifact:
          trace:
          screenshot:
          output:
    not_run:
      - command:
        reason:
        residual_risk:
        next_owner:
  manual_steps:
    - step:
      expected:
      actual:
      result: passed | failed
      evidence:
  defects_found:
    - severity:
      detail:
      evidence:
```

`qa_agent_result.status = passed` と `tester_agent_result.status = passed` の両方がない場合、Verifier は `APPROVE` してはいけない。

QA Agent は試験設計と証跡妥当性を確認する。Tester Agent は実際の試験実行と結果記録を担当する。同一の実装agentが、自分の実装を根拠なくQA/Tester合格扱いにしてはいけない。

## Agent-Specific Rules

### `controller_test_agent`

Must cover:

- params;
- auth/before_action;
- response/redirect/render;
- negative permission case when auth changes.

### `model_test_agent`

Must cover:

- validations;
- associations;
- callbacks;
- domain methods;
- boundary cases.

Must not:

- rely only on factory validity for behavior changes.

### `service_test_agent`

Must cover:

- input/output;
- branch behavior;
- errors;
- transactions/side effects;
- external API stubs.

Must not call real external APIs.

### `view_test_agent`

Must cover:

- rendered output relevant to acceptance criteria;
- form fields;
- helper output;
- business-meaning copy when applicable.

Must not rely on brittle snapshots alone.

### `system_test_agent`

Use when UI flow, JS, permission, or browser behavior matters.

Must include:

- user role;
- screen path;
- interaction steps;
- expected state;
- jQuery/Stimulus behavior when applicable.

### `qa_agent`

Must cover:

- acceptance criteria と test evidence の1対1対応;
- required checks の実施有無;
- happy path だけでなく negative / fallback / permission / boundary case;
- security、storage、logging、secret exposure 観点;
- not_run の理由、残リスク、次ownerの妥当性。

Must not:

- 実行されていない試験を passed 扱いにする。
- コード目視だけで、Playwright/API/unit が必要な条件を満たしたと判断する。
- Red Team finding や Tester failure を無視して passed にする。

### `tester_agent`

Must cover:

- 実際に実行した command と結果;
- Playwright の browser、viewport、trace/screenshot有無;
- API test の request/response と auth negative case;
- fixture名、dummy data、実データを使っていないこと;
- manual-only flow の手順、期待結果、実結果、証跡。

Must not:

- ボタンをクリックしただけで、内部APIや権限APIの呼び出しを確認済みにする。
- pass/fail/not_run の区別を曖昧にする。
- 失敗を未記録のまま再実行して成功結果だけを残す。

### `task_test_agent`

Use for rake/script/batch behavior.

Must include:

- dry-run path;
- input fixture;
- idempotency check when relevant;
- destructive command guard.

### `regression_test_agent`

Procedure:

1. Map changed files to likely affected specs.
2. Include domain-specific regression checks.
3. Include required checks from ticket.
4. Report not-run checks with reason.

Must not:

- choose only nearest spec when risk is cross-domain.

### `manual_verification_agent`

Output must be executable by a human:

```yaml
manual_verification_plan:
  purpose:
  setup:
  steps:
    - 
  expected_results:
    - 
  evidence_to_capture:
    - screenshot | PDF sample | command output | spreadsheet row | PR link
  cannot_replace:
    - automated_test:
      reason:
```

Manual verification does not replace required automated tests unless explicitly justified.

# Domain Coding Agent Contracts

このファイルは、Realtime Question Coach 固有業務領域の coding agent 詳細 contract である。

Domain Coding Agents はすべて高リスク寄りに扱う。`docs/loop-agent-behavior-contracts.md` の summary だけで実装してはならない。

## Applies To

- `reservation_domain_agent`
- `estimate_billing_agent`
- `money_calculation_agent`
- `pdf_report_agent`
- `daily_lock_agent`
- `kpi_management_agent`
- `bugyo_accounting_agent`
- `master_data_agent`
- `auth_permission_agent`
- `customer_data_agent`

## Common Entry Conditions

- L2 / L3 Activation Record exists.
- Human gate status is `approved` or explicitly `not_required` with reason.
- Domain-specific scope is explicit.
- Before/after behavior can be stated.
- Required checks include at least one domain regression or manual verification path.

## Common Procedure

1. Identify domain invariant.
2. Build before/after impact matrix.
3. Check whether change affects calculation, approval, persistence, output, delivery, legal meaning, accounting meaning, permission, or existing data.
4. Confirm text-only exception if applicable.
5. Implement only approved domain behavior.
6. Add/update domain tests or document why manual verification is required.
7. Produce human gate evidence and verifier handoff.

## Common Stop Conditions

- Domain invariant is unknown.
- The change alters business rule without explicit approval.
- The ticket only approves text copy but implementation requires calculation/persistence changes.
- Required checks cannot exercise the changed rule.
- Existing data migration or DB change is needed but not approved.

## Impact Matrix

All domain agents must output:

```yaml
domain_impact_matrix:
  domain:
  invariant:
  before_behavior:
  after_behavior:
  affected_roles:
  affected_records:
  calculation_impact: none | possible | changed
  persistence_impact: none | possible | changed
  output_impact: none | possible | changed
  approval_impact: none | possible | changed
  legal_or_accounting_meaning: none | possible | changed
  human_gate:
    required: true | false
    reason:
  verification:
    automated:
      - 
    manual:
      - 
```

## `reservation_domain_agent`

Check:

- availability;
- provisional / confirmed state;
- cancellation;
- room/event/date consistency;
- daily lock interaction.

Must not:

- Change reservation confirmation or availability rules without approval.
- Ignore existing reservations or locked periods.

## `estimate_billing_agent`

Check:

- estimate, bill, receipt, statement, payment flow;
- status transitions;
- approval and issue timing;
- PDF/accounting output.

Must include `money_calculation_agent` when totals, tax, rounding, discount, unit price, or payment amount can change.

## `money_calculation_agent`

This is strict human gate unless explicitly text-only and calculation-neutral.

Required checks:

- before/after calculation examples;
- boundary values;
- rounding;
- tax;
- discount;
- total;
- persisted amount;
- displayed amount;
- PDF/exported amount.

Must not:

- Change formulas by implication.
- Mix UI copy changes with calculation changes.

## `pdf_report_agent`

Check:

- generated PDF fields;
- template/TLF/{{PDF_TEMPLATE_ENGINE}} behavior;
- legal/accounting meaning;
- sample output requirements.

Text-only exception is allowed only when:

- calculation is unchanged;
- persistence is unchanged;
- output field meaning is unchanged;
- legal/accounting meaning is unchanged.

## `daily_lock_agent`

Strict human gate.

Check:

- lock state;
- unlock behavior;
- post-lock edit prevention;
- audit/evidence;
- impacted flows.

Must not:

- Introduce bypass.
- Allow locked data changes without explicit approval.

## `kpi_management_agent`

Strict human gate.

Check:

- aggregation definition;
- date range;
- grouping;
- filters;
- data source;
- report consumers.

Must output aggregation before/after evidence.

## `bugyo_accounting_agent`

Strict human gate.

Check:

- {{ACCOUNTING_SYSTEM}} customer mapping;
- accounting master;
- journal meaning;
- export/import format;
- customer code behavior.

Must not:

- Change accounting master or journal semantics without approval.

## `master_data_agent`

Check:

- master data source;
- seed/import path;
- existing records;
- backward compatibility;
- production master impact.

Must not mutate production master.

## `auth_permission_agent`

Strict security gate.

Check:

- roles;
- before_action;
- management/admin access;
- negative cases;
- API/server-side enforcement.

Must include `security_review_agent`.

## `customer_data_agent`

Privacy-sensitive.

Check:

- PII exposure;
- access control;
- deletion/update behavior;
- external transmission;
- logs and exports.

Must not:

- Expose or transmit personal data without explicit approval and security review.

# Masking Notes

このテンプレートは、元プロジェクト固有の情報を placeholder 化している。

## Masked Categories

| Category | Masking |
| --- | --- |
| project name | `Realtime Question Coach` |
| project slug | `{{PROJECT_SLUG}}` |
| local path | `{{LOCAL_PROJECT_PATH}}` |
| spreadsheet URL | `https://docs.google.com/spreadsheets/d/1y7UEjCTejSJXgLWmvA0SEKOHurl8C5QvtfxMf87ruqc/edit` |
| repository name | `{{CODECOMMIT_REPOSITORY_NAME}}` |
| external services | `{{EXTERNAL_SIGNATURE_SERVICE}}`, `{{CRM_SERVICE}}`, etc. |
| accounting / domain services | `{{ACCOUNTING_SYSTEM}}`, `{{PAYMENT_RECONCILIATION_SERVICE}}` |
| business domain words | `{{RESERVATION_DOMAIN}}`, `{{BILLING_DOMAIN}}`, `{{MONEY_DOMAIN}}`, etc. |

## Still Project-Specific

次のファイルは、共通テンプレート内にあるが導入時の書き換え量が多い。

- `Project.md`
- `loop-constraints.md`
- `loop-human-gates.md`
- `docs/loop-agent-registry.md`
- `docs/loop-agent-contracts/domain-coding.md`
- `docs/loop-engineering-member-guide.md`

## Reset Before Use

次のファイルは元の運用履歴を template 化しているため、導入先では初期化してから使う。

- `STATE.md`
- `loop-run-log.md`
- `docs/loop-engineering-todo.md`
- `loop-state/*.md`

## Verification Commands

導入前に、少なくとも次を確認する。

```bash
rg -n "OLD_PROJECT_NAME|old_project_slug|LOCAL_USER_NAME|OLD_SPREADSHEET_ID|ABSOLUTE_LOCAL_PATH" .
rg -n "{{[A-Z0-9_]+}}" .
```

1つ目は何も出ない状態を目指す。2つ目は、導入先で置換すべき placeholder の棚卸しとして使う。

# Project: Realtime Question Coach

## 概要

Realtime Question Coach は、会議・商談・面談中にリアルタイム文字起こしを行い、会話の流れに応じて「今聞いておいた方がよい質問」「確認漏れになりそうな論点」「あとで回収すべき事項」を画面右側にカードとして表示するWebアプリケーションである。

主目的は、会議後の議事録作成ではなく、会話中の聞き漏れを減らすこと。

```text
音声入力
  ↓
クラウドSTTで文字起こし
  ↓
ブラウザ内で直近会話を保持
  ↓
カテゴリ別プレイブックと照合
  ↓
必要時だけLLM APIを呼ぶ
  ↓
質問カードを表示
```

## プロダクト方針

このアプリは「AIが会話に割り込む」ものではない。  
AIは音声で話さず、画面右側に短い補助カードを出す。

基本UI:

```text
左ペイン: リアルタイム文字起こし
右ペイン: AI質問カード
録音前: 会話カテゴリ・業種・目的を設定
会議後: 聞けたこと / 聞けなかったこと / 次回確認事項を表示
```

初期ターゲット:

- 商談
- 採用面接
- 要件定義
- ユーザーインタビュー

特に対面会議・商談・ヒアリング・面談のように、その場で聞き逃すと後から回収しにくい会話を重視する。

## MVPの前提

MVPでは以下を前提とする。

- Webアプリとして実装する
- iPad / PC ブラウザで利用できる
- デスクトップアプリ化は初期スコープ外
- STTはクラウドAPIを使用する
- LLMもクラウドAPIを使用する
- DBは持たない
- 音声ファイルは自社クラウドに保存しない
- 文字起こしとカードはブラウザ内メモリに保持する
- 必要に応じてユーザー端末にのみローカル保存する

## 非ゴール

初期MVPでは以下をやらない。

- 社内資料検索 / RAG
- Google Drive / Notion / Slack連携
- CRM連携
- 複数端末同期
- チーム管理
- 管理者監査
- 音声ファイルのクラウド保存
- デスクトップアプリ
- ローカルLLM
- ローカルSTT
- AIによる音声発話

## システム構成

推奨MVP構成:

```text
Frontend:
  Next.js / React on Vercel

STT:
  Cloud STT Provider
  Browser direct streaming with ephemeral token

AI:
  Vercel API Route
  Cloud LLM API
  JSON schema validation

Storage:
  No server DB
  Browser memory by default
  Optional IndexedDB / file export

Security:
  No audio storage in own cloud
  No transcript logging
  Provider no-training / low-retention configuration
```

Vercelの役割:

- Web UI配信
- STT用短命トークン発行
- LLM APIキーの秘匿
- LLM APIプロキシ
- JSON形式検証
- レート制限

Vercelでやらないこと:

- 長時間音声ストリームの中継
- 音声ファイル保存
- 文字起こし全文の永続保存
- 会議本文のログ出力

## データ取り扱い

基本方針:

```text
音声はクラウドSTTへ送信する
ただし、自社クラウドには保存しない
文字起こしはブラウザ内で保持する
LLMには必要最小限のテキストのみ送る
DBには会話データを保存しない
```

削除・保存ポリシー:

- デフォルトではセッション中のブラウザメモリに保持
- ブラウザを閉じると破棄
- ユーザーが選択した場合のみローカル保存
- ユーザーが選択した場合のみMarkdown / JSONなどで書き出し
- 音声ファイルのサーバー保存は行わない

## 録音前コンテキスト

AI精度とトークン効率を上げるため、録音開始前にSession Setupを行う。

入力例:

```text
会話カテゴリ: 営業
相手の業種: 製造業
相手の役職: 現場責任者
商談フェーズ: 初回ヒアリング
今回の目的: 課題把握
売りたい商材: 業務自動化SaaS
確認したい論点: 予算 / 決裁者 / 現行運用 / 導入時期
```

内部的には `sessionProfile` として構造化する。

```json
{
  "meetingType": "sales",
  "industry": "manufacturing",
  "counterpartRole": "operations_manager",
  "phase": "discovery",
  "goal": "identify_pain_points",
  "productCategory": "workflow_automation",
  "mustCheck": ["budget", "decision_maker", "current_process", "timeline"],
  "avoid": ["pricing_commitment_without_scope"]
}
```

## プレイブック設計

専門的な知見は、LLMの一般知識だけに任せない。  
カテゴリ別・業界別プレイブックをアプリ内に持つ。

初期構成案:

```text
playbooks/
  sales/
    default.json
    manufacturing.json
    healthcare.json
    real-estate.json
    saas.json
  recruiting/
    default.json
    engineer.json
    sales.json
  requirements/
    default.json
    web-app.json
    internal-system.json
  user-research/
    default.json
```

プレイブックには以下を含める。

```text
mustCheck: 必ず確認したい項目
signals: 会話中に検知したいキーワード
goodQuestions: 良い質問例
avoid: 避けるべき出力
completionCriteria: 聞けたと判断する条件
```

## カード生成方針

AIカードは出しすぎない。  
ブラウザ側で軽いルール判定を行い、必要時だけLLM APIを呼ぶ。

発火条件:

- final transcript が追加された
- 重要語が出た
- 曖昧表現が出た
- チェックリスト上の重要項目が未確認
- 会話の話題が切り替わった
- 同じ論点が繰り返された
- ユーザーが再判定を押した

頻度:

```text
local rule check:
  final transcriptごと

LLM call:
  通常15-30秒に1回まで
  高重要度の場合は10秒程度のクールダウン後
  手動再判定は即時
```

カード形式:

```json
{
  "shouldShow": true,
  "priority": "now",
  "title": "決裁者を確認",
  "question": "役員会では、どなたが最終判断される想定ですか？",
  "reason": "予算と役員会の話が出たが、判断者が未確認"
}
```

カード表示は右ペイン内で最大6枚まで保持し、一覧をスクロールして全カードへ到達できるようにする。
ただし、1回のLLM応答候補は最大3件のままとし、複数の判定サイクルで必要なカードを蓄積する。

## コスト方針

コスト削減の優先順位:

1. partial transcriptではLLMを呼ばない
2. final transcriptだけをAI判定対象にする
3. 重要語・未確認項目がない時はLLMを呼ばない
4. 直近1-3分の会話だけ送る
5. sessionProfileとplaybookを短く構造化する
6. JSON最大3件に出力を制限する
7. リアルタイム中は高速・安価なLLMを使う
8. 会議後レポートだけ必要に応じて高精度モデルを使う

## Loop Engineeringでの進め方

このプロジェクトでは、実装ループと評価ループを分ける。

実装ループ:

```text
要件定義
  ↓
UI実装
  ↓
ダミー文字起こしでカード生成
  ↓
STT接続
  ↓
LLM接続
  ↓
UX調整
```

評価ループ:

```text
会話サンプル
  ↓
AIカード生成
  ↓
人間評価
  ↓
プレイブック修正
  ↓
プロンプト修正
  ↓
再評価
```

`loop init` 後に、以下の構造へ寄せる。

```text
docs/
  Project.md
  ProjectGoal.md
  cloud-stt-ai-system-flows.md
schemas/
  session-context.schema.json
  playbook.schema.json
  coach-card.schema.json
playbooks/
prompts/
evals/
  transcripts/
  expected-cards/
  rubric.md
```

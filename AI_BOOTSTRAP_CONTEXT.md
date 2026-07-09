# AI Bootstrap Context: Realtime Question Coach

## 目的

このドキュメントは、AIエージェントがプロジェクト起動時に短時間で背景・設計方針・制約・次の作業を理解するためのコンテキストである。

## プロジェクト名

Realtime Question Coach

仮称。会議・商談・面談中に、リアルタイム文字起こしとAI質問カードで聞き漏れを減らすWebアプリケーション。

## 中核コンセプト

このアプリは議事録作成アプリではない。  
会議後に要約するのではなく、会話中に「今聞いておくべきこと」を提示する。

```text
左ペイン:
  リアルタイム文字起こし

右ペイン:
  AIによる質問候補・確認事項カード
```

AIは音声で割り込まない。右側のカードで静かに補助する。

## 想定ユースケース

初期ターゲット:

- 営業商談
- 採用面接
- 要件定義
- ユーザーインタビュー

特に、対面会議・オンライン会議の両方で、後から聞き直しにくい場面を想定する。

## 現時点の技術方針

MVPでは以下を採用する。

```text
Frontend:
  Next.js / React

Hosting:
  Vercel

STT:
  Cloud STT API

AI:
  Cloud LLM API

Database:
  なし

Storage:
  ブラウザ内メモリ中心
  任意でローカル保存 / エクスポート
```

DBなしの理由:

- 会話データをサーバーに残さない価値訴求ができる
- MVPを軽く作れる
- 音声・文字起こし・AIカードの保存ポリシーを単純化できる

## データポリシー

基本方針:

```text
音声はクラウドSTTへ送信する
ただし、自社クラウドには音声ファイルを保存しない
文字起こしはブラウザ内で保持する
LLMには必要最小限のテキストだけ送る
DBには会話データを保存しない
```

注意:

- クラウドSTTへ送るため、音声は外部プロバイダに送信される
- 「保存しない」と「送信しない」は別
- STT/LLMプロバイダのno-training / retention設定を確認する必要がある
- Vercelログに本文・音声・LLM応答を出力しない

## 録音前セットアップ

AI精度とトークン効率を上げるため、録音開始前に会話カテゴリと文脈を入力させる。

例:

```text
会話カテゴリ: 営業
相手の業種: 製造業
相手の役職: 現場責任者
商談フェーズ: 初回ヒアリング
今回の目的: 課題把握
売りたい商材: 業務自動化SaaS
確認したい論点: 予算 / 決裁者 / 現行運用 / 導入時期
```

内部的には `sessionProfile` として扱う。

```json
{
  "meetingType": "sales",
  "industry": "manufacturing",
  "counterpartRole": "operations_manager",
  "phase": "discovery",
  "goal": "identify_pain_points",
  "productCategory": "workflow_automation",
  "mustCheck": ["budget", "decision_maker", "current_process", "timeline"]
}
```

## 専門知識の補充方針

カテゴリを指定するだけでは専門知識は安定しない。  
初期MVPでは、RAGではなくカテゴリ別・業界別プレイブックをアプリ内に持つ。

例:

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
  requirements/
    default.json
  user-research/
    default.json
```

プレイブックに含める要素:

- mustCheck: 必須確認項目
- signals: 会話中に検知するキーワード
- goodQuestions: 良い質問例
- avoid: 避けるべき出力
- completionCriteria: 聞けたと判断する条件

## AIカード生成方針

LLMを常時呼ばない。  
ブラウザ側でローカルルールを使い、必要時だけLLM APIを呼ぶ。

発火条件:

- final transcript が追加された
- 重要語が出た
- 曖昧表現が出た
- チェックリスト上の重要項目が未確認
- 会話の話題が切り替わった
- 同じ論点が繰り返された
- ユーザーが再判定ボタンを押した

頻度:

```text
local rule check:
  final transcriptごと

LLM call:
  通常15-30秒に1回まで
  高重要度の場合は10秒程度のクールダウン後
  手動再判定は即時
```

カードJSON:

```json
{
  "shouldShow": true,
  "priority": "now",
  "title": "決裁者を確認",
  "question": "役員会では、どなたが最終判断される想定ですか？",
  "reason": "予算と役員会の話が出たが、判断者が未確認"
}
```

## コスト削減方針

- partial transcriptではLLMを呼ばない
- final transcriptだけをAI判定対象にする
- 重要語・未確認項目がない時はLLMを呼ばない
- 直近1-3分の会話だけ送る
- sessionProfileとplaybookを短く構造化する
- 出力をJSON最大3件に制限する
- リアルタイム中は高速・安価なLLMを使う
- 会議後レポートだけ必要に応じて高精度モデルを使う

## Loop Engineering採用方針

このプロジェクトではLoop Engineeringを採用する。

目的:

- 実装タスクを状態ファイルで追跡する
- AIエージェントが起動時に文脈を理解できるようにする
- プレイブック・プロンプト・評価データを継続改善する
- 実装ループと評価ループを分離する

想定するループ:

```text
Implementation Loop:
  UI → Session Setup → Dummy Transcript → STT → LLM Cards → Export

Evaluation Loop:
  transcript sample → card generation → human review → playbook/prompt update → rerun
```

テンプレート:

```text
~/vitalize/loop-engineering-template
```

ユーザーは `loop init` のスキャフォールディングを想定している。

## 既存成果物

この会話で作成済み:

- `Project.md`
- `ProjectGoal.md`
- `realtime-question-coach-mock.html`
- `realtime-question-coach-system-flows.md`
- `cloud-stt-ai-system-flows.md`

## 次にやるべきこと

1. Loop Engineeringテンプレートをプロジェクトディレクトリへコピーする
2. `Project.md` と `ProjectGoal.md` を配置する
3. この `AI_BOOTSTRAP_CONTEXT.md` を配置する
4. Next.js / Reactプロジェクトを作成する
5. 既存HTMLモックをReact化する
6. Session Setup画面を実装する
7. sessionProfile schemaを作成する
8. playbook schemaを作成する
9. 初期プレイブックを作成する
10. ダミー文字起こしでカード生成を実装する

## 最重要判断

最初にSTT接続から始めない。  
まずは以下を実装する。

```text
Session Setup
  ↓
sessionProfile
  ↓
playbook selection
  ↓
dummy transcript
  ↓
AI card generation
```

ここが固まると、STTを後から接続してもプロダクトの芯がぶれない。


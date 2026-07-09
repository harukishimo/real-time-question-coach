# Project Goal: Realtime Question Coach

## 最終ゴール

会議・商談・面談中に、利用者が聞き漏らしそうな重要論点をリアルタイムに検知し、短い質問カードとして提示するWebアプリケーションを開発する。

このプロダクトの価値は、会議後の要約ではなく、会話中の意思決定品質を上げることにある。

```text
Before:
  会議後に「あれを聞いておけばよかった」と気づく

After:
  会話中に「今それを確認した方がよい」と気づける
```

## 成功条件

MVPの成功条件:

1. ブラウザで録音を開始できる
2. リアルタイム文字起こしが左ペインに表示される
3. 録音前に会話カテゴリと業界文脈を設定できる
4. カテゴリ別プレイブックに基づいて質問カードが出る
5. カードは出しすぎず、最大3件程度に制御される
6. ユーザーが `聞いた` / `あとで` / `不要` を操作できる
7. 音声ファイルを自社クラウドに保存しない
8. DBなしでセッションを完結できる
9. 会議後に聞けたこと・聞けなかったことを確認できる

## プロダクト指標

初期評価で見るべき指標:

```text
有用カード率:
  表示されたカードのうち、実際に聞く価値があった割合

邪魔カード率:
  表示されない方がよかったカードの割合

聞き漏れ削減率:
  会議後に「聞けばよかった」と感じた項目がどれだけ減ったか

初回カード表示速度:
  重要論点が出てからカードが出るまでの時間

LLM呼び出し回数:
  1会議あたり何回APIを呼んだか

カード採用率:
  聞いた / 固定 / あとで にされたカードの割合
```

初期目標値:

```text
有用カード率: 60%以上
邪魔カード率: 25%以下
初回カード表示速度: 10秒以内
LLM呼び出し頻度: 通常15-30秒に1回以下
1回のカード表示数: 最大3件
```

## MVPスコープ

必須:

- Next.js / Reactの2ペインUI
- Session Setup画面
- 会話カテゴリ選択
- 業界・役職・目的などの事前入力
- sessionProfile生成
- カテゴリ別プレイブック
- ダミー文字起こしでのカード生成
- クラウドSTT接続
- クラウドLLM接続
- AIカードJSON schema
- カード操作
- DBなし状態管理
- ローカル保存 / エクスポートの最低限の導線

後回し:

- 社内資料RAG
- 複数人チーム管理
- ログイン
- 課金
- 管理画面
- スマホ専用UI
- デスクトップアプリ
- ローカルSTT
- ローカルLLM

## フェーズ計画

### Phase 0: スキャフォールド

目的:

Loop Engineeringの前提で、実装・評価・改善を回せるプロジェクト構造を作る。

成果物:

- `loop init` 実行
- `Project.md`
- `ProjectGoal.md`
- `cloud-stt-ai-system-flows.md`
- `session-context.schema.json`
- `playbook.schema.json`
- `coach-card.schema.json`
- 初期プレイブック
- 初期プロンプト
- 評価ルーブリック

完了条件:

- プロジェクト構造が決まっている
- MVPの実装順が明確
- 評価データを追加できる場所がある

### Phase 1: UI Prototype

目的:

実際に会議中に使う画面の体験を固める。

成果物:

- 左ペイン: 文字起こし表示
- 右ペイン: AIカード表示
- 会話タイプ切替
- カード操作
- Session Setup画面

完了条件:

- ダミーデータで会議中の画面遷移を確認できる
- iPad / PCでレイアウトが崩れない
- カードが邪魔になりすぎない

### Phase 2: Playbook + Prompt

目的:

AI精度の土台を作る。

成果物:

- sales/default
- sales/manufacturing
- requirements/default
- recruiting/default
- user-research/default
- card-generator prompt
- report-generator prompt
- 期待カードの評価サンプル

完了条件:

- ダミー文字起こしから妥当な質問カードが出る
- 会話カテゴリによってカード内容が変わる
- JSON形式が安定する

### Phase 3: STT Integration

目的:

実音声からリアルタイム文字起こしを取得する。

成果物:

- マイク権限取得
- STT短命トークン発行
- STTストリーミング接続
- partial transcript表示
- final transcript確定処理

完了条件:

- 音声が左ペインにリアルタイム表示される
- final transcriptを会話バッファに追加できる
- 音声ファイルを自社クラウドに保存していない

### Phase 4: Realtime Coach Engine

目的:

final transcriptをもとに、必要時だけ質問カードを生成する。

成果物:

- local rule gate
- LLM call throttle
- checklist tracking
- duplicate prevention
- card ranking
- card action state

完了条件:

- 相槌や雑談ではカードが出にくい
- 重要論点ではカードが出る
- 表示済みカードが重複しない
- 1回あたり最大3件に制限される

### Phase 5: Session End

目的:

会議後に最低限の振り返りを提供する。

成果物:

- 聞けたこと
- 聞けなかったこと
- 次回確認事項
- Markdown / JSON export
- セッション破棄
- ローカル保存オプション

完了条件:

- DBなしで会議を終了できる
- ユーザーが保存・破棄を選べる
- サーバー側に会議データを残さない設計が維持される

## AI精度改善ループ

Loop Engineeringで回す評価ループ:

```text
1. 会話サンプルを追加
2. sessionProfileを設定
3. 対応するplaybookを選択
4. AIカードを生成
5. 人間がカードを評価
6. bad caseを分類
7. playbook / prompt / local ruleを修正
8. 再実行
```

bad case分類:

```text
too_generic:
  質問が一般的すぎる

too_late:
  カードが出るタイミングが遅い

too_many:
  カードが多すぎる

missed_important:
  重要論点を拾えていない

wrong_context:
  業界や会話目的に合っていない

unsafe_claim:
  根拠なく断定している
```

## 初期プレイブック優先順位

最初に作るべきプレイブック:

1. `sales/default`
2. `sales/manufacturing`
3. `requirements/default`
4. `recruiting/default`
5. `user-research/default`

営業を最初に厚めにする理由:

- 予算、決裁者、導入時期などカード化しやすい論点が多い
- 聞き漏れの損失が分かりやすい
- 対面/オンライン両方で利用シーンがある
- 評価しやすい

## 技術的制約

DBなしで進めるため、以下は割り切る。

- ブラウザを閉じるとデータは失われる
- 別端末で続きは見られない
- チーム共有はできない
- 管理者監査はできない
- 過去会議のクラウド検索はできない

ただし、この制約は初期の価値訴求にもなる。

```text
会話データをDBに残さない
音声ファイルを自社クラウドに保存しない
会議中だけ補助する
```

## リスク

主要リスク:

- STT精度が低いとカード精度も落ちる
- LLMカードが多すぎると会話を邪魔する
- 業界プレイブックが薄いと専門性が出ない
- iPad Safariで音声ストリーミングに制約が出る可能性がある
- STT/LLMプロバイダの保持設定を確認する必要がある
- DBなしだとB2B展開時に管理機能が不足する

初期対応:

- ダミー文字起こしで先にカード品質を検証する
- local rule gateでLLM呼び出しを抑制する
- プレイブックを短く構造化する
- iPad実機テストを早期に行う
- プロバイダのno-training / retention設定を確認する

## 次にやること

1. `loop init` でプロジェクトを作る
2. 既存HTMLモックをNext.js / Reactに移植する
3. Session Setup画面を追加する
4. `sessionProfile` schemaを作る
5. `playbook` schemaを作る
6. 初期プレイブックを作る
7. ダミー文字起こしでAIカード生成を実装する
8. STT APIを接続する


# Realtime Question Coach: Web System Flows

## 1. 全体像

```mermaid
flowchart LR
  User["利用者"] --> Browser["Web App<br>文字起こし / AIカード表示"]
  Browser --> Mic["ブラウザ音声入力<br>MediaDevices / Web Audio API"]
  Mic --> Stream["音声ストリーム送信<br>WebSocket / WebRTC"]
  Stream --> STT["リアルタイム文字起こし<br>STT Service"]
  STT --> Transcript["発話ログ<br>Transcript Store"]
  Transcript --> Context["会話状態管理<br>直近文脈 / 未確認項目"]
  Context --> Coach["Question Coach Engine<br>質問候補生成"]
  Coach --> Cards["AI補助カード<br>今聞く / 深掘り / あとで"]
  Cards --> Browser
```

Web版では、ブラウザ側は「録音・表示・軽い状態管理」に寄せ、サーバー側で「文字起こし・会話状態の更新・AIカード生成」を担う構成が扱いやすい。

## 2. セッション開始フロー

```mermaid
sequenceDiagram
  participant U as User
  participant B as Browser
  participant API as Backend API
  participant DB as DB

  U->>B: 会話タイプを選択
  U->>B: 録音開始
  B->>U: マイク権限を要求
  U-->>B: 許可
  B->>API: セッション作成<br>{meetingType, language, retentionPolicy}
  API->>DB: session record 作成
  DB-->>API: sessionId
  API-->>B: sessionId / stream endpoint
  B->>B: 左ペインと右ペインを初期化
```

初回は、録音同意・保存期間・会話タイプを明示する。特に商談や面接では、録音・文字起こしの社内ルールに乗せる必要がある。

## 3. リアルタイム文字起こしフロー

```mermaid
sequenceDiagram
  participant B as Browser
  participant G as Stream Gateway
  participant S as STT Service
  participant API as Backend API
  participant DB as Transcript DB

  B->>G: 音声チャンク送信<br>100ms-500ms単位
  G->>S: streaming STT request
  S-->>G: partial transcript
  G-->>B: partial transcript
  B->>B: 左ペインに暫定表示
  S-->>G: final transcript segment
  G->>API: final transcript segment
  API->>DB: 発話ログ保存
  API-->>B: 確定テキスト
  B->>B: 左ペインの暫定文を確定文へ更新
```

ポイントは、`partial` と `final` を分けること。AIカード生成には原則 `final transcript` を使う。暫定文字起こしをそのままLLMに渡すと、誤変換でノイズが増える。

## 4. AI補助カード生成フロー

```mermaid
flowchart TD
  Segment["確定発話セグメント"] --> Buffer["会話バッファ更新<br>直近1-5分"]
  Buffer --> State["会話状態更新<br>話題 / 決定事項 / 未確認項目"]
  State --> Gate{"カード生成すべきか"}
  Gate -- "No" --> Stop["何も出さない"]
  Gate -- "Yes" --> Prompt["会話タイプ別プロンプト<br>商談 / 採用 / 要件定義 / 調査"]
  Prompt --> LLM["LLM判定"]
  LLM --> Rank["優先度付け<br>今聞く / 深掘り / あとで"]
  Rank --> Dedup["重複・既出カード除去"]
  Dedup --> Limit["最大3件に制限"]
  Limit --> UI["右ペインにカード表示"]
```

ここで重要なのは、毎回カードを出さないこと。`Gate` で「新しい重要論点が出た」「未確認のまま会話が進みそう」「期限・金額・権限・責任者などが出た」場合だけ生成する。

## 5. 会話タイプ別のチェックリスト照合

```mermaid
flowchart LR
  Type["会話タイプ"] --> Checklist["チェックリスト"]
  Transcript["会話ログ"] --> Extract["情報抽出"]
  Checklist --> Compare["充足 / 未充足を判定"]
  Extract --> Compare
  Compare --> Missing["未確認項目"]
  Missing --> Question["質問候補"]

  subgraph Sales["商談"]
    S1["課題"]
    S2["影響範囲"]
    S3["予算"]
    S4["決裁者"]
    S5["導入時期"]
    S6["成功条件"]
  end

  subgraph Interview["採用"]
    I1["実績"]
    I2["本人の役割"]
    I3["転職理由"]
    I4["チーム経験"]
    I5["期待条件"]
  end

  subgraph Requirements["要件定義"]
    R1["目的"]
    R2["対象ユーザー"]
    R3["必須要件"]
    R4["例外ケース"]
    R5["権限"]
    R6["運用制約"]
  end
```

LLMに自由に考えさせるより、会話タイプごとの型を持たせる。これにより出力が安定し、プロダクトとしての品質を制御しやすくなる。

## 6. カード操作フロー

```mermaid
stateDiagram-v2
  [*] --> Suggested: AIがカード生成
  Suggested --> Pinned: 固定
  Suggested --> Done: 聞いた
  Suggested --> Later: あとで
  Suggested --> Dismissed: 不要
  Pinned --> Done: 聞いた
  Pinned --> Later: あとで
  Later --> Suggested: 再浮上
  Done --> Archived
  Dismissed --> Archived
```

ユーザー操作は学習データとして使える。たとえば「不要」が多いカードタイプは抑制し、「固定」「聞いた」が多いカードタイプは優先度を上げる。

## 7. 会議後フロー

```mermaid
flowchart TD
  End["会議終了"] --> Freeze["音声ストリーム停止"]
  Freeze --> Summary["発話ログから終了後レポート生成"]
  Summary --> Heard["聞けたこと"]
  Summary --> Missed["聞けなかったこと"]
  Summary --> Todo["次回確認事項"]
  Summary --> Export["Markdown / PDF / CRM / Notion へ出力"]
  Export --> Retention{"保存ポリシー"}
  Retention -- "保存する" --> Store["セッション保存"]
  Retention -- "破棄する" --> Delete["音声・一時ログ削除"]
```

リアルタイム要約を主機能にしなくても、終了後に「聞けた / 聞けなかった / 次回確認」を出すと価値が残る。

## 8. セキュリティ・プライバシーフロー

```mermaid
flowchart TD
  Audio["音声"] --> Policy{"音声を保存するか"}
  Policy -- "No" --> Temp["一時処理のみ"]
  Policy -- "Yes" --> EncAudio["暗号化保存"]
  Temp --> Text["文字起こしテキスト"]
  EncAudio --> Text
  Text --> PII["個人情報 / 機密語句検出"]
  PII --> Redact{"マスキング設定"}
  Redact -- "ON" --> Masked["マスク済みテキスト"]
  Redact -- "OFF" --> Raw["原文テキスト"]
  Masked --> LLM["LLM処理"]
  Raw --> LLM
  LLM --> Cards["AIカード"]
  Cards --> Audit["監査ログ<br>誰がいつ処理したか"]
```

企業向けなら最低限必要になる論点:

- 録音同意をどう取るか
- 音声を保存するか、一時処理だけにするか
- 文字起こしテキストの保存期間
- LLMに送る前のマスキング
- ユーザーごとのアクセス制御
- 監査ログ
- モデル学習への利用禁止設定

## 9. 推奨MVP構成

```mermaid
flowchart LR
  Browser["Next.js / React<br>2ペインUI"] --> WS["WebSocket"]
  WS --> STT["Streaming STT"]
  STT --> API["Backend<br>Node / Python"]
  API --> Redis["Redis<br>直近会話バッファ"]
  API --> Postgres["Postgres<br>セッション / 確定ログ / カード"]
  API --> LLM["LLM API<br>カード生成"]
  API --> Browser
```

MVPでは社内資料検索やRAGは入れない。まずは「会話タイプ別チェックリスト」と「直近会話」だけで質問候補を出す。

## 10. 本番構成の拡張

```mermaid
flowchart TD
  Web["Web App"] --> API["Backend API"]
  API --> Auth["Auth / Organization / Role"]
  API --> STT["STT Provider"]
  API --> LLM["LLM Provider"]
  API --> DB["Postgres"]
  API --> Cache["Redis"]
  API --> Queue["Job Queue"]
  Queue --> PostProcess["会議後処理"]
  PostProcess --> Exporters["Exporters<br>Notion / CRM / Google Docs"]

  API -. optional .-> RAG["Knowledge Search"]
  RAG -. optional .-> Drive["Google Drive"]
  RAG -. optional .-> Notion["Notion"]
  RAG -. optional .-> Slack["Slack"]
```

社内資料連携は後からでよい。入れる場合も、最初は「会議後の確認」に寄せた方が安全。リアルタイム中に社内資料を引くと、権限・遅延・誤提示の難易度が一段上がる。

## 11. 最小実装の処理順

1. ユーザーが会話タイプを選ぶ
2. ブラウザでマイク許可を取る
3. 音声をサーバーへストリーミングする
4. STTで文字起こしする
5. 左ペインに `partial`、確定後に `final` を表示する
6. 確定発話をRedisの会話バッファに入れる
7. 数十秒ごと、または重要語検出時にAI判定を走らせる
8. チェックリストと会話状態から質問候補を生成する
9. 重複を除き、最大3件を右ペインに出す
10. ユーザー操作を保存する
11. 会議終了後に聞けたこと・聞けなかったことを出す


# Cloud STT + Cloud AI System Flows

## 0. 前提

この構成では、音声認識とAIカード生成にクラウドサービスを使う。

- STT: クラウド音声認識APIを使用
- AI: クラウドLLM APIを使用
- DB: MVPでは持たない
- 音声: 自社クラウドには保存しない
- 文字起こし: 基本はブラウザ内メモリに保持
- ローカル保存: 必要な場合のみユーザー端末のIndexedDB / ファイル保存
- サーバー: Vercel / Next.jsを想定

重要な整理:

```text
音声をクラウドSTTへ送る
  = クラウド処理は発生する

音声を自社クラウドに保存しない
  = 音声ファイルをDB/S3等に残さない
```

## 1. 全体システムフロー

```mermaid
flowchart LR
  User["利用者<br>PC / iPad / Browser"] --> Browser["Web App<br>左: 文字起こし<br>右: AIカード"]

  Browser --> Mic["Microphone<br>getUserMedia"]
  Browser --> LocalState["Browser Memory<br>直近会話 / カード状態"]
  Browser --> LocalSave["Optional Local Save<br>IndexedDB / Export"]

  Browser --> Vercel["Vercel / Next.js<br>Token発行 / LLM Proxy / 設定"]
  Vercel --> STTToken["短命STT Token"]
  STTToken --> Browser

  Browser --> CloudSTT["Cloud STT Provider<br>Streaming Speech-to-Text"]
  CloudSTT --> Browser

  Browser --> Vercel
  Vercel --> CloudLLM["Cloud LLM API<br>質問カード生成"]
  CloudLLM --> Vercel
  Vercel --> Browser
```

推奨は、音声ストリームをVercelで中継し続けない構成。Vercelは短命トークンを発行し、ブラウザがSTTプロバイダへ直接接続する。これにより、Vercel Functionsの長時間接続・帯域コスト・タイムアウトリスクを避けやすい。

## 2. セッション開始フロー

```mermaid
sequenceDiagram
  participant U as User
  participant B as Browser
  participant V as Vercel API
  participant S as STT Provider

  U->>B: 会話タイプを選択<br>商談 / 採用 / 要件定義 / ユーザー調査
  U->>B: 録音開始
  B->>U: マイク権限を要求
  U-->>B: 許可
  B->>V: セッション初期化要求<br>{meetingType, language, noAudioStorage}
  V->>S: 短命STT token作成
  S-->>V: ephemeral token
  V-->>B: sessionId / STT endpoint / ephemeral token
  B->>B: 画面初期化<br>左ペイン / 右ペイン / 会話バッファ
```

`sessionId` はDBに保存しない一時IDでよい。ブラウザ内の状態管理、LLM呼び出しの相関ID、画面表示に使う。

## 3. 音声ストリーミング + 文字起こしフロー

```mermaid
sequenceDiagram
  participant B as Browser
  participant S as Cloud STT
  participant L as Local State

  B->>B: マイク音声を取得
  B->>B: 音声チャンク化<br>100ms-500ms程度
  B->>S: 音声ストリーム送信
  S-->>B: partial transcript
  B->>B: 左ペインに暫定表示
  S-->>B: final transcript segment
  B->>L: 確定発話を保存<br>browser memory
  B->>B: 左ペインを確定表示へ更新
```

`partial transcript` は画面表示用。AIカード生成には原則 `final transcript` を使う。

理由:

- 暫定文字起こしは誤変換が多い
- LLM呼び出し回数が増えやすい
- 無駄なカード生成が起きやすい

## 4. AIカード生成フロー

```mermaid
flowchart TD
  Final["Final Transcript Segment"] --> Buffer["Browser Conversation Buffer<br>直近1-3分"]
  Buffer --> Rule["Local Rule Gate<br>重要語 / 未確認項目 / 曖昧表現"]
  Rule --> NeedLLM{"LLMを呼ぶべきか"}

  NeedLLM -- "No" --> Skip["何も出さない"]
  NeedLLM -- "Yes" --> Compact["LLM入力を圧縮<br>直近会話 + 会話状態 + チェックリスト"]

  Compact --> Vercel["Vercel LLM Proxy"]
  Vercel --> LLM["Cloud LLM API"]
  LLM --> Validate["JSON Validate<br>形式 / 件数 / 長さ"]
  Validate --> Dedup["重複カード除去"]
  Dedup --> Cards["右ペインに最大3件表示"]
```

LLMには会話全文を毎回送らない。送るのは以下に絞る。

```text
直近1-3分の確定文字起こし
現在の会話タイプ
すでに聞けた項目
未確認の重要項目
既に表示したカードID
```

## 5. LLM呼び出し条件

```mermaid
flowchart TD
  Segment["確定発話"] --> Keyword{"重要語があるか"}
  Segment --> Ambiguous{"曖昧表現があるか"}
  Segment --> Checklist{"重要チェック項目が未充足か"}
  Segment --> Repeated{"同じ論点が繰り返されたか"}

  Keyword --> Score["Local Score"]
  Ambiguous --> Score
  Checklist --> Score
  Repeated --> Score

  Score --> Threshold{"閾値を超えたか"}
  Threshold -- "No" --> NoCall["LLM APIを呼ばない"]
  Threshold -- "Yes" --> Call["LLM APIを呼ぶ"]
```

例:

```text
LLMを呼ぶ:
- 予算、決裁者、期限、責任者、対象範囲が出た
- 「一応」「たぶん」「未定」「あとで確認」が出た
- 課題は出たが、影響範囲や数値がない
- 会話タイプ別の必須項目が埋まっていない

LLMを呼ばない:
- 相槌
- 雑談
- 既に処理した論点
- 短すぎる発話
- partial transcriptのみ
```

## 6. セキュア処理フロー

```mermaid
flowchart TD
  Audio["音声チャンク"] --> STT["Cloud STT<br>保存しない設定"]
  STT --> Text["文字起こしテキスト"]
  Text --> Browser["Browser Memory"]

  Browser --> Filter["送信前フィルタ<br>必要箇所だけ抽出"]
  Filter --> Mask{"マスキング設定"}
  Mask -- "ON" --> Masked["個人情報/固有名詞をマスク"]
  Mask -- "OFF" --> Raw["原文テキスト"]

  Masked --> LLMProxy["Vercel LLM Proxy"]
  Raw --> LLMProxy
  LLMProxy --> LLM["Cloud LLM<br>保存しない設定"]
  LLM --> Card["AIカードJSON"]
  Card --> Browser
```

確認すべきセキュリティ項目:

- STTプロバイダ側で音声を学習利用しない設定
- STTプロバイダ側のログ保持期間
- LLMプロバイダ側で入力を学習利用しない設定
- LLMプロバイダ側のログ保持期間
- 自社側で音声を保存しない実装
- Vercelログに本文・音声・API応答を出さない実装
- ブラウザ内保存の明示

## 7. DBなしMVPフロー

```mermaid
flowchart LR
  Browser["Browser"] --> Memory["In-Memory State<br>transcript / cards / meeting state"]
  Browser --> IndexedDB["Optional IndexedDB<br>ユーザーが保存ONの時だけ"]
  Browser --> Export["Export<br>Markdown / PDF / JSON"]

  Browser --> Vercel["Vercel API<br>stateless"]
  Vercel --> STTToken["STT Token"]
  Vercel --> LLM["LLM API"]

  Memory --> End{"セッション終了"}
  End -- "保存しない" --> Drop["メモリ破棄"]
  End -- "ローカル保存" --> IndexedDB
  End -- "書き出し" --> Export
```

DBなしで持てるもの:

- 現在の文字起こし
- 現在のAIカード
- ユーザーのカード操作
- 会議後の簡易レポート
- ローカル保存された過去セッション

DBなしで難しくなるもの:

- 複数端末同期
- チーム管理
- 管理者監査
- 課金状態管理
- 組織別設定
- 過去会議のクラウド検索
- サポート調査

## 8. 会議終了フロー

```mermaid
sequenceDiagram
  participant U as User
  participant B as Browser
  participant S as STT Provider
  participant V as Vercel API
  participant L as LLM API

  U->>B: 終了ボタン
  B->>S: 音声ストリーム停止
  B->>B: final transcriptを確定
  B->>V: 会議後レポート生成要求<br>必要最小限のテキストのみ
  V->>L: 聞けたこと / 聞けなかったこと / 次回確認を生成
  L-->>V: レポートJSON
  V-->>B: レポート返却
  B->>U: 保存 / エクスポート / 破棄を選択
```

会議後レポートもDBに保存しない。ユーザーが明示的にローカル保存またはエクスポートする。

## 9. Vercel構成

```mermaid
flowchart TD
  Next["Next.js App on Vercel"] --> UI["Client UI<br>React / 2-pane layout"]
  Next --> API["API Routes / Route Handlers"]

  API --> Token["/api/stt-token<br>短命STT token発行"]
  API --> Coach["/api/coach<br>LLMカード生成"]
  API --> Report["/api/report<br>会議後レポート生成"]

  Token --> STT["Cloud STT Provider"]
  Coach --> LLM["Cloud LLM Provider"]
  Report --> LLM

  UI --> Local["Browser State<br>Memory / IndexedDB"]
```

必要なVercel環境変数:

```text
STT_API_KEY
LLM_API_KEY
STT_REGION
LLM_MODEL_REALTIME
LLM_MODEL_REPORT
RETENTION_MODE=no_store
```

Vercel APIでやること:

- APIキーをブラウザに直接出さない
- STT用の短命トークンを発行する
- LLM呼び出しをプロキシする
- 入出力JSONを検証する
- 本文をログに出さない
- レート制限をかける

Vercel APIでやらない方がよいこと:

- 長時間音声ストリームの中継
- 音声ファイル保存
- 文字起こし全文の永続保存
- 会議本文のログ出力

## 10. コスト削減フロー

```mermaid
flowchart TD
  Audio["音声"] --> VAD["VAD<br>無音区間を除外"]
  VAD --> STT["Cloud STT"]
  STT --> Final["Final Transcript"]
  Final --> Rule["Local Rule Gate"]
  Rule --> Need{"必要時のみ"}
  Need -- "No" --> End["LLM呼び出しなし"]
  Need -- "Yes" --> SmallPrompt["短いプロンプト"]
  SmallPrompt --> FastLLM["高速・安価なLLM"]
  FastLLM --> JSON["短いJSONカード"]
```

コスト削減の優先順位:

1. 無音区間を送らない
2. partial transcriptでLLMを呼ばない
3. LLM呼び出しを15-30秒単位に制限
4. 重要語がない時はLLMを呼ばない
5. 直近会話だけ送る
6. 出力をJSON最大3件に絞る
7. 会議後レポートだけ高精度モデルにする

## 11. 推奨MVP構成

```text
Frontend:
  Next.js / React on Vercel

Realtime STT:
  Cloud STT Provider
  Browser direct streaming with ephemeral token

AI Cards:
  Vercel API Route
  Cloud LLM API
  JSON schema validation

Storage:
  No server DB
  Browser memory by default
  Optional IndexedDB / file export

Security:
  No audio storage
  No transcript logging
  Provider no-training / low-retention setting
```

最初のプロダクトメッセージ:

```text
音声ファイルを自社クラウドに保存しない
会話データをDBに残さない
会議中だけ、聞くべき質問を表示する
```


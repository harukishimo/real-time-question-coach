# Realtime Question Coach Data Contracts

この文書は、現在の実装で使う主要データ契約を定義する。

正本の実装型は `src/lib/types.ts` とする。この文書は、AI Work Ticket、レビュー、テスト、手動確認で同じ判断ができるようにするための参照資料である。

## Storage Decision

MVPでは Browser memory を基本にする。

ユーザーが明示操作した場合だけ、次を許可する。

- Markdown export
- JSON export
- browser local save

現時点の実装では、browser local save は `localStorage` を使う。IndexedDBはMVP必須範囲に含めない。将来、大きなsession payload、複数session管理、削除UI、暗号化local storeが必要になった場合に別ticketで検討する。

サーバーDBへ保存しないもの:

- audio
- transcript body
- AI card body
- LLM input
- LLM output
- session report body

## Session Setup Input

Session Setupで収集する入力は次の5項目である。相手役職はMVP入力に含めない。

```ts
type SessionSetupInput = {
  conversationType: "sales" | "requirements" | "recruiting" | "user_research";
  industry: "manufacturing" | "it" | "healthcare" | "finance" | "generic";
  purpose: string;
  mustCheckItems: string[];
  audioSource: "microphone" | "browser_tab" | "system_audio" | "dummy";
  consentNoServerStorage: boolean;
};
```

## sessionProfile

`sessionProfile` は、Session Setup入力とリポジトリ内ナレッジから生成する、会話中のAI支援文脈である。

```ts
type SessionProfile = {
  id: string;
  conversationType: "sales" | "requirements" | "recruiting" | "user_research";
  industry: "manufacturing" | "it" | "healthcare" | "finance" | "generic";
  purpose: string;
  mustCheckItems: string[];
  audioSource: "microphone" | "browser_tab" | "system_audio" | "dummy";
  knowledgeSetId: string;
  playbookTitle: string;
  playbookDescription: string;
  playbookMustCheck: string[];
  importantTerms: string[];
  ambiguousTerms: string[];
  mustAskTemplates: string[];
  avoidQuestions: string[];
  completionCriteria: string[];
  cardRules: string[];
  createdAt: string;
};
```

## transcriptSegment

文字起こしは `TranscriptSegment` として扱う。LLM判定対象は `isFinal: true` のsegmentのみである。

```ts
type TranscriptSegment = {
  id: string;
  sequence: number;
  speaker: {
    id: "user" | "participant" | "unknown";
    label: string;
    source: "fixture" | "provider" | "unknown";
    confidence: number;
  };
  text: string;
  isFinal: boolean;
  startedAtMs: number;
  endedAtMs?: number;
  createdAt: string;
};
```

speaker判定は、dummy transcriptではfixture、real providerではproviderのdiarization / speaker metadata、判定不能時は `unknown` とする。MVPでは物理的な話者識別精度保証はしない。

## coachCard

AI補助カードは、会話中に聞き漏れを防ぐための短い質問候補である。議事録ではない。

```ts
type CoachCard = {
  id: string;
  title: string;
  question: string;
  reason: string;
  priority: "high" | "medium" | "low";
  score: number;
  status: "active" | "queued" | "later" | "done" | "dismissed" | "pinned";
  sourceSegmentIds: string[];
  ruleIds: string[];
  createdAt: string;
};
```

active表示は最大3件である。

scoreの扱い:

- local rule seedの重要語カード: `92`
- local rule seedの曖昧表現カード: `78`
- local rule seedのmust-check gapカード: `74`
- LLM候補カード: provider応答の `score` を `0..100` に丸め、`50` 未満は破棄する
- active上限超過時は `score` 降順で表示候補を選び、低scoreの非pinnedカードをqueuedへ送る
- `pinned` は自動降格しない

## Local Rule Gate

LLMは常時呼び出さない。local rule gateが必要性を判定した場合だけ呼ぶ。

現在の発火条件:

- final transcriptが存在する
- cooldownが終了している
- importantTerms、ambiguousTerms、または未回収のmustCheckItemsに該当する
- 同じ論点が `done` / `dismissed` 済みでない

現在の抑制条件:

- final transcriptがない
- partial transcriptのみ
- cooldown中
- 同一dispatch keyが処理済み
- LLM requestがin-flight

現在のcooldown:

```ts
const DEFAULT_COOLDOWN_MS = 15_000;
```

manual recheckはユーザーの明示操作なのでcooldownを解除できる。ただしin-flight重複とactive最大3件制御は維持する。

## sessionReport

Session Reportは、セッション終了時にユーザーが確認・exportするための要約である。サーバーDBへ保存しない。

```ts
type SessionReport = {
  sessionId: string;
  heardItems: string[];
  missedItems: string[];
  nextActions: string[];
  cardStats: {
    total: number;
    done: number;
    later: number;
    dismissed: number;
  };
  generatedAt: string;
};
```

provider report generationが失敗した場合は、成功reportとして扱わず、export actionを表示しない。

## Provider Schema Boundary

LLM providerは `mock | openai | anthropic` をサポートする。provider固有responseはadapter内で吸収し、下流には `CoachCardCandidate[]` または `SessionReport` だけを渡す。

STT providerは `mock | openai` をサポートする。STT tokenは短命で、user/sessionに紐づける。Next APIで長時間audio relayを行わない。

`/api/stt-token` は audio bytes、audio file、remote audio URL を受け取らない。`RQC_STT_PROVIDER=openai` の場合、clientは `connectionType=webrtc` と `realtimeUrl` を受け取り、browser内の `MediaStream` を OpenAI Realtime WebRTC peer connection へ直接渡す。provider event は browser内で partial/final transcript event に正規化し、finalのみをAIカード判定対象にする。

## JSON Schema Fragments

### sessionProfile

```json
{
  "$id": "rqc.sessionProfile.v1",
  "type": "object",
  "required": [
    "id",
    "conversationType",
    "industry",
    "purpose",
    "mustCheckItems",
    "audioSource",
    "knowledgeSetId",
    "playbookTitle",
    "playbookDescription",
    "playbookMustCheck",
    "importantTerms",
    "ambiguousTerms",
    "mustAskTemplates",
    "avoidQuestions",
    "completionCriteria",
    "cardRules",
    "createdAt"
  ],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "minLength": 1 },
    "conversationType": {
      "type": "string",
      "enum": ["sales", "requirements", "recruiting", "user_research"]
    },
    "industry": {
      "type": "string",
      "enum": ["manufacturing", "it", "healthcare", "finance", "generic"]
    },
    "purpose": { "type": "string", "minLength": 1 },
    "mustCheckItems": { "type": "array", "items": { "type": "string" } },
    "audioSource": {
      "type": "string",
      "enum": ["microphone", "browser_tab", "system_audio", "dummy"]
    },
    "knowledgeSetId": { "type": "string", "minLength": 1 },
    "playbookTitle": { "type": "string" },
    "playbookDescription": { "type": "string" },
    "playbookMustCheck": { "type": "array", "items": { "type": "string" } },
    "importantTerms": { "type": "array", "items": { "type": "string" } },
    "ambiguousTerms": { "type": "array", "items": { "type": "string" } },
    "mustAskTemplates": { "type": "array", "items": { "type": "string" } },
    "avoidQuestions": { "type": "array", "items": { "type": "string" } },
    "completionCriteria": { "type": "array", "items": { "type": "string" } },
    "cardRules": { "type": "array", "items": { "type": "string" } },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}
```

### coachCard

```json
{
  "$id": "rqc.coachCard.v1",
  "type": "object",
  "required": [
    "id",
    "title",
    "question",
    "reason",
    "priority",
    "score",
    "status",
    "sourceSegmentIds",
    "ruleIds",
    "createdAt"
  ],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "minLength": 1 },
    "title": { "type": "string", "minLength": 1 },
    "question": { "type": "string", "minLength": 1 },
    "reason": { "type": "string", "minLength": 1 },
    "priority": { "type": "string", "enum": ["high", "medium", "low"] },
    "score": { "type": "number", "minimum": 0, "maximum": 100 },
    "status": {
      "type": "string",
      "enum": ["active", "queued", "later", "done", "dismissed", "pinned"]
    },
    "sourceSegmentIds": { "type": "array", "items": { "type": "string" } },
    "ruleIds": { "type": "array", "items": { "type": "string" } },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}
```

### sessionReport

```json
{
  "$id": "rqc.sessionReport.v1",
  "type": "object",
  "required": [
    "sessionId",
    "heardItems",
    "missedItems",
    "nextActions",
    "cardStats",
    "generatedAt"
  ],
  "additionalProperties": false,
  "properties": {
    "sessionId": { "type": "string", "minLength": 1 },
    "heardItems": { "type": "array", "items": { "type": "string" } },
    "missedItems": { "type": "array", "items": { "type": "string" } },
    "nextActions": { "type": "array", "items": { "type": "string" } },
    "cardStats": {
      "type": "object",
      "required": ["total", "done", "later", "dismissed"],
      "additionalProperties": false,
      "properties": {
        "total": { "type": "integer", "minimum": 0 },
        "done": { "type": "integer", "minimum": 0 },
        "later": { "type": "integer", "minimum": 0 },
        "dismissed": { "type": "integer", "minimum": 0 }
      }
    },
    "generatedAt": { "type": "string", "format": "date-time" }
  }
}
```

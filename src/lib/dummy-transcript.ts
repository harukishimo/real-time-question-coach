import { createTranscriptSegment } from "@/lib/transcript";
import type { ConversationType, SpeakerInfo, TranscriptSegment } from "@/lib/types";

const userSpeaker: SpeakerInfo = {
  id: "user",
  label: "自分",
  source: "fixture",
  confidence: 1
};

const participantSpeaker: SpeakerInfo = {
  id: "participant",
  label: "相手",
  source: "fixture",
  confidence: 1
};

const scripts: Record<ConversationType, string[]> = {
  sales: [
    "まず現場の入力作業が多くて、品質確認に時間がかかっています。",
    "導入時期は来期の前半を見ていますが、予算はまだ検討中です。",
    "決裁は部長と工場長が関わります。稟議の流れはあとで確認します。",
    "既存システムとの連携ができればかなり助かります。",
    "比較している製品はありますが、運用に合うかが一番気になっています。",
    "なるべく早く効果を見たいので、最初は小さく始めたいです。"
  ],
  requirements: [
    "今の運用では申請後に承認者が変わることがあります。",
    "必須なのは権限ごとの閲覧制御で、例外もいくつかあります。",
    "データはあとから修正できると嬉しいですが、監査上は履歴も必要です。",
    "期限は来月末ですが、できれば先に主要画面だけ確認したいです。",
    "承認が差し戻された場合の通知は必要です。",
    "細かい例外は場合によります。"
  ],
  recruiting: [
    "転職理由は、今より裁量を持ってプロダクトに関わりたいことです。",
    "条件面は大事ですが、意思決定ではチームの雰囲気も重視します。",
    "入社時期は現職との調整が必要で、なるべく早めに決めたいです。",
    "懸念はオンボーディングの体制です。",
    "他社選考も進んでいますが、優先順位はまだ検討中です。",
    "期待している役割が具体的だと判断しやすいです。"
  ],
  user_research: [
    "この作業は週に何度もあります。",
    "今はスプレッドシートで代替していますが、更新漏れがよくあります。",
    "最後に困ったのは、共有したはずの情報が古かったときです。",
    "判断基準は人によって違うので、ざっくり合わせています。",
    "失敗すると後工程でやり直しになります。",
    "理想は確認しなくても状態が分かることです。"
  ]
};

export function getDummyTranscriptFixture(
  conversationType: ConversationType
): string[] {
  return scripts[conversationType];
}

export function createDummyTranscriptPair(
  conversationType: ConversationType,
  sequence: number
): {
  partial: TranscriptSegment;
  final: TranscriptSegment;
} {
  const fixture = getDummyTranscriptFixture(conversationType);
  const text = fixture[sequence % fixture.length];
  const startedAtMs = sequence * 5_000;
  const speaker = sequence % 2 === 0 ? participantSpeaker : userSpeaker;

  return {
    partial: createTranscriptSegment({
      sequence,
      speaker,
      text: `${text.slice(0, Math.max(8, Math.floor(text.length * 0.55)))}...`,
      isFinal: false,
      startedAtMs
    }),
    final: createTranscriptSegment({
      sequence,
      speaker,
      text,
      isFinal: true,
      startedAtMs,
      endedAtMs: startedAtMs + 4_000
    })
  };
}

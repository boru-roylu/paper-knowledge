---
paper_key: arxiv_2601_03170
canonical_id: "arxiv:2601.03170"
title: "TED-TTS: Training-Free Intra-Utterance Emotion and Duration Control for Text-to-Speech Synthesis"
year: 2026
venue: "ACL 2026 Main Conference / arXiv preprint"
url: "https://arxiv.org/abs/2601.03170"
pdf_url: "https://arxiv.org/pdf/2601.03170"
status: read
rating: 8.2
tags:
  - tts
  - controllable-tts
  - expressive-speech
  - duration-control
  - emotion-control
  - speech-data
  - project-tts-data-pipeline
  - project-full-duplex-data
created: 2026-06-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`, `sections/*.tex`, appendix). I also checked public web/OpenReview context on 2026-06-06; OpenReview public notes were not available through the local fetch script.

## Links

- [Original arXiv abstract](https://arxiv.org/abs/2601.03170)
- [PDF](https://arxiv.org/pdf/2601.03170)
- [arXiv source](https://arxiv.org/src/2601.03170)
- [Official GitHub repo](https://github.com/Simon-leong/TED-TTS)
- [Audio demo page](https://simon-leong.github.io/TED-TTS-DemoPage/)
- [OpenReview forum](https://openreview.net/forum?id=8eyCzZcE7t)

## 一句話總結

TED-TTS 是一個 **training-free intra-utterance controllable TTS** framework：不重新訓練 TTS acoustic model，而是在 autoregressive semantic-token decoding 期間用 segment-aware emotion conditioning、Monotonic Stream Alignment (MSA)、local duration steering 和 global EOS steering，讓同一句話內不同片段可以切換 emotion / duration。

## 這篇在解決什麼問題

現有 controllable TTS 多半只能做 **utterance-level control**：整句話套同一個 speaker / emotion / speaking rate。這和自然 speech 不一樣，因為人類常在一句話內部切換 emotion、speaking rate、emphasis 和 discourse intent。

已有 intra-utterance control 方法通常需要 phoneme/frame-level affective labels、emotional reference speech、time-aligned annotated speech dataset、multi-stage training / distillation，或手工把句子切成 segment 並寫 segment-level prompt。

TED-TTS 的問題設定是：**能不能在不重訓 TTS model 的情況下，讓 pretrained zero-shot TTS 支援句內 emotion 和 duration 控制？**

## 核心方法

TED-TTS 基於 IndexTTS2-style autoregressive T2S module。核心不是改模型權重，而是改 inference-time conditioning / masking / decoding control。

### 1) MED-TTS dataset + automatic prompt construction

作者建立 **MED-TTS**，一個 30,000 sample 的 multi-emotion / duration-annotated text dataset：

- 15,000 English samples。
- 15,000 Chinese samples。
- 7 種 emotion：happy、sad、angry、surprised、fearful、disgusted、neutral。
- 3 種 text categories：vivid descriptive、emotional dialogue、observational phrase。

資料生成流程：

```text
GPT-4o generates emotion-rich texts
  -> DeepSeek-Chat segments each utterance
  -> each segment gets emotion description + estimated duration
  -> automatic checks + manual verification
  -> LoRA fine-tune Qwen3-8B prompt constructor
```

這個 prompt constructor 的目標是把 raw user text 轉成 structured multi-segment prompt，避免使用者手動切句與手動指定每段 emotion / duration。

### 2) Segment-aware emotion conditioning

輸入文字被拆成 segments，每個 segment 有自己的 condition embedding：

```text
C_m = {speaker identity I, segment emotion E_m}
```

困難點是 autoregressive T2S 生成的是連續 semantic token stream，沒有天然 segment boundary。若直接切段生成再拼接，容易破壞 speaker consistency、prosody continuity 和 semantic coherence。

TED-TTS 用 **2D causal attention mask** 解耦兩件事：

- semantic / text context 仍可跨 segment 保持 global visibility；
- emotion condition embedding 只允許當前 segment 可見，避免不同 emotion condition leakage。

也就是：語義上下文保持整句連貫，但 style condition 僅在局部 segment 生效。

### 3) Monotonic Stream Alignment (MSA)

2D mask 需要知道目前 generated semantic token 對齊到哪個 text segment。raw attention map 很 noisy、head-dependent、non-monotonic，所以作者提出 **MSA**。

MSA 在 decoding 中維持一個 text-position belief distribution：

```text
previous posterior
  -> monotonic transition predict
  -> select reliable attention head
  -> combine attention observation
  -> posterior alignment belief
  -> trigger segment mask switch
```

直覺上，MSA 是一個 online alignment tracker。它用 monotonic prior 抑制倒退，並從多層多頭 attention 中挑較可靠的 head 當 observation，讓 emotion condition 在正確 boundary 附近切換。

### 4) Segment-aware duration steering

作者把 segment target duration 轉成 semantic token budget，並使用兩層控制：

**Local Duration Embedding Steering**

- 每段有 target semantic token length。
- decoding 過程中用 MSA 估計 text progress 和 semantic progress。
- 若 semantic generation lag / lead text progress，就動態查 duration embedding table，調整 active segment 的 duration embedding。
- 這像一個 proportional controller，用低頻率更新避免抖動。

**Global EOS Steering**

- local steering 控制每段 pace，但不保證整句何時結束。
- 因此作者對 EOS logit 加 adaptive bias：
  - 非 final segments 抑制 EOS，避免 premature termination。
  - final segment 根據剩餘 semantic budget 調整 EOS probability，避免太早或太晚結束。

## Training / Data

這篇強調 **TTS model training-free**，但不是完全沒有資料工作。它有兩個層次：

1. **不重新訓練 acoustic / T2S generator**  
   emotion conditioning、duration steering、MSA 都是 inference-time control。

2. **訓練 prompt constructor**  
   作者用 MED-TTS fine-tune Qwen3-8B，讓 LLM 自動把 raw text 轉成 multi-segment emotion/duration prompt。

Evaluation setup：

- baseline / comparison：IndexTTS2、MaskGCT、F5TTS、SparkTTS、CosyVoice2 等。
- comparative methods 缺乏真正 intra-utterance controllability，因此作者把各 segments 獨立合成再 concatenation 作比較。
- objective metrics：WER/CER、DNSMOS Pro / DNSM、WavLM speaker similarity、NISQA / OVRL、emotion2vec-large。
- subjective metrics：SMOS、NMOS、EMOS、SPMOS；15 位 graduate students，每人 18 samples，約 40 分鐘。

## 主要結果

作者主張 TED-TTS 在 multi-emotion / duration control 上達到 state-of-the-art 或 competitive performance，同時保持 baseline-level speech quality。

關鍵結果：

- emotion control 下，TED-TTS 多數 objective metrics 最好或接近最好，特別是 DNSM / SSIM，表示 emotion transition 更平滑、speaker consistency 更好。
- duration control 下，TED-TTS 在 English / Chinese 上取得最好的 DNSM、NISQA、OVRL，代表 temporal pacing 和 perceptual quality 較穩。
- subjective MOS 中，TED-TTS 在 emotion / duration control 任務上多數指標 SOTA 或 highly competitive。
- ablation 顯示：去掉 full-text access 或 MSA 會降低 expressive quality 和 cross-segment speaker consistency；去掉 local duration steering，duration control 下降最大；去掉 global EOS 也會穩定變差。
- MSA alignment evaluation：monotonic stream constraint 降低 MAE 到 0.216；加入 top-k reliable attention observation 後，MAE 降到 0.157。
- duration-specified evaluation：在 0.75、0.875、1.0、1.125、1.25 scaling 下，TED-TTS 平均 semantic token number error 最低；相對 baseline 少 5.07%。
- efficiency：加 emotion conditioning / duration steering 後 total overhead 約 40.2% English / 42.2% Chinese，但 RTF 仍低於 1.0。

## Project relevance

### 對 project-tts-data-pipeline

這篇對 TTS data pipeline 很有價值，不只是因為它是 TTS model paper，而是因為 **MED-TTS 的資料格式** 很像我們需要的 controllable TTS training / evaluation intermediate representation。

MED-TTS 每個 sample 不是只有文字，而是：

```text
utterance text
  -> contiguous segments
  -> emotion label / natural language emotion description per segment
  -> estimated duration per segment
  -> verification checklist
```

這對我們的 English TTS data pipeline 有三個啟發：

1. **transcript 不應只是一行文字**  
   expressive TTS training data 應該包含 segment-level tags，例如 emotion、pace、emphasis、pause、nonverbal event、speaker state。

2. **duration annotation 可以先從 text prior 估計，再用 audio alignment 校正**  
   TED-TTS 用 LLM estimate duration；我們若有真實 audio，可以反過來用 forced alignment / ASR timestamp / codec token count 取得更可靠的 segment duration。

3. **automatic prompt construction 是 data pipeline component**  
   如果之後要訓練 controllable TTS / dialogue TTS，可以先訓練一個 prompt constructor，把 raw transcript 轉成 structured TTS prompt，而不是手寫 tags。

### 對 project-full-duplex-data

TED-TTS 是 single-speaker intra-utterance control，不是 full-duplex dialogue。但它的 **segment-aware control** 很適合借到 dual-channel conversation generation：

```text
Speaker A segment 1: neutral, normal pace
Speaker B backchannel: short, soft, overlaps A boundary
Speaker A segment 2: surprised, faster
Speaker B interruption: urgent, starts at 2.4s
```

如果我們未來要 given transcript/control signals 生成 natural dual-channel conversation，control representation 不能只是一整句 global style，而應該是 segment-level / event-level / speaker-level。

TED-TTS 的 MSA 思路也可以借來做 text-to-audio segment boundary tracking、emotion / prosody condition switching、backchannel timing control、overlap segment control、duration / pacing steering。

### 對 project-audio-model-evaluation

這篇的 evaluation 還是比較傳統：WER/CER、DNSMOS、SSIM、NISQA、OVRL、emotion2vec、MOS。對 grounded audio judge 來說，可以補上更細的 rubrics：

- emotion switch 是否發生在指定 segment boundary？
- duration 是否在目標 time span 內？
- emotion transition 是否過 abrupt？
- speaker identity 是否在 emotion shift 時漂移？
- local prosody 是否符合 emotion description？

也就是 TED-TTS 可以作為 grounded rubric evaluation 的 target system。

## Related papers in my pool

- [[arxiv_2605_19833|Mega-ASR]]：可作 robust ASR / WER 評估工具，檢查 expressive TTS 在情緒與速度變化下是否仍保持 content fidelity。
- [[arxiv_2606_03116|AnyAudio-Judge]]：可將 TED-TTS 的 emotion/duration control 拆成 dynamic rubrics。
- [[arxiv_2602_01914|FlashTrace]]：可用來檢查 judge 對 emotion/duration failure 的判斷是否 grounded in correct transcript / event / audio-token span。
- [[arxiv_2603_25750|Sommelier]]：full-duplex preprocessing 可產生 segment/event annotations；TED-TTS 則提供 segment-level controllable generation 的 model-side 參考。
- [[arxiv_2604_09344|DialogueSidon]]：dual-channel recovery 可提供 speaker-level segments；TED-TTS 的 segment-aware control 可作 future generator control mechanism。

## OpenReview / reviewer discussion

OpenReview fetch script matched a forum, but public notes were unavailable (`public notes=0`) at ingestion time. No public reviewer/rebuttal details were summarized.

## 我該不該細讀

**應該細讀，尤其是 Method 和 Appendix 的 dataset prompts。**

這篇最值得看的不是模型本身有多強，而是它把 **segment-level controllable TTS** 拆成了很實用的工程問題：

- 如何把 raw text 自動切成 emotion/duration segments；
- 如何讓 segment condition 在 autoregressive decoding 中正確切換；
- 如何用 alignment belief 控制 mask switching；
- 如何用 local duration steering + global EOS steering 控制 segment pacing。

對我們的 TTS data pipeline，MED-TTS prompt / verification checklist 特別值得借鑑。

## 可能的弱點 / open questions

1. **不是 continuous emotion trajectory**  
   作者自己也承認，目前是 segment-wise control，不顯式建模 gradual emotion transition。雖然 signal-level continuity 平滑，但 emotion representation 仍是 discrete segment。

2. **duration precision 受 baseline TTS representation 限制**  
   因為不更新模型權重，duration embedding 未必支援真正線性、細粒度的 timing control，尤其在高度 expressive 或 OOD setting。

3. **MED-TTS 是 LLM-synthetic text dataset，不是真實 speech annotation**  
   這對 prompt construction 有用，但不等於有真實 audio 的 emotion/duration ground truth。若要訓練 TTS model，本身仍需要 audio-side alignment / verification。

4. **比較基準有點不對等**  
   許多 baseline 不能 single-pass intra-utterance control，只能 segment-wise synthesis + concatenation；這確實反映 TED-TTS 的優勢，但也讓比較不完全是同一能力。

5. **speaker fidelity vs expressiveness tradeoff**  
   appendix 提到 text prompt setting 的 emotional dialogue 場景可能犧牲 speaker similarity，因為 expressive prosody 會拉動 timbre。

6. **對 full-duplex 還缺 speaker interaction modeling**  
   TED-TTS 控制的是單 speaker 句內 emotion/duration；full-duplex 還需要 multi-speaker timing、overlap、backchannel 和 interruption control。

## Tags

- `tts`
- `controllable-tts`
- `expressive-speech`
- `duration-control`
- `emotion-control`
- `speech-data`
- `project-tts-data-pipeline`
- `project-full-duplex-data`

## Concepts

- `training-free TTS control`
- `intra-utterance emotion control`
- `segment-aware conditioning`
- `Monotonic Stream Alignment`
- `duration steering`
- `global EOS steering`
- `MED-TTS`
- `structured TTS prompts`

## Citation

```bibtex
@misc{liang2026tedttstrainingfreeintrautteran,
  title={TED-TTS: Training-Free Intra-Utterance Emotion and Duration Control for Text-to-Speech Synthesis},
  author={Qifan Liang and Yuansen Liu and Ruixin Wei and Nan Lu and Junchuan Zhao and Ye Wang},
  year={2026},
  eprint={2601.03170},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2601.03170}
}
```

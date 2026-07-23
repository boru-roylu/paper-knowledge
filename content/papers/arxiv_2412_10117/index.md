---
paper_key: arxiv_2412_10117
canonical_id: "arxiv:2412.10117"
title: "CosyVoice 2: Scalable Streaming Speech Synthesis with Large Language Models"
year: 2024
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2412.10117"
pdf_url: "https://arxiv.org/pdf/2412.10117"
status: read
rating: 9
tags:
  - tts
  - speech-llm
  - streaming-tts
  - flow-matching
  - speech-tokenizer
  - zero-shot-tts
  - voice-cloning
  - instructed-tts
  - project-tts-data-pipeline
  - project-full-duplex-data
  - project-generative-speech-representation-evaluation
  - project-audio-model-evaluation
created: 2026-07-22
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`, `chapters/*.tex`, `main.bbl`, `ref.bib`), with public web checks for official repo/demo/Hugging Face/OpenReview status on 2026-07-23.

## Links
- [Original URL](https://arxiv.org/abs/2412.10117)
- [arXiv abstract](https://arxiv.org/abs/2412.10117)
- [PDF](https://arxiv.org/pdf/2412.10117)
- [arXiv source](https://arxiv.org/src/2412.10117)
- [Official GitHub repo](https://github.com/FunAudioLLM/CosyVoice)
- [Demo / project page](https://funaudiollm.github.io/cosyvoice2)
- [Hugging Face model: CosyVoice2-0.5B](https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B)
- [OpenReview revision page](https://openreview.net/revisions?id=8SlnGkMo85)

## 一句話總結
CosyVoice 2 是一個 open-source multilingual zero-shot / instructed / streaming TTS system：它用 FSQ-based supervised semantic speech tokenizer 產生 25 Hz semantic tokens，用 Qwen2.5-0.5B 做 text-to-speech-token LM，再用 chunk-aware causal Flow Matching 把 semantic tokens、speaker embedding 和 reference speech 轉成 Mel spectrogram，最後 vocoder 合成 waveform；核心價值是把 streaming 和 non-streaming TTS 放進同一套模型，並在 streaming mode 保持接近 offline 的品質。

## 這篇在解決什麼問題
CosyVoice 1 已經走 hybrid TTS route：LM 負責 text-to-codec / semantic token generation，Flow Matching 負責 codec-to-feature acoustic generation。但 real-time voice interaction 對 response latency、first-packet latency、streaming synthesis 要求更高。如果一個 TTS 系統只能等完整句子生成完再合成，放進 spoken LLM / voice chat 就會讓互動變卡。

作者把 CosyVoice 2 的問題拆成幾個工程與 modeling bottlenecks：

- 舊的 VQ speech tokenizer codebook utilization 不好，semantic token 可能保留不足的 content information。
- 舊版 text-speech LM 有 text encoder 和 speaker embedding，架構較重，也容易讓 speaker/language/paralanguage information leak into LM，傷害 cross-lingual / prosody naturalness。
- Flow Matching 通常是 offline model，要等所有 speech tokens 都準備好才能 sample Mel，不適合 streaming。
- instruction control 不能只靠 content text 自然 emerge，需要顯式 instruction data 和格式。

## 核心方法

### 1) Semantic-acoustic decoupled TTS pipeline
CosyVoice 2 延續「semantic / acoustic separation」：

- Text-speech LM 只負責 semantic speech tokens。
- Flow Matching model 負責 acoustic detail，例如 timbre、reference speech、speaker embedding。
- Vocoder 負責把 Mel spectrogram 轉 waveform。

這個分工對我們很重要：content / speaker / prosody / acoustic quality 不應該全部塞進一個 representation 裡。CosyVoice2 明確把 semantic token 和 acoustic rendering 拆開，也因此成為後續 speech LLM / full-duplex paper 常引用的 tokenizer 或 synthesizer。

### 2) BPE text tokenizer，但避免中文 one-to-many token
CosyVoice 2 直接使用 raw text + BPE tokenizer，不走傳統 g2p frontend。中文如果某個 BPE token 對應多個中文字，會被 mask out，改成逐字 encode，避免單一 token 發音過長，也減少 data sparsity 導致的 corner cases。英文、日文、韓文則沒有特殊處理。

### 3) FSQ-based supervised semantic speech tokenizer
作者把 finite scalar quantization (FSQ) 插入 SenseVoice-Large ASR encoder：

- Speech 先進入 Encoder1，Encoder1 是 6-layer Transformer + RoPE。
- 中間 representation 投影到 low-rank space。
- 每個 dimension 做 bounded round quantization。
- 再投影回原始維度，交給 Encoder2 + ASR decoder 預測文字。
- tokenizer inference 時只保留 Encoder1、low-rank projector、rounding、index calculation。

token rate 是 25 Hz。這個 tokenizer 是 supervised semantic tokenizer：它受 ASR objective 約束，因此比 unsupervised acoustic codec 更強調 content / linguistic information。

FSQ 結果很關鍵：

- VQ codebook size 4096，但只用 963 個 codes，utilization 23%。
- FSQ codebook size 6561，利用率 100%。
- ASR error 也下降，例如 CommonVoice EN 18.26 -> 10.67、CommonVoice CN 11.56 -> 7.29。

作者還用 VoxCeleb1 做 t-SNE 和 SID training，觀察 quantization 前 representation 帶 speaker separation，quantization 後 speaker distributions 幾乎混在一起，SID layer 不收斂。這支持它的 tokenizer 比較 speaker-independent，適合作為 semantic token。

### 4) Unified text-speech LM for streaming / non-streaming
CosyVoice 2 用 Qwen2.5-0.5B 當 text-speech LM backbone，做 autoregressive next-token prediction。相較 CosyVoice 1：

- 移除 text encoder：Qwen2.5-0.5B 已足以處理 text / speech token alignment。
- 移除 LM 裡的 speaker embedding：避免 speaker embedding 攜帶 language / paralanguage 資訊，干擾 in-context learning、prosody 和 cross-lingual capability。

它用兩種 sequence construction 訓練同一個 LM：

- Non-streaming：`<S> text <T> speech_tokens <E>`。
- Streaming：每 N 個 text tokens 後接 M 個 speech tokens；實驗中 N=5、M=15。當下一段 text 還沒接上時，模型先預測 filling token，推論時再手動補進下一批 text tokens。

這讓同一個 LM 可以支援 offline TTS，也支援 streaming TTS / speech-to-speech LLM 的低 latency token emission。

### 5) Chunk-aware causal Flow Matching
CosyVoice 2 的 Flow Matching model 將 25 Hz speech tokens upsample 到 50 Hz Mel spectrogram frame rate。它用 look-ahead convolution 和 chunk-aware causal Transformer UNet，把 semantic token 對齊 acoustic features。

CFM 條件包含：

- speaker embedding
- semantic speech tokens
- masked Mel spectrogram / reference speech
- timestep

訓練時隨機 mask 掉 70%-100% final frames；推論時 masked Mel 來自 reference speech。NFE 設為 10，CFG strength beta=0.7。

為了 streaming，它把多步 flow estimation 看成 unfolded deeper network，並設計四種 attention masks：

- Non-causal mask：offline，品質最好。
- Full-causal mask：極低 latency，只看 past frames。
- Chunk-M mask：品質和 latency 折衷，適合 first chunk。
- Chunk-2M mask：犧牲更多 latency，接近 offline quality，適合 cascade chunks。

每個 mini-batch case 隨機抽一種 mask，因此單一 Flow Matching model 可支援多種部署場景，也形成 implicit self-distillation：有更多 context 的 mask 幫助少 context 的 streaming mask。

### 6) Instructed generation
CosyVoice 2 加入 1500 hours instructed training data。指令格式包含：

- Natural language instruction：emotion、speaking rate、dialect、role-playing。
- Fine-grained instruction：`[laughter]`、`[breath]`、`<strong>...</strong>`、`<laughter>...</laughter>`。

這對 TTS data pipeline 很有用，因為它示範了如何把 vocal event / speaking style / emotion control 寫進 transcript format，而不是只靠純文字。

### 7) Speaker fine-tuning and RL
對 specific speaker，作者做 multi-speaker fine-tuning (mSFT)，使用 speaker-prompt tags，例如 `Speaker A<|endofprompt|>`，避免多 speaker timbre confusion。學習率 1e-5。

對某些 speaker，SFT 會提高 speaker similarity 但 WER 變差。作者因此嘗試兩種 RL / reward：

- DPO：用 WER 和 SS 區分 preferred / rejected synthesized samples。
- Differentiable ASR reward：把 LM predicted token 還原成 quantized low-rank representation，接 frozen ASR backend 直接算 ASR posterior loss。

作者認為 differentiable ASR reward 在 out-of-domain hard cases 上比 DPO generalize 更好。

## Training / Data

### Speech tokenizer data
FSQ speech tokenizer 用 200,000 hours 訓練：

- Chinese：110,884 hours。
- English：99,918 hours。

雖然 tokenizer 只用中英訓練，作者說它對 Japanese / Korean synthesis 仍有 zero-shot capability。

### CosyVoice 2 training data
CosyVoice 2 使用與 CosyVoice 1 相同的訓練資料，總量約 166,800 hours：

- Chinese：130,000 hours。
- English：30,000 hours。
- Japanese：4,600 hours。
- Korean：2,200 hours。

資料處理：

- 先用 internal speech processing tools 蒐集 speech-only data。
- Paraformer 產生中文 pseudo text labels。
- SenseVoice 產生其他語言 pseudo text labels。
- internal force-alignment model 過濾 low-quality data，並提升 punctuation accuracy。

這裡雖然有 pipeline 描述，但細節相對保守：沒有完整公開 filtering thresholds、SNR/overlap/diarization/separation 細節，也沒有釋出整個 166.8k-hour dataset。

### Evaluation
主要 benchmark：

- LibriSpeech test-clean：limited English domain；Whisper-large-v3 算 WER，ERes2Net 算 speaker similarity，NMOS 算 objective quality。
- SEED test sets：test-zh 約 2000 samples、test-en 約 1000 samples、test-hard 約 400 challenging cases。
- Japanese / Korean：各 1000 samples。
- Instructed generation：in-house Chinese 290 samples，29 types instructions，每類 10 texts，5 audio prompts / speaker embeddings。

## 主要結果

### 1) FSQ tokenizer 明顯優於 VQ tokenizer
在 SenseVoice-Large encoder 中比較 VQ vs FSQ：

- VQ：4096 codebook，只用 963 個，utilization 23%。
- FSQ：6561 codebook，使用 6561 個，utilization 100%。
- CommonVoice EN ASR error：18.26 -> 10.67。
- CommonVoice CN ASR error：11.56 -> 7.29。
- FLEURS EN：7.65 -> 6.58。
- FLEURS CN：5.03 -> 4.43。

更重要的是，FSQ 後 speaker information 被削弱，SID 不容易收斂，表示 token 更偏 semantic、較少攜帶 speaker identity。這是它適合 zero-shot TTS 的關鍵。

### 2) LibriSpeech test-clean
CosyVoice 2 在 open-source baselines 中表現很強：

- Human：WER 2.66、NMOS 3.84、SS 0.697。
- CosyVoice：WER 2.89、NMOS 3.93、SS 0.743。
- CosyVoice 2：WER 2.47、NMOS 3.96、SS 0.745。
- CosyVoice 2-S streaming：WER 2.45、NMOS 3.90、SS 0.751。

作者因此宣稱 human-parity synthesis quality；但要注意這裡是 objective / model-based metrics，不等於完整 human MOS。

### 3) SEED test sets
在 SEED：

- test-zh：CosyVoice 2 CER 1.45、SS 0.748；CosyVoice 2-S CER 1.45、SS 0.753。
- test-en：CosyVoice 2 WER 2.57、SS 0.652；CosyVoice 2-S WER 2.38、SS 0.654。
- test-hard：CosyVoice 2 WER 6.83、SS 0.724；CosyVoice 2-S WER 8.08、SS 0.732。

作者指出 English 排名沒有中文強，可能因為 training data 中文 130k hours、英文 30k hours，資料比例不平衡。Streaming mode 在一般 zh/en cases 幾乎 lossless，但 hard cases content consistency 下降。

### 4) Modular ablation
從 CosyVoice 1 到 CosyVoice 2 的逐步改動：

- CosyVoice：test-zh CER 3.63、test-en WER 4.29、test-hard WER 11.75。
- + LLM initialization：zh 2.96、hard 9.94，但 en 4.57 略差。
- + Drop speaker embedding：zh 2.56、en 3.81、hard 9.66。
- + FSQ：zh 1.45、en 2.57、hard 6.83。
- + Pitch loss：zh 1.19、en 2.40、hard 6.29，但 speaker similarity 略降。

這個 ablation 很有價值：真正大幅改善 content consistency 的是 FSQ tokenizer，加 pitch loss 可再提升 WER/CER，但要注意 speaker similarity / acoustic tradeoff。

### 5) Streaming module ablation
Chunk size 15：

- Offline LM + Offline FM：zh 1.45 / en 2.57 / hard 6.83。
- Offline LM + Streaming FM：zh 1.46 / en 2.60 / hard 7.12。
- Streaming LM + Offline FM：zh 1.38 / en 2.51 / hard 7.88。
- Streaming LM + Streaming FM：zh 1.45 / en 2.38 / hard 8.08。

結論是 streaming LM / FM 對一般 case 影響小，hard cases 主要因 streaming LM loss of contextual information 而退化；streaming FM 對 speaker similarity 反而略有利，可能因 first chunks 的 prompt-to-generation ratio 比 offline 高。

### 6) Japanese / Korean
CosyVoice 2 支援 Japanese / Korean，但品質差異明顯：

- Japanese：CER 18.79、SS 0.630、NMOS 3.42。
- Japanese streaming：CER 21.41、SS 0.629、NMOS 3.35。
- Korean：CER 7.98、SS 0.707、NMOS 3.73。
- Korean streaming：CER 9.06、SS 0.714、NMOS 3.60。

作者認為 Japanese 和 Chinese character set overlap 會導致 Japanese context 中出現中文發音；Korean 沒有這個問題，因此效果更好。

### 7) Instruction control
Instructed generation on 290 Chinese samples：

- CosyVoice-Instruct：CER 1.72、SS 0.797、NMOS 3.94、MOS-I 3.09。
- CosyVoice 2：CER 1.52、SS 0.804、NMOS 3.94、MOS-I 4.06。
- CosyVoice 2 w/o Instruction：CER 0.97、SS 0.817、NMOS 4.02、MOS-I 2.28。

這說明 instruction control 不會自動從 content text emerge。移除 instruction 後 CER/SS/NMOS 變好，但模型不再遵守 emotion/rate/dialect/style/fine-grained vocal events。

### 8) SFT + RL
對 Spk E：

- CosyVoice 2 base：WER 5.34、NMOS 3.91、SS 0.721。
- CosyVoice 2-SFT：WER 7.15、NMOS 3.96、SS 0.795。
- + ASR reward + DPO：WER 6.64、NMOS 3.97、SS 0.796；SEED zh/en/hard WER/CER 1.25 / 3.17 / 6.66。

重點是：speaker fine-tuning 會改善 speaker similarity，但可能傷害 content consistency；ASR reward 可以部分修回 pronunciation / content errors。

## Project relevance

### project-tts-data-pipeline：非常高相關
這篇是 TTS pipeline 的 strong reference，但要注意它公開的是 system-level 方法與資料規模，不是完整 data-cleaning recipe。

可直接借鑑：

- pseudo-labeling：中文用 Paraformer，其他語言用 SenseVoice。
- forced alignment filtering：用來過濾 low-quality samples 並修 punctuation。
- supervised semantic tokenizer：用 ASR objective 訓練 tokenizer，讓 tokens 更 content-oriented。
- transcript format：natural language instruction + `<|endofprompt|>`，fine-grained vocal events 用 `[laughter]`、`[breath]`、`<strong>`、`<laughter>`。
- speaker SFT：用 speaker-prompt tags 防止 multi-speaker timbre confusion。

對我們的 English TTS data cleaning，值得追問的是：他們沒有公開完整 SNR、overlap、diarization、speaker purity、alignment threshold。因此這篇比較像「高層 pipeline + tokenizer/model recipe」，不是像 PilotTTS 那種完整可複製 cleaning spec。

### project-full-duplex-data：中高相關
CosyVoice 2 本身不是 full-duplex model，但它對 full-duplex data synthesis 很重要，因為 Lychee-FD 用 CosyVoice 2 合成 full-duplex dialogue audio。

對我們 mono-channel dialogue -> dual-channel data 的方向：

- CosyVoice 2 可以當 synthetic dual-channel conversation generator 的 base TTS。
- Streaming LM + chunk-aware FM 對低 latency backchannel / interruption synthesis 有價值。
- Fine-grained instruction tags 可以擴展成 full-duplex transcript/control format，例如 `[backchannel]`、`[interruption]`、`<overlap speaker=\"B\">...`。
- 但它沒有直接建模 overlap mixture，也沒有 speaker A/B simultaneous generation objective；要做 full-duplex generator 仍需加 dual-channel / mixture loss。

### project-generative-speech-representation-evaluation：高相關
CosyVoice 2 是一個很好的 representation case：

- FSQ supervised semantic tokens：speaker-independent、content-heavy、25 Hz。
- Flow Matching acoustic model：用 speaker embedding / reference speech 補回 timbre。

這剛好可以測我們的 representation evaluation idea：

- FSQ tokens 是否比 VQ tokens 更容易訓練 downstream TTS。
- 25 Hz supervised semantic token 對 content consistency 很強，但是否保留 prosody / emotion / backchannel timing？
- speaker-independent tokens 對 zero-shot voice cloning 是好事，但對 expressive full-duplex overlap 是否會丟太多 paralinguistic information？
- tokenizer 加 pitch loss 改善 content metrics，但是否造成 speaker similarity 或自然度 tradeoff？

### project-audio-model-evaluation：高相關
這篇直接指出 speaker similarity evaluation 會因 SV model 而不一致，因此後續統一用 ERes2Net。這對我們做 audio evaluation 很重要：同一個 TTS output，在不同 speaker verification model 下 ranking 可能不同。

也值得把它接到 AnyAudio-Judge / localized evaluation：CosyVoice2 的 instruction control 需要判斷「是否真的 happy / fast / dialect / laughter / emphasis」，這種 rubric 不應只有整句 yes/no，最好能定位哪個 phrase / timestamp 沒有遵守。

## Related papers in my pool
- [Seed-TTS](../arxiv_2406_02430/)：CosyVoice 2 用 SEED test sets 評估，也把 Seed-TTS 當 closed-source strong baseline。
- [Lychee-FD](../arxiv_2607_06540/)：Lychee-FD 使用 CosyVoice2 tokenizer 與 CosyVoice 2 合成 full-duplex training data。
- [ReGen](../arxiv_2607_09134/)：ReGenVoice 對比 CosyVoice2，並以低 frame-rate latent diffusion 挑戰 streaming / efficient TTS。
- [VoxCPM](../arxiv_2509_24650/)：同屬 modern TTS / voice cloning baseline pool；VoxCPM 走 tokenizer-free/context-aware 路線，可和 CosyVoice2 的 supervised semantic token 路線比較。
- [UniAudio-Token](../arxiv_2605_31521/)：直接把 CosyVoice2 當 tokenizer / TTS baseline，對比 discrete token 的 semantic/audio generalization。
- [dots.tts](../arxiv_2606_07080/)：continuous AudioVAE + MeanFlow route，可和 CosyVoice2 的 FSQ token + FM route 比較。
- [LongCat-AudioDiT](../arxiv_2603_29339/)：audio diffusion / DiT 系列，和 CosyVoice2 的 causal FM acoustic decoder 形成方法對照。

## OpenReview / reviewer discussion
找到 OpenReview revision page `8SlnGkMo85`，但 `npm run paper:openreview -- arxiv_2412_10117` 透過 OpenReview API 讀取 forum notes 時回傳 403。因此目前沒有公開 reviewer / rebuttal / decision notes 可摘要。不要根據 revision page 自行推測 review 意見。

## 我該不該細讀
建議細讀，尤其是你要做 TTS data pipeline、full-duplex data synthesis、speech representation evaluation 的話。

最值得讀：

- FSQ tokenizer 如何放進 ASR encoder。
- VQ vs FSQ 的 codebook utilization / ASR error / SID 分析。
- Unified streaming / non-streaming LM sequence construction。
- Chunk-aware Flow Matching 的四種 masks。
- Instructed generation transcript format。
- Training data / pseudo-label / force-alignment pipeline。
- Speaker similarity metric inconsistency 的討論。

## 可能的弱點 / open questions

### 1) Data cleaning 細節仍不足
論文提到 internal speech processing tools、pseudo-labeling、force-alignment filtering，但沒有公開完整 filtering thresholds、noise/overlap/speaker diarization/separation 規則。若我們要做可複製 pipeline，還需要從其他 paper 補細節。

### 2) Supervised semantic token 可能犧牲 paralinguistic information
FSQ tokenizer 被設計成 speaker-independent，對 zero-shot TTS 有利；但 full-duplex dialogue 需要 backchannel nuance、hesitation、overlap timing、emotion leakage。過度 semantic 的 token 是否會丟掉這些資訊，需要測。

### 3) English / Japanese data imbalance
中文資料 130k hours，英文 30k hours，日文 4.6k，韓文 2.2k。英文 SEED test-en 不如中文強，日文又有 character overlap pronunciation issue。這提醒 multilingual TTS 不能只看總資料量，也要看 script overlap、language balance 和 tokenizer behavior。

### 4) Streaming hard cases 仍退化
Streaming mode 在一般 test-zh/test-en 近乎 lossless，但 test-hard 從 WER 6.83 退到 8.08。對 voice assistant，hard case 通常包含重複、tongue twister、特殊格式，這正是容易出錯的地方。

### 5) Instruction control 和 content fidelity 有 tradeoff
移除 instruction 讓 CER/SS/NMOS 變好，但 MOS-I 大幅下降。這表示控制能力不是免費的：如果 transcript 裡加 emotion / style / vocal event tags，模型可能要在 content fidelity 和 controllability 之間取捨。

### 6) Speaker similarity metric 不穩
作者自己指出不同 SV models 的 speaker similarity results 不一致。這對我們設計 evaluation 很關鍵：不要只用單一 SIM 數字判斷 voice cloning 或 speaker preservation。

## Tags
- tts
- speech-llm
- streaming-tts
- flow-matching
- speech-tokenizer
- supervised-semantic-token
- finite-scalar-quantization
- zero-shot-tts
- voice-cloning
- instructed-tts
- multilingual-tts
- project-tts-data-pipeline
- project-full-duplex-data
- project-generative-speech-representation-evaluation
- project-audio-model-evaluation

## Concepts
- CosyVoice 2
- supervised semantic speech tokenizer
- finite scalar quantization
- FSQ
- VQ vs FSQ
- SenseVoice-Large encoder
- Qwen2.5-0.5B
- text-speech language model
- streaming TTS
- non-streaming TTS
- chunk-aware Flow Matching
- causal Flow Matching
- classifier-free guidance
- semantic-acoustic decoupling
- 25 Hz speech tokens
- 50 Hz Mel spectrogram
- instruction control
- vocal bursts
- speaker fine-tuning
- differentiable ASR reward
- DPO for TTS
- speaker similarity evaluation

## Citation
目前以 arXiv technical report 記錄；若之後找到正式 proceedings，再更新 citation。

```bibtex
@misc{du2024cosyvoice2scalablestreamingspe,
  title={CosyVoice 2: Scalable Streaming Speech Synthesis with Large Language Models},
  author={Zhihao Du and Yuxuan Wang and Qian Chen and Xian Shi and Xiang Lv and Tianyu Zhao and Zhifu Gao and Yexin Yang and Changfeng Gao and Hui Wang and Fan Yu and Huadai Liu and Zhengyan Sheng and Yue Gu and Chong Deng and Wen Wang and Shiliang Zhang and Zhijie Yan and Jingren Zhou},
  year={2024},
  eprint={2412.10117},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2412.10117}
}
```

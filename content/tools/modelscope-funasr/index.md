---
title: FunASR
tool_key: modelscope-funasr
url: "https://github.com/modelscope/FunASR"
created: 2026-06-11
tags:
  - asr
  - speech-data
  - diarization
  - vad
  - preprocessing
  - tool
  - project-tts-data-pipeline
  - project-full-duplex-data
  - project-audio-model-evaluation
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> 生成註記：本 note 由 Codex 根據 GitHub README / docs links 整理；summary model: GPT-5 Codex。這是工具 / repo note，不是 formal paper note。

## Links

- GitHub repo: [modelscope/FunASR](https://github.com/modelscope/FunASR)
- Documentation: [https://modelscope.github.io/FunASR/](https://modelscope.github.io/FunASR/)
- ModelScope organization / model links: [https://www.modelscope.cn/organization/iic](https://www.modelscope.cn/organization/iic)
- Hugging Face organization: [https://huggingface.co/FunAudioLLM](https://huggingface.co/FunAudioLLM)

## 一句話總結

**FunASR** 是 ModelScope / Alibaba 系列的 industrial speech recognition toolkit，README 主打 fast ASR、50+ languages、speaker diarization、emotion detection、streaming、OpenAI-compatible API，以及一行 `AutoModel.generate()` 把 VAD、ASR、punctuation、speaker labels 和 timestamps 串起來。

## 為什麼值得放進 knowledge

FunASR 對我們不是 TTS generator，而是很實用的 **speech data preprocessing / evaluation infrastructure**：

- 能直接跑 ASR transcription，支援 batch / streaming / server。
- 內建或整合 `fsmn-vad`、`ct-punc`、`cam++` speaker diarization、`emotion2vec`。
- `SenseVoiceSmall` 可做 ASR + emotion + events，覆蓋 zh/en/ja/ko/yue。
- `Fun-ASR-Nano` 是 LLM-based ASR，README 說結合 SenseVoice encoder 和 Qwen3 decoder，支援 31 languages。
- 也列出 `Qwen3-ASR`、`GLM-ASR-Nano`、Whisper large-v3 / turbo、Paraformer 等 model choices。
- 有 CLI、OpenAI-compatible `/v1/audio/transcriptions` server、MCP / agent integration、WebSocket streaming deployment。
- README 報告 benchmark：SenseVoice-Small GPU `170x realtime`、CPU `17x realtime`；Paraformer-Large GPU `120x realtime`、CPU `15x realtime`；Fun-ASR-Nano 可用 vLLM acceleration。

## 使用方式

最小 Python pipeline：

```python
from funasr import AutoModel

model = AutoModel(
    model="iic/SenseVoiceSmall",
    vad_model="fsmn-vad",
    spk_model="cam++",
    device="cuda",
)
result = model.generate(input="meeting.wav")
```

CLI / batch：

```bash
funasr audio.wav
funasr audio.wav --output-format json
funasr audio.wav --output-format srt --output-dir ./subs
funasr audio.wav --spk --timestamps -f json
funasr *.wav --output-format srt --output-dir ./output
```

OpenAI-compatible local server：

```bash
pip install torch torchaudio
pip install funasr vllm fastapi uvicorn python-multipart
funasr-server --device cuda
```

Then POST audio to:

```text
POST /v1/audio/transcriptions
```

## Project relevance

### project-tts-data-pipeline：高度相關

FunASR 可以當 TTS data cleaning 的 upstream module：

- long audio segmentation：先用 VAD 切出候選 speech segments。
- transcription：產生 transcript，再用 WER / confidence / language ID 過濾。
- punctuation：把 raw ASR text 轉成比較適合 TTS transcript 的格式。
- diarization：過濾 multi-speaker contamination，或切出 single-speaker segments。
- emotion / event tags：給 expressive TTS data 補 metadata，例如 emotion、laugh、music/noise event。
- SRT / timestamps：支援 forced-alignment 前的粗時間標記。

最值得測的是：FunASR 的 diarization / timestamp / punctuation output 能不能穩定變成我們 TTS training manifest 的欄位。

### project-full-duplex-data：中高相關

FunASR 不做 speaker separation，也不會直接把 mono overlap dialogue 拆成 dual-channel tracks。但它可作 full-duplex pipeline 的 transcript / metadata 層：

```text
mono dialogue audio
  -> VAD / segmentation
  -> ASR with timestamps
  -> speaker diarization
  -> emotion/event tags
  -> candidate transcript with speaker turns
```

限制是 overlap 區間仍需要 OSD / separation / target speaker extraction；FunASR 的 diarization 在 interruption、short backchannels、overlap speech 上必須實測，不能直接當 ground truth。

### project-audio-model-evaluation：中高相關

FunASR 可作 generated speech / audio model 的 evaluator：

- TTS content fidelity：ASR transcript vs prompt transcript。
- dialogue generator：speaker-turn timestamp / diarization sanity check。
- generated audio filtering：detect ASR failure、language mismatch、punctuation instability。
- evaluation automation：OpenAI-compatible API / CLI 適合批量跑 scoring。

但它的 ASR output 不能當唯一標準；對 hard accents、overlap、nonverbal events、music background，需要和 Whisper / other ASR / human spot-check cross-validate。

## Related tools / papers in my pool

- [WhisperD / Parakeet](../jordandarefsky-parakeet-whisperd/)：WhisperD 強調 dialogue transcript format 和 speaker/event annotations；FunASR 更像 production ASR / VAD / diarization toolkit。兩者可互補。
- [Sommelier](../../papers/arxiv_2603_25750/)：Sommelier 是 full-duplex speech LM preprocessing blueprint；FunASR 可以作其中 ASR / VAD / diarization 的候選 implementation。
- [DinoSR](../../papers/arxiv_2305_10005/)：DinoSR 偏 self-supervised acoustic unit discovery；FunASR 偏 production ASR / annotation pipeline。
- [VoxCPM / VoxCPM2](../openbmb-voxcpm/)：VoxCPM 類 TTS output 可用 FunASR 做 content fidelity / multilingual ASR check。
- [Dia](../nari-labs-dia/)：dialogue TTS output 可用 FunASR 檢查 speaker labels、timestamps、transcript adherence。

## 需要後續確認

- README benchmark 是 repo 自述，需要在我們自己的 English podcast / meeting / overlap dialogue data 上重跑。
- Speaker diarization 在 overlap speech、short backchannels、interruption 附近的 speaker swap rate。
- timestamps 是否足夠精準到 TTS segmentation / forced alignment 的需求。
- emotion / event detection 的 label set、precision / recall，以及是否適合轉成 TTS tags。
- Fun-ASR-Nano / Qwen3-ASR 類 LLM decoder 是否會 hallucinate 或自動 normalize text，影響 transcript fidelity。
- Code 是 MIT license，但 model weights 可能各有 license；使用前要逐一確認 model card。

## Tags

- asr
- vad
- diarization
- punctuation
- emotion-recognition
- speech-data
- preprocessing
- streaming-asr
- openai-compatible-api
- project-tts-data-pipeline
- project-full-duplex-data
- project-audio-model-evaluation

## Concepts

- FunASR
- SenseVoiceSmall
- Fun-ASR-Nano
- Qwen3-ASR
- GLM-ASR-Nano
- Paraformer
- fsmn-vad
- cam++ speaker diarization
- ct-punc
- emotion2vec
- streaming ASR
- OpenAI-compatible transcription API
- MCP server for ASR

## Citation

```bibtex
@misc{funasr2026,
  title  = {FunASR: Industrial-grade Speech Recognition Toolkit},
  author = {{ModelScope FunASR Team}},
  year   = {2026},
  url    = {https://github.com/modelscope/FunASR},
  note   = {GitHub repository}
}
```

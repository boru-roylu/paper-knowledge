---
title: Parakeet and WhisperD
tool_key: jordandarefsky-parakeet-whisperd
url: "https://jordandarefsky.com/blog/2024/parakeet/#spotify-dataset-and-whisperd"
created: 2026-06-02
tags:
  - tts
  - speech-data
  - diarization
  - preprocessing
  - whisperd
  - project-full-duplex-data
  - project-tts-data-pipeline
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

## Links
- [Parakeet blog: Spotify Dataset and WhisperD](https://jordandarefsky.com/blog/2024/parakeet/#spotify-dataset-and-whisperd)
- [Full Parakeet blog post](https://jordandarefsky.com/blog/2024/parakeet/)

## 一句話總結
**Parakeet** 是一個 conversational TTS technical blog，重點之一是用 **WhisperD** 產生 speaker/event annotated transcription，將 podcast data 轉成可訓練 dialogue TTS 的 transcript format。

## WhisperD 做了什麼
blog 描述 Spotify Podcast Dataset 約有 60,000 小時 audio，但原始 machine transcription 品質不足，不適合直接訓練 generative TTS model。

他們的處理方式是：

- 先用 pyannote 把 podcast audio 切成最多 30 秒 segments
- 目標 transcript format 包含 speaker labels 和 events，例如 `[S1] ... [S2] (laughs) ...`
- 直接 prompt Whisper 產生這種格式效果不好
- 因此 fine-tune Whisper-v2-large，得到 **WhisperD**，也就是 dialogue-oriented Whisper
- WhisperD 的初版使用 two-stage fine-tuning：先用較低品質 automatic transcriptions，再用較高品質 human transcriptions
- automatic portion 約 20 小時，human portion 略少於 2 小時
- 之後用 WhisperD 回頭 transcribe 全部 VAD-split podcast segments

## 對 TTS data pipeline 的啟發
這篇很重要，因為它不是只在講 model，而是在講「怎麼把 noisy podcast audio 變成可訓練 conversational TTS 的資料」。

可直接借鑑的設計：

- transcript format 應該顯式標 speaker：`[S1]`、`[S2]`
- transcript 應該保留 nonverbal events：`(laughs)`、`(coughs)`、`(sighs)`
- 對話 TTS 的 transcription model 可能需要專門 fine-tune，不能只靠 off-the-shelf Whisper prompting
- automatic transcription 可以先做粗校準，再用少量 human annotation 做 quality pass
- 可以訓練不同 style 的 WhisperD variants，讓 generative model 對 transcript style 更 robust

## Parakeet model note
Parakeet 的 goal 是用 text prompt 生成最多約 30 秒 conversational audio，可以包含 multiple speakers 和 nonverbal events。

modeling 方向：

- 使用 DAC audio tokens，而不是直接預測 raw waveform
- train autoregressive transformer conditioned on raw transcription text
- 使用 classifier-free guidance 變體改善 quality
- dataset 來源包含 Spotify Podcast Dataset、LibriVox、Common Voice

## Project relevance
- **project-full-duplex-data**：高度相關。WhisperD-style speaker/event transcription 可以成為你從 mono-channel conversation 中抽取 speaker turns、backchannels、events 的中間表示。
- **project-tts-data-pipeline**：高度相關。這篇直接提供了一個 podcast-to-dialogue-TTS-data 的 pipeline blueprint。

## 和 Echo-TTS 的關係
Echo-TTS README 明確提到 text prompt format 使用 WhisperD 的格式。因此 Parakeet / WhisperD 這篇可以視為 Echo-TTS prompt format 和 data style 的上游背景。

## 需要後續確認
- WhisperD 是否有公開 weights / model card
- WhisperD 對 overlapping speech、backchannel、speaker diarization error 的實際處理能力
- pyannote segmentation 和 WhisperD transcription 的 error propagation
- 如果要產生 dual-channel / overlap-aware data，WhisperD-style single transcript 是否足夠，還是需要時間戳與 channel-level annotation

## Citation
```bibtex
@misc{darefsky2024parakeet,
  author = {Darefsky, Jordan and Zhu, Ge and Duan, Zhiyao},
  title = {Parakeet},
  year = {2024},
  url = {https://jordandarefsky.com/blog/2024/parakeet/}
}
```

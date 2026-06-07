---
title: VoxCPM / VoxCPM2
tool_key: openbmb-voxcpm
url: "https://github.com/OpenBMB/VoxCPM"
created: 2026-06-03
tags:
  - tts
  - speech-llm
  - voice-cloning
  - multilingual-speech
  - tool
  - project-tts-data-pipeline
  - project-full-duplex-data
  - project-generative-speech-representation-evaluation
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

## Links
- [GitHub repo: OpenBMB/VoxCPM](https://github.com/OpenBMB/VoxCPM)
- [Hugging Face model: openbmb/VoxCPM2](https://huggingface.co/openbmb/VoxCPM2)
- [ModelScope model: OpenBMB/VoxCPM2](https://modelscope.cn/models/OpenBMB/VoxCPM2)
- [Live playground](https://huggingface.co/spaces/OpenBMB/VoxCPM-Demo)
- [VoxCPM2 audio samples](https://openbmb.github.io/voxcpm2-demopage/)
- [Documentation](https://voxcpm.readthedocs.io/en/latest/)
- [Technical report for VoxCPM-0.5B](https://arxiv.org/abs/2509.24650)

## 一句話總結
**VoxCPM2** 是 OpenBMB 釋出的 open-source multilingual TTS / voice cloning model，主打 tokenizer-free diffusion autoregressive speech generation、30 languages、natural-language Voice Design、Controllable Voice Cloning、Ultimate Cloning，以及 48 kHz output。

## 為什麼值得放進 knowledge
VoxCPM2 對 TTS data pipeline 和 speech generation baseline 都很有參考價值：

- 最新 release 是 **2B parameter** model，README 稱訓練於超過 **2 million hours multilingual speech data**。
- 支援 **30 languages**，輸入文本不需要 language tag。
- 支援 **Voice Design**：用自然語言描述 gender、age、tone、emotion、pace 來生成新 voice，不需要 reference audio。
- 支援 **Controllable Voice Cloning**：reference audio 保留 timbre，文字控制 emotion / speed / style。
- 支援 **Ultimate Cloning**：reference audio + prompt transcript 做 audio-continuation-style cloning，保留 timbre、rhythm、emotion、style。
- 48 kHz output，README 說透過 AudioVAE V2 asymmetric encode/decode 和 built-in super-resolution，不需要外部 upsampler。
- 有 streaming API、CLI、Web demo、Nano-vLLM serving、vLLM-Omni OpenAI-compatible `/v1/audio/speech` endpoint。
- code 和 weights 以 Apache-2.0 釋出，README 標示 commercial-ready。

## 核心方法 / architecture note
README 把 VoxCPM2 描述為 **tokenizer-free, diffusion autoregressive** TTS system。模型不走 discrete speech token，而是在 **AudioVAE V2 latent space** 裡運作，pipeline 是：

- **LocEnc**
- **TSLM**
- **RALM**
- **LocDiT**

這點和很多 semantic/acoustic token TTS systems 不一樣。對你的研究來說，值得追蹤它是否真的避免了 discrete tokenizer 的 artifacts，尤其是在 expressiveness、voice cloning similarity、long-form stability、和 multilingual pronunciation 上。

## 使用方式
最小 Python API：

```python
from voxcpm import VoxCPM
import soundfile as sf

model = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False)
wav = model.generate(
    text="VoxCPM2 is the current recommended release for realistic multilingual speech synthesis.",
    cfg_value=2.0,
    inference_timesteps=10,
)
sf.write("demo.wav", wav, model.tts_model.sample_rate)
```

Voice Design 的 prompt format 是把 voice description 放在 text 開頭的括號裡，例如：

```text
(A young woman, gentle and sweet voice)Hello, welcome to VoxCPM2!
```

CLI / deployment 也比較完整：

- `voxcpm design`：無 reference audio 的 voice design。
- `voxcpm clone`：reference audio voice cloning。
- `generate_streaming()`：streaming synthesis。
- Nano-vLLM：README 標示 RTX 4090 上 RTF 約 0.13。
- vLLM-Omni：支援 OpenAI-compatible audio speech endpoint。

## Models / Performance
README 的版本比較：

- **VoxCPM2**：2B, 48 kHz, 30 languages, Voice Design, Controllable Voice Cloning, SFT / LoRA, RTX 4090 RTF 約 0.30，Nano-vLLM 約 0.13，VRAM 約 8 GB。
- **VoxCPM1.5**：0.6B, 44.1 kHz, zh/en, continuation cloning, SFT / LoRA。
- **VoxCPM-0.5B**：0.5B, 16 kHz, zh/en, continuation cloning, SFT / LoRA。

README 提供的 benchmark 摘要：

- Seed-TTS-eval：VoxCPM2 在 test-EN WER 1.84 / SIM 75.3，test-ZH CER 0.97 / SIM 79.5，test-Hard CER 8.13 / SIM 75.3。
- CV3-eval：多語言 WER/CER 結果中，VoxCPM2 整體表現接近 CosyVoice3 / FishAudio S2 等強 baseline，但不是所有語言都最佳。
- Internal 30-language ASR benchmark：30 languages x 500 samples，用 Gemini 3.1 Flash Lite API 做 ASR transcription evaluation，README 報告平均 1.68%。
- InstructTTSEval：Voice Design 指標上，英文 APS 84.2、DSD 83.2、RP 71.4，中文 APS 85.2、DSD 71.5、RP 60.8。

## Project relevance
- **project-tts-data-pipeline**：高度相關。VoxCPM2 的 training scale、multilingual coverage、voice description controls、cloning modes、LoRA/SFT fine-tuning 都可以反推需要什麼 transcript / metadata / speaker reference / style label 格式。
- **project-full-duplex-data**：中度相關。它不是 full-duplex dialogue model，但 streaming TTS、expressive prosody、controllable cloning、voice design 都可作為 full-duplex agent 的 speech output baseline。仍需額外測 backchannel timing、overlap、interruptibility、turn-taking latency。
- **project-generative-speech-representation-evaluation**：高度相關。VoxCPM2 的 tokenizer-free continuous speech representation / AudioVAE V2 可以作為 discrete codec tokens 之外的 candidate encoder，適合測 reconstruction quality、speaker/content/prosody interpolation、voice cloning controllability 與 downstream generation quality 之間的關係。

## Related papers / tools in my pool
- **Echo-TTS**：同樣關心 prompt format 和 speaker reference conditioning，可比較 WhisperD-style transcript vs VoxCPM2 natural-language voice description。
- **Dia**：dialogue TTS baseline；可比較 multi-speaker / nonverbal event 控制與 VoxCPM2 的 voice design / cloning。
- **Chatterbox TTS**：open-source TTS family；可比較 paralinguistic tags、low-latency inference、voice-agent use case。
- **Miipher / Miipher-2**：資料清理端。VoxCPM2 需要高品質 multilingual speech data；Miipher 類 speech restoration 是可能的 upstream data cleaning module。

## 需要後續確認
- VoxCPM2 technical report 目前 README 標示 coming soon；正式 paper 出來後應該補成 paper page。
- Voice Design 的自然語言 description 是否能穩定對應到可重現的 speaker/style attributes。
- Controllable Voice Cloning 的 style control 是否會犧牲 speaker similarity。
- 是否能穩定支援 long-form speech、dialogue turn changes、nonverbal events、overlap speech。
- 官方 safety note 明確禁止 impersonation、fraud、disinformation；如果用於資料生成，需要保留 provenance / watermarking / consent policy。

## Tags
- tts
- tokenizer-free-tts
- voice-cloning
- multilingual-speech
- voice-design
- streaming-tts
- project-tts-data-pipeline
- project-full-duplex-data
- project-generative-speech-representation-evaluation

## Concepts
- tokenizer-free TTS
- diffusion autoregressive speech generation
- AudioVAE V2
- Voice Design
- Controllable Voice Cloning
- Ultimate Cloning
- 48 kHz speech generation
- Nano-vLLM serving
- vLLM-Omni OpenAI-compatible audio API

## Citation
```bibtex
@article{voxcpm2_2026,
  title   = {VoxCPM2: Tokenizer-Free TTS for Multilingual Speech Generation, Creative Voice Design, and True-to-Life Cloning},
  author  = {VoxCPM Team},
  journal = {GitHub},
  year    = {2026},
}
```

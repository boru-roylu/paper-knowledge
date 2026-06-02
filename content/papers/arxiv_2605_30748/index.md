---
paper_key: arxiv_2605_30748
canonical_id: "arxiv:2605.30748"
title: "Chatterbox-Flash: Prior-Calibrated Block Diffusion for Streaming Zero-Shot TTS"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.30748"
pdf_url: "https://arxiv.org/pdf/2605.30748"
status: pending-summary
rating: 0
tags:
  - speech-llm
  - tts
  - project-tts-data-pipeline
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2605.30748)
- [PDF](https://arxiv.org/pdf/2605.30748)
## Status
已完成 deterministic ingest：metadata、source archive、source extraction 都已存好。Summary 尚未生成或等待 retry。
## Abstract
We present Chatterbox-Flash, a zero-shot text-to-speech model obtained by fine-tuning a pretrained autoregressive TTS decoder into a block-diffusion decoder, enabling parallel token generation within each block while retaining block-by-block streaming. We find that naively transferring mainstream block-diffusion decoding to discrete speech tokens degrades quality, as a long-tail token distribution biases parallel position selection toward a few high-frequency tokens. To mitigate this without architectural modification, we introduce two inference-time techniques: prior-calibrated scoring, which subtracts the block-level marginal token distribution, and an early-decoding schedule, which adaptively terminates iteration based on calibrated confidence. On standard zero-shot TTS benchmarks, Chatterbox-Flash attains high-fidelity synthesis comparable to strong autoregressive and non-autoregressive baselines, while supporting streaming inference with time-to-first-packet on par with streaming AR systems and substantially lower real-time factor. Code and audio samples are available at https://github.com/resemble-ai/chatterbox-flash.
## Citation
目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。
```bibtex
@misc{seo2026chatterboxflashpriorcalibrated,
  title={Chatterbox-Flash: Prior-Calibrated Block Diffusion for Streaming Zero-Shot TTS},
  author={Deokjin Seo and Gangin Park and Kihyun Nam},
  year={2026},
  eprint={2605.30748},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2605.30748}
}
```
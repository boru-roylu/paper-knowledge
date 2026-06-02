---
paper_key: arxiv_2605_31173
canonical_id: "arxiv:2605.31173"
title: "MindVoice: Reconstructing Intelligible Speech from Non-invasive Neural Signals with Pretrained Priors"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.31173"
pdf_url: "https://arxiv.org/pdf/2605.31173"
status: pending-summary
rating: 0
tags:
  - speech-llm
  - tts
  - speech-data
  - project-tts-data-pipeline
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

## Links

- [arXiv abstract](https://arxiv.org/abs/2605.31173)
- [PDF](https://arxiv.org/pdf/2605.31173)

## Status

已完成 deterministic ingest：metadata、source archive、source extraction 都已存好。Summary 尚未生成或等待 retry。

## Abstract

Reconstructing continuous speech from non-invasive neural recordings is a fundamental problem for probing human auditory perception and building safe, scalable speech brain-computer interfaces. Despite recent progress, intelligible reconstruction remains elusive, as non-invasive recordings are inherently noisy, spatially blurred, and only partially preserve information about perceived speech. Existing methods directly map neural activity to entangled speech representations before synthesizing waveforms with neural vocoders, resulting in spectral-similar but unintelligible results. To overcome these limitations, we introduce MindVoice, a neuro-to-speech reconstruction framework that uses pretrained models to compensate for the incomplete semantic and acoustic information in neural recordings. MindVoice disentangles reconstruction into two complementary pathways: one recovers high-level semantic content, while the other estimates fine-grained acoustic attributes. These inferred representations are then fused with powerful speech generation models and in-context voice cloning to synthesize natural and intelligible utterances. Extensive experiments on EEG and MEG demonstrate that MindVoice substantially outperforms existing methods on various metrics. These results show that pretrained priors provide a principled way to bridge the gap between noisy neural recordings and natural speech, highlighting a promising attempt for auditory neuroscience research and non-invasive speech brain-computer interfaces.

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{bao2026mindvoice,
  title={MindVoice: Reconstructing Intelligible Speech from Non-invasive Neural Signals with Pretrained Priors},
  author={Guangyin Bao and Taiping Zeng and Jianfeng Feng and Xiangyang Xue},
  year={2026},
  eprint={2605.31173},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2605.31173}
}
```

---
title: "Project: Full-duplex data and model"
---

## Motivation

我們想要訓練更自然的 full-duplex speech model。真正的人類對話不是乾淨的 turn-by-turn：會有 backchannel、overlap speech、interruption、repair、hesitation，以及一方還沒完全講完另一方就開始回應的情況。這些現象如果只靠文字 transcript 或單純 turn-level dialogue data，很難學到 timing 和 interaction policy。

目前可取得的大量資料常常是 mono-channel / monaural conversation audio。這些資料有用，但問題是兩個 speaker 混在同一條 audio track 裡，尤其 overlap 區域很難知道誰說了什麼、誰在 backchannel、哪裡是自然的 interruption。因此這條 project line 的核心是：把自然 mono-channel 對話轉成可用於 full-duplex model training 的 speaker-wise / dual-channel data，並進一步研究如何合成自然的 overlap 與 backchannel。

## Target

- 從 mono-channel two-speaker dialogue 中分離 speaker-wise tracks。
- 特別處理 overlap speech，而不是把 overlap 當成 noise 移除。
- 建立可訓練 full-duplex model 的 dual-channel conversation data。
- 給定 transcript，自動 synthesize 出自然、有 backchannel、有 overlap timing 的 dual-channel conversation。
- 因為 transcript / generation plan 是我們控制的，所以可以知道哪裡應該有 backchannel、interruption、overlap，進而產生 supervision。

## Questions

- 怎麼從 real mono-channel audio recovery 出可靠的 speaker-wise tracks？
- 怎麼評估 separation 是否保留 linguistic content，而不是只讓音質指標變好？
- 怎麼建模 backchannel / interruption / overlap timing？
- 能不能從 transcript 直接生成 dual-channel full-duplex audio？
- 什麼樣的 synthetic full-duplex data 對 training 最有效？

## Related Tags

#speech-llm #full-duplex #turn-taking #speech-data #separation #restoration

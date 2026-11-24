# Solature

**Circle the tape. Keep your orbit.**

[![Live site](https://img.shields.io/badge/live-solature.fun-blueviolet)](https://solature.fun)

Chain: **Solana** (mainnet) · Contract address: **TBA** (placeholder, shown inert until stated)

## Overview

Solature is a single-page orbit around live Solana markets. Ten of the most boosted Solana tokens are read every minute, and the first seat on the board is reserved for Solature itself. Every outside fact (contract address, social links, market source) lives in one register record marked `stated`, `absent` or `unconfirmed`; anything not stated renders inert.

## Features

- Live market board and ticker, polled every 60 seconds, paused while the tab is hidden, with exponential backoff and last-good-data retention
- Pinned own-token row: DexScreener and pump.fun are fetched in parallel once a contract address is stated; a branded placeholder before that
- Address check that compares any string with the stated record instead of rejecting by shape
- Spring-physics reveals, hero parallax, spotlight hovers, count-up with flash, scroll progress bar
- Full `prefers-reduced-motion` fallback; no dates or timestamps anywhere on the page

## Links

- Site: https://solature.fun
- X: https://x.com/usesolature
- GitHub: not stated yet

## Development

```
npm install
npm run build   # writes dist/ and runs the gate checks for both CA branches
npm run preview # serves dist/ locally
```

Colour literals live only in `src/tokens.css`. The deploy folder is `dist/`.

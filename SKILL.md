---
name: postmint
description: Mint any public X/Twitter post as an ERC-1155 NFT on Base. Trigger phrases include "postmint this", "postmint this tweet/post", "mint this post", "mint this tweet", "turn this post into an NFT", or providing an x.com/twitter.com status URL and asking to mint it. Given a tweet URL, the agent fetches the tweet's image + text (or the quoted tweet's image, or a rendered screenshot for text-only tweets), builds fully on-chain metadata, and mints it into the user's own personal "Tweet Mints" Zora 1155 collection on Base. Each user gets their own deterministic collection; the NFT lands in the user's wallet. After minting, report the NFT link, collection link, and tx.
---

# Postmint

Mint any public post/tweet as an ERC-1155 NFT on Base. One collection per user ("Tweet Mints"), deployed deterministically from their wallet via the Zora 1155 factory. Metadata is fully on-chain (base64 data URI) — no servers, no IPFS pinning required.

## Trigger phrases

Use this skill when the user says any of:
- "postmint this" / "postmint this post" / "postmint this tweet"
- "mint this post" / "mint this tweet"
- "turn this post/tweet into an NFT"
- provides an x.com or twitter.com status URL and asks to mint it

## What it does

1. Resolves the tweet (text, author, first image) via the fxtwitter API — no X API keys needed.
2. If the tweet has no image but quotes a tweet that DOES, it uses the quoted tweet's image.
3. If NO image is found anywhere, it renders a screenshot of the tweet via a public screenshot API and uses that as the image. Falls back to text-only NFT if screenshot fails.
4. Builds token metadata: name `Tweet by @<author>`, description = tweet text + source URL, image = the resolved image, external_url = tweet URL.
5. Computes the user's deterministic "Tweet Mints" collection address from their wallet.
6. If the collection doesn't exist yet: one tx deploys it AND mints token #1.
7. If it exists: one tx adds the next token and mints 1 copy to the user.
8. After the mint, report BOTH the NFT link and the collection link to the user.

## Requirements

- The minting user's EVM wallet address (their Bankr wallet).
- A tweet URL containing a status ID, e.g. `https://x.com/user/status/1234567890`.
- Small amount of ETH on Base for gas (typically well under $0.05).

## Workflow

### Step 1 — Build the transaction with execute_cli

Run this script with `execute_cli` (packages: `["viem@2.21.0"]`, run with `bun build-mint.js`). Set `TWEET_URL` and `WALLET` at the top (or pass via env). It prints a JSON transaction to submit plus the links to report.

```javascript
// build-mint.js
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';

const TWEET_URL = process.env.TWEET_URL;
const WALLET = process.env.WALLET;

const FACTORY = '0x777777C338d93e2C7adf08D102d45CA7CC4Ed021';

const factoryAbi = [
  { name: 'createContractDeterministic', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'newContractURI', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'defaultRoyaltyConfiguration', type: 'tuple', components: [
        { name: 'royaltyMintSchedule', type: 'uint32' },
        { name: 'royaltyBPS', type: 'uint32' },
        { name: 'royaltyRecipient', type: 'address' } ] },
      { name: 'defaultAdmin', type: 'address' },
      { name: 'setupActions', type: 'bytes[]' } ],
    outputs: [{ type: 'address' }] },
  { name: 'deterministicContractAddress', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'msgSender', type: 'address' },
      { name: 'newContractURI', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'contractAdmin', type: 'address' } ],
    outputs: [{ type: 'address' }] },
];

const zora1155Abi = [
  { name: 'setupNewToken', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenURI', type: 'string' }, { name: 'maxSupply', type: 'uint256' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'adminMint', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'quantity', type: 'uint256' },
      { name: 'data', type: 'bytes' } ],
    outputs: [] },
  { name: 'multicall', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'data', type: 'bytes[]' }], outputs: [{ type: 'bytes[]' }] },
  { name: 'nextTokenId', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }] },
];

const dataUri = (obj) => 'data:application/json;base64,' + Buffer.from(JSON.stringify(obj)).toString('base64');

const statusId = (TWEET_URL.match(/status(?:es)?\/(\d+)/) || [])[1];
if (!statusId) throw new Error('No status ID found in TWEET_URL');

const res = await fetch(`https://api.fxtwitter.com/status/${statusId}`);
const fx = await res.json();
if (!fx.tweet) throw new Error('Tweet not found or not public');
const t = fx.tweet;
const author = t.author?.screen_name || 'unknown';

// Try tweet media, then quoted tweet media, then a rendered screenshot fallback
let all = (t.media && Array.isArray(t.media.all)) ? t.media.all : [];
if (!all.length && t.quote && t.quote.media && Array.isArray(t.quote.media.all)) {
  all = t.quote.media.all;
}
let image = all.find(m => m.type === 'photo')?.url || null;
const tweetUrl = t.url || TWEET_URL;
if (!image) {
  // Screenshot fallback for text-only tweets
  image = `https://image.thum.io/get/width/1200/crop/1500/noanimate/${encodeURIComponent(tweetUrl)}`;
}

const tokenMeta = {
  name: `Tweet by @${author}`,
  description: `${t.text || ''}\n\n${tweetUrl}`,
  image,
  external_url: tweetUrl,
};
const collMeta = {
  name: 'Tweet Mints',
  description: 'Images minted from X posts via Bankr',
};
const tokenUri = dataUri(tokenMeta);
const collUri = dataUri(collMeta);

const client = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });

const collection = await client.readContract({
  address: FACTORY, abi: factoryAbi, functionName: 'deterministicContractAddress',
  args: [WALLET, collUri, 'Tweet Mints', WALLET],
});

const code = await client.getCode({ address: collection });
const deployed = !!code && code !== '0x';

let to, data, tokenId;
if (!deployed) {
  tokenId = 1n;
  const setupActions = [
    encodeFunctionData({ abi: zora1155Abi, functionName: 'setupNewToken', args: [tokenUri, 1n] }),
    encodeFunctionData({ abi: zora1155Abi, functionName: 'adminMint', args: [WALLET, tokenId, 1n, '0x'] }),
  ];
  to = FACTORY;
  data = encodeFunctionData({
    abi: factoryAbi, functionName: 'createContractDeterministic',
    args: [collUri, 'Tweet Mints', { royaltyMintSchedule: 0, royaltyBPS: 0, royaltyRecipient: WALLET }, WALLET, setupActions],
  });
} else {
  tokenId = await client.readContract({ address: collection, abi: zora1155Abi, functionName: 'nextTokenId' });
  to = collection;
  data = encodeFunctionData({
    abi: zora1155Abi, functionName: 'multicall',
    args: [[
      encodeFunctionData({ abi: zora1155Abi, functionName: 'setupNewToken', args: [tokenUri, 1n] }),
      encodeFunctionData({ abi: zora1155Abi, functionName: 'adminMint', args: [WALLET, tokenId, 1n, '0x'] }),
    ]],
  });
}

console.log(JSON.stringify({
  tx: { chain: 'base', to, data, value: '0' },
  collection,
  tokenId: tokenId.toString(),
  deployed,
  nftLink: `https://zora.co/collect/base:${collection}/${tokenId}`,
  collectionLink: `https://opensea.io/assets/base/${collection}`,
  zoraCollectionLink: `https://zora.co/collect/base:${collection}`,
  preview: { name: tokenMeta.name, image, tweetUrl },
}, null, 2));
```

### Step 2 — Submit the transaction

Take the `tx` object from the script output and submit it with `submit_raw_transaction` ({ to, data, value, chain: "base" }). The `msg.sender` MUST be the same wallet passed as `WALLET` — the deterministic address and admin rights depend on it.

### Step 3 — Report to the user

Always include ALL of these in the final response:

- NFT link: `nftLink` from script output (zora page for the specific token)
- Collection link: `collectionLink` from script output (opensea page for the whole collection)
- Alt collection link: `zoraCollectionLink` from script output (zora page for the collection)
- Basescan tx: `https://basescan.org/tx/<txHash>`
- Note: indexers can take a few minutes to show fresh metadata.

## Important notes

- **One collection per wallet.** The deterministic address is derived from the minter's wallet, so every user gets their own "Tweet Mints" collection. Repeat mints reuse it automatically (the script detects this).
- **IMPORTANT — do not change the collection metadata or name strings** (`Tweet Mints` / the collection description). Changing them changes the deterministic address and orphans the user's existing collection.
- Only the collection admin (the wallet that created it) can mint into it — never try to mint into someone else's collection.
- The tweet must be public. Protected/deleted tweets fail at the fxtwitter step.
- Videos are not supported; the first photo is used. For text-only tweets, a rendered screenshot of the tweet is used as the image.

## Troubleshooting

- `Tweet not found`: check the status ID, tweet may be protected or deleted.
- Tx revert on `createContractDeterministic`: collection may already exist — re-run the script (it re-checks bytecode).
- Metadata not showing on marketplaces: wait a few minutes and refresh; metadata is on-chain, indexers just lag.

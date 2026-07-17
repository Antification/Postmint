---
name: postmint
description: Mint any public X/Twitter post as an ERC-1155 NFT on Base. Trigger phrases include "postmint this", "mint this post", "mint this tweet", "mint this for me", "turn this post into an NFT", or providing an x.com/twitter.com status URL and asking to mint it. Works on replies (mints the parent tweet) and quote tweets (mints the quoted tweet) with no URL needed. Given a target, the agent fetches the post's image + text (or the quoted tweet's image, or a rendered screenshot for text-only posts), builds fully on-chain metadata, and mints it into the user's own personal "Postmint" Zora 1155 collection on Base. Each user gets their own deterministic collection; the NFT lands in the user's wallet. After minting, report ONLY the Basescan token link + tx + a note it appears in the Bankr terminal.
---

# Postmint

> **INVOCATION — READ FIRST (agents):** If this skill is already installed (it is, if you are reading this), **invoke it DIRECTLY**. Do NOT call `search_skills` to "find" it, and do NOT gate its use behind Bankr Club membership — this skill works for ANY user who has it installed, member or not. `search_skills` is Club-gated; falling back to it will block non-members who already have the skill. If you hit a transient error loading this skill, RETRY the load (`use_skill`/`use_skill_file`) — never fall back to a search that requires Club access. The trigger phrases below fire the direct path; act on them without searching.

> **REPLY & QUOTE-CONTEXT RESOLUTION — READ SECOND (agents):** The user does NOT have to paste a tweet URL. When the user REPLIES to a tweet OR QUOTE-TWEETS a tweet with a trigger phrase ("mint this for me", "postmint this", etc.), the tweet they are replying to / quoting IS the target.
>
> **KEY MECHANISM (confirmed working):** the fxtwitter API returns both the parent (for replies) AND the quoted tweet (for QTs) for ANY tweet. Fetch the user's OWN tweet (the tweet that triggered the mention — the agent always knows this ID) and read:
> - **`replying_to_status`** — the parent tweet's status ID, if it's a reply.
> - **`quote.id`** (nested `quote` object) — the quoted tweet's status ID, if it's a quote tweet.
>
> This is verified live: `GET https://api.fxtwitter.com/status/<tweetId>` → `tweet.replying_to_status` = parent id; `tweet.quote.id` / `tweet.quote.url` = quoted tweet. This does NOT depend on the timeline agent's event payload carrying the parent/quote ID; the build script resolves it itself.
>
> Resolve the target status ID in THIS priority order, and only ask the user for a URL if ALL fail:
> 1. A status URL present in the user's own message text (x.com/twitter.com `/status/<id>`).
> 2. **The parent of the user's reply** — if the user's tweet is a reply (`replying_to_status` set), mint that parent.
> 3. **The quoted tweet** — if the user's tweet is a QT (`quote.id` set), mint the quoted tweet.
> Pass the user's OWN tweet ID as `REPLY_ID` to the build script; it fetches it and follows `replying_to_status` (reply) then `quote.id` (QT) automatically. If you already have the target's ID directly, pass it as `TWEET_URL` instead.
> Only if 1–3 all fail: ask "which post? drop the tweet URL". Do NOT ask for a URL when the user is clearly replying to or quoting a tweet — resolve the target first.

> **OUTPUT CONTRACT — MANDATORY (agents):** When reporting a completed mint you MUST report ONLY these two links, in this order, and NOTHING else link-wise:
> - `explorer (Basescan): https://basescan.org/token/<collection>` — use the EXACT `explorerLink` string emitted by the build script. This is live the instant the tx confirms.
> - `tx: https://basescan.org/tx/<txHash>`
> Plus a short note that the NFT will also appear in the user's Bankr terminal (NFTs/collectibles view).
> It is FORBIDDEN to include ANY `zora.co` / `zora.energy` link, ANY `opensea.io` link, ANY per-token / individual NFT link, or any marketplace URL. Do NOT add a "NFT:" line, an "OpenSea" line, or a "collection (Zora):" line. If you catch yourself about to write a Zora OR OpenSea URL, DELETE it. The user wants ONLY the Basescan link kept clean; OpenSea will resolve on its own once indexed if the user looks for it, but the skill must not emit it.

Mint any public post/tweet as an ERC-1155 NFT on Base. One collection per user ("Postmint"), deployed deterministically from their wallet via the Zora 1155 factory. Metadata is fully on-chain (base64 data URI) — no servers, no IPFS pinning required.

## Trigger phrases

Use this skill when the user says any of:
- "postmint this" / "postmint this post" / "postmint this tweet"
- "mint this post" / "mint this tweet" / "mint this post for me" / "mint this for me"
- "turn this post/tweet into an NFT"
- provides an x.com or twitter.com status URL and asks to mint it
- **REPLIES to a tweet with any of the above and NO URL** — the replied-to (parent) tweet is the target.
- **QUOTE-TWEETS a tweet with any of the above and NO URL** — the quoted tweet is the target.
See REPLY & QUOTE-CONTEXT RESOLUTION at the top.

When any trigger matches, invoke this installed skill directly — do NOT search for it first, and do NOT ask for a URL if the user is replying to / quoting a tweet (resolve the target).

## Resolving the target tweet (do this BEFORE running the build script)

You have two ways to hand the build script the target — use whichever you have:
- `TWEET_URL` — an explicit target (a URL from the message, a parent/quoted ID you already have). The script mints exactly this.
- `REPLY_ID` — the user's OWN tweet ID (the tweet that triggered the mention). The script fetches it and resolves the target: reply parent (`replying_to_status`) first, then quoted tweet (`quote.id`). Use this for "mint this for me" replies AND quote tweets when you don't have the target ID directly.

Priority: explicit URL in message → reply parent → quoted tweet → ask the user. Pass ONE of `TWEET_URL` / `REPLY_ID`. If both are set, `TWEET_URL` wins.

## What it does

1. Resolves the target tweet. If `REPLY_ID` is given (and no `TWEET_URL`), it fetches the user's tweet and follows `replying_to_status` (reply parent) or `quote.id` (quoted tweet) to the actual post being minted.
2. Resolves the tweet (text, author, first image) via the fxtwitter API — no X API keys needed.
3. If the tweet has no image but quotes a tweet that DOES, it uses the quoted tweet's image.
4. If NO image is found anywhere, it uses a rendered screenshot of the tweet itself (thum.io) as the image, so every NFT has a visual — a picture of the tweet.
5. Builds token metadata: name `Post by @<author>`, description = tweet text + source URL, image = the resolved image, external_url = tweet URL.
6. Computes the user's deterministic "Postmint" collection address from their wallet.
7. If the collection doesn't exist yet: one tx deploys it AND mints token #1. If it exists: one tx adds the next token and mints 1 copy to the user.
8. After the mint, report ONLY the Basescan token link + the tx hash + a note that the NFT appears in the Bankr terminal. See the OUTPUT CONTRACT block at the top — it is mandatory.

## Requirements

- The minting user's EVM wallet address (their Bankr wallet).
- A target: `TWEET_URL` (explicit) OR `REPLY_ID` (the user's reply/QT → target auto-resolved).
- Small amount of ETH on Base for gas (typically well under $0.05).

## Workflow

### Step 1 — Build the transaction with execute_cli

Run this script with `execute_cli` (packages: `["viem@2.21.0"]`, run with `bun build-mint.js`). Set `WALLET` and ONE of `TWEET_URL` / `REPLY_ID` via env. It prints a JSON transaction to submit plus the links to report.

```javascript
// build-mint.js
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';

const TWEET_URL = process.env.TWEET_URL;   // explicit target (wins if set)
const REPLY_ID = process.env.REPLY_ID;     // user's own tweet id -> mint its parent (reply) or quoted tweet (QT)
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
const idFrom = (s) => (String(s || '').match(/status(?:es)?\/(\d+)/) || [])[1] || (/^\d+$/.test(String(s || '').trim()) ? String(s).trim() : null);
const fetchTweet = async (id) => {
  const r = await fetch(`https://api.fxtwitter.com/status/${id}`);
  const j = await r.json();
  return j.tweet || null;
};

// --- Resolve the target status id ---
let statusId = null;
let resolvedFrom = null;
if (TWEET_URL) {
  statusId = idFrom(TWEET_URL);
  if (!statusId) throw new Error('No status ID found in TWEET_URL');
  resolvedFrom = 'TWEET_URL';
} else if (REPLY_ID) {
  const wrapId = idFrom(REPLY_ID);
  if (!wrapId) throw new Error('REPLY_ID is not a valid status id');
  const wrap = await fetchTweet(wrapId);
  if (!wrap) throw new Error('Could not load the user tweet (protected/deleted?)');
  if (wrap.replying_to_status) {
    statusId = wrap.replying_to_status;   // reply parent, confirmed field
    resolvedFrom = 'REPLY_ID(parent)';
  } else if (wrap.quote && wrap.quote.id) {
    statusId = wrap.quote.id;             // quoted tweet, confirmed field
    resolvedFrom = 'REPLY_ID(quoted)';
  } else {
    throw new Error('That tweet is neither a reply nor a quote tweet — no target to mint. Ask the user for the target URL.');
  }
} else {
  throw new Error('Provide TWEET_URL or REPLY_ID');
}

const t = await fetchTweet(statusId);
if (!t) throw new Error('Target tweet not found or not public (parent/quoted may be protected/deleted)');
const author = t.author?.screen_name || 'unknown';
const tweetUrl = t.url || `https://x.com/i/status/${statusId}`;

// Image resolution: 1) photo on tweet, 2) photo on quoted tweet, 3) thum.io screenshot
let all = (t.media && Array.isArray(t.media.all)) ? t.media.all : [];
if (!all.length && t.quote && t.quote.media && Array.isArray(t.quote.media.all)) all = t.quote.media.all;
let image = all.find(m => m.type === 'photo')?.url || null;
if (!image) {
  // Plain width-only thum.io URL. Do NOT add crop/noanimate or URL-encode — that returns HTTP 400.
  image = `https://image.thum.io/get/width/1200/${tweetUrl}`;
}

const tokenMeta = { name: `Post by @${author}`, description: `${t.text || ''}\n\n${tweetUrl}`, image, external_url: tweetUrl };
const collMeta = { name: 'Postmint', description: 'Posts minted via Bankr' };
const tokenUri = dataUri(tokenMeta);
const collUri = dataUri(collMeta);

const client = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
const collection = await client.readContract({
  address: FACTORY, abi: factoryAbi, functionName: 'deterministicContractAddress',
  args: [WALLET, collUri, 'Postmint', WALLET],
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
    args: [collUri, 'Postmint', { royaltyMintSchedule: 0, royaltyBPS: 0, royaltyRecipient: WALLET }, WALLET, setupActions],
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
  resolvedFrom,
  statusId,
  // Report ONLY the Basescan link. Do NOT construct any zora.co, opensea.io, or per-token URL.
  explorerLink: `https://basescan.org/token/${collection}`,
  preview: { name: tokenMeta.name, image, tweetUrl },
}, null, 2));
```

### Step 2 — Submit the transaction

Take the `tx` object from the script output and submit it with `submit_raw_transaction` ({ to, data, value, chain: "base" }). The `msg.sender` MUST be the same wallet passed as `WALLET` — the deterministic address and admin rights depend on it.

### Step 3 — Report to the user (STRICT — Basescan only)

Report EXACTLY these lines and nothing else link-wise:

```
✅ minted your post as an NFT on Base

- explorer (Basescan): <explorerLink from script output>
- tx: https://basescan.org/tx/<txHash>

metadata is fully on-chain. your NFT will also show up in your Bankr terminal (your NFTs/collectibles) shortly.
```

FORBIDDEN in the response:
- ❌ any `zora.co` or `zora.energy` link (no "NFT:" line, no "collection (Zora):" line)
- ❌ any `opensea.io` link
- ❌ any per-token / individual NFT link
- ❌ any marketplace URL

If you are about to output a Zora or OpenSea link, STOP and remove it.

## Important notes

- **Reply & quote context first.** "mint this for me" as a reply means mint the PARENT; as a quote tweet means mint the QUOTED tweet. Pass the user's own tweet ID as `REPLY_ID`; the script follows `replying_to_status` (reply) then `quote.id` (QT). Only ask for a URL if there is genuinely no resolvable target.
- **`replying_to_status` and `quote.id` are the confirmed fxtwitter fields** for a reply's parent and a QT's quoted tweet. They do not depend on the timeline agent's event payload — the script fetches them itself. If both are empty, the tweet is neither a reply nor a QT (e.g. a top-level tweet) → then ask for the URL.
- **One collection per wallet.** The deterministic address is derived from the minter's wallet. Repeat mints reuse it automatically (the script detects this).
- **IMPORTANT — do not change the collection metadata or name strings** (`Postmint` name / description `Posts minted via Bankr`). Changing them changes the deterministic address and orphans the user's existing collection. (History: previously named `Tweet Mints`; the rename to `Postmint` was a deliberate one-time migration. Do NOT rename again.)
- **A collection's on-chain name is immutable.** Collections deployed under the OLD `Tweet Mints` name will ALWAYS read "Tweet Mints"; a new mint into them cannot rename them. Only a wallet that has never deployed before gets a fresh `Postmint` collection.
- Only the collection admin (the creator wallet) can mint into it.
- The tweet must be public. Protected/deleted tweets (including an unavailable PARENT or QUOTED tweet) fail at the fxtwitter step with a clear error.
- Videos are not supported; the first photo is used. Text-only tweets use a rendered screenshot.
- **Screenshot URL gotcha:** use the plain width-only form `https://image.thum.io/get/width/1200/<tweetUrl>` (NOT URL-encoded, no `crop/`/`noanimate/`). The crop/noanimate + encoded form returns HTTP 400 and bakes a dead image into the NFT.
- **OpenSea note:** the collection is viewable on OpenSea once indexed at `opensea.io/assets/base/<collection>`, but the skill deliberately does NOT emit that link. Mention OpenSea only if the user explicitly asks.

## Troubleshooting

- **Agent asks "which post? drop the tweet URL" when the user was replying to / quoting a tweet:** the agent didn't pass `REPLY_ID`. The fix is to hand the build script the user's OWN tweet ID as `REPLY_ID` — it resolves `replying_to_status` (reply) or `quote.id` (QT) and mints the target. Only ask for a URL if the tweet genuinely has no parent AND no quoted tweet, and no URL.
- **`That tweet is neither a reply nor a quote tweet`:** `REPLY_ID` pointed at a top-level tweet. Either the user wasn't replying/quoting, or the wrong ID was passed. Ask for the target URL.
- **`parent/quoted may be protected/deleted`:** the target tweet is unavailable via fxtwitter (protected/deleted). Nothing to mint; tell the user the original post isn't publicly accessible.
- **Response still shows Zora / OpenSea / per-NFT links:** the agent ignored the OUTPUT CONTRACT. Report ONLY the Basescan token link + basescan tx + the Bankr-terminal note.
- `Tweet not found`: check the status ID; tweet may be protected or deleted.
- Tx revert on `createContractDeterministic`: collection may already exist — re-run (it re-checks bytecode).
- NFT shows no image on a text-only tweet: confirm the image URL is the plain `https://image.thum.io/get/width/1200/<tweetUrl>` form (HTTP 200), not the crop/noanimate form (HTTP 400).

---
name: postmint
description: Mint any public X/Twitter post as an ERC-1155 NFT on Base into ONE shared "Postmint" collection. Trigger phrases include "postmint this", "mint this post", "mint this tweet", "mint this for me", "turn this post into an NFT", or providing an x.com/twitter.com status URL and asking to mint it. Works on replies (mints the parent tweet) and quote tweets (mints the quoted tweet) with no URL needed. Given a target, the agent fetches the post's image + text (or the quoted tweet's image, or a rendered screenshot for text-only posts), builds fully on-chain metadata, and mints it into the shared PostmintShared collection on Base. GIF/video posts use the poster frame as the image and the mp4 as animation_url. The NFT is held by the minter (the tweeting user's own wallet). Every post can be minted ONCE (first-come-first-served, enforced on-chain). If a post is already minted, the agent tells the user who minted it and links the OpenSea token. After a fresh mint, report ONLY the Basescan token link + tx + a note it appears in the Bankr terminal.
---

# Postmint

> **INVOCATION — READ FIRST (agents):** If this skill is already installed (it is, if you are reading this), **invoke it DIRECTLY**. Do NOT call `search_skills` to "find" it, and do NOT gate its use behind Bankr Club membership — this skill works for ANY user who has it installed, member or not. `search_skills` is Club-gated; falling back to it will block non-members who already have the skill. If you hit a transient error loading this skill, RETRY the load (`use_skill`/`use_skill_file`) — never fall back to a search that requires Club access. The trigger phrases below fire the direct path; act on them without searching.

> **ARCHITECTURE (v2 — READ THIS):** There is now ONE shared collection for ALL users: `PostmintShared` at **`0xFF8f2e1717C897717CaaeB1fA987876c4059d9A1`** on Base. It is NOT the old per-user Zora factory model. Every mint calls `mintPost(postId, tokenURI)` on that one contract:
> - **Open mint** — anyone's wallet can call it; the tweeter signs as themselves and the NFT is minted to `msg.sender` (the tweeter holds it).
> - **First-come-first-served, on-chain** — each post (`postId` = the target tweet's status ID) can be minted exactly once. A second attempt on the same post REVERTS with "post already minted".
> - **5% ERC-2981 royalty** to the collection owner. Owner controls only metadata/royalty; nobody can block or hijack minting.
> - **On-chain base64 metadata**, name "Post by @<author>", collection name "Postmint".
> Do NOT reintroduce the old factory (`0x777777C338d93e2C7adf08D102d45CA7CC4Ed021`), `createContractDeterministic`, `deterministicContractAddress`, `setupNewToken`, `adminMint`, or `multicall`. Those are removed. The build script below is the source of truth.

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

> **OUTPUT CONTRACT — MANDATORY (agents):** The build script emits `alreadyMinted: true|false`. There are TWO response paths — use the one matching that flag:
>
> **A) Fresh mint (`alreadyMinted: false`, after you submit the tx):** report ONLY these two links, in this order, and NOTHING else link-wise:
> - `explorer (Basescan): https://basescan.org/token/0xFF8f2e1717C897717CaaeB1fA987876c4059d9A1` — use the EXACT `explorerLink` string emitted by the build script.
> - `tx: https://basescan.org/tx/<txHash>`
> Plus a short note that the NFT will also appear in the user's Bankr terminal (NFTs/collectibles view).
> On the fresh-mint path it is FORBIDDEN to include ANY `zora.co` / `zora.energy` link, ANY per-token individual link other than the Basescan collection token page, or any other marketplace URL.
>
> **B) Already minted (`alreadyMinted: true`, NO tx to submit):** the post was already minted by someone. Do NOT submit a transaction (it would revert). Instead reply with the minter + the OpenSea token link the script emits:
> - "this post was already minted by <minter> — grab it on secondary: <openseaToken>"
> - If only the collection link is available, use `<openseaCollection>` instead.
> The `opensea.io` link is ALLOWED and expected ONLY on this already-minted path. It is the one deliberate exception to the no-OpenSea rule.

Mint any public post/tweet as an ERC-1155 NFT on Base, into ONE shared "Postmint" collection at `0xFF8f2e1717C897717CaaeB1fA987876c4059d9A1`. The NFT is held by the minter. Metadata is fully on-chain (base64 data URI) — no servers, no IPFS pinning. Every post can be minted once (first-come-first-served, enforced on-chain).

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
2. **Dedup check FIRST** — reads `tokenIdForPost(statusId)` on the shared contract. If it's nonzero, the post is already minted: the script emits `alreadyMinted: true`, the minter address, and the OpenSea token link. NO transaction is built. (Follow OUTPUT CONTRACT path B.)
3. If not yet minted: resolves the tweet (text, author, media) via the fxtwitter API — no X API keys needed.
4. **Media resolution (photo → gif/video → quoted-tweet media → screenshot):**
   - If the tweet has a **photo**, use it as `image`.
   - If the tweet has a **gif or video** (no photo), use the media's `thumbnail_url` (poster frame) as `image` AND set `animation_url` to the best mp4 variant so marketplaces play the motion. (Twitter "gifs" are mp4 videos — same handling.)
   - If the tweet itself has no usable media but **quotes a tweet that does**, use the quoted tweet's photo, or its gif/video poster + mp4.
   - If NO media is found anywhere, use a rendered screenshot of the tweet (thum.io), cropped to zoom into the post card, so every NFT still has a visual.
5. Builds token metadata: name `Post by @<author>`, description = tweet text + source URL, image = the resolved poster/photo/screenshot, `animation_url` = mp4 (only when a gif/video was found), external_url = tweet URL.
6. Builds a single `mintPost(postId, tokenURI)` transaction to the shared contract `0xFF8f2e1717C897717CaaeB1fA987876c4059d9A1`. `postId` = the target tweet's status ID. The NFT is minted to `msg.sender` (the tweeting user).
7. After the mint confirms, report per OUTPUT CONTRACT path A (Basescan token link + tx + Bankr-terminal note).

## Requirements

- The minting user's EVM wallet (their Bankr wallet) — it signs `mintPost` and holds the NFT.
- A target: `TWEET_URL` (explicit) OR `REPLY_ID` (the user's reply/QT → target auto-resolved).
- Small amount of ETH on Base for gas (mint is ~280–300k gas, typically well under a cent).

## Workflow

### Step 1 — Build the transaction with execute_cli

Run this script with `execute_cli` (packages: `["viem@2.21.0"]`, run with `bun build-mint.js`). Set `WALLET` and ONE of `TWEET_URL` / `REPLY_ID` via env. It prints either an `alreadyMinted:true` result (path B) or a JSON transaction to submit plus the links to report (path A).

```javascript
// build-mint.js — Postmint v2 (shared contract)
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';

const CONTRACT = '0xFF8f2e1717C897717CaaeB1fA987876c4059d9A1'; // PostmintShared on Base
const RPCS = ['https://mainnet.base.org','https://base.llamarpc.com','https://base-rpc.publicnode.com'];

const TWEET_URL = process.env.TWEET_URL;   // explicit target (wins if set)
const REPLY_ID = process.env.REPLY_ID;     // user's own tweet id -> mint its parent (reply) or quoted tweet (QT)
const WALLET = process.env.WALLET;

const abi = [
  { type:'function', name:'mintPost', stateMutability:'nonpayable',
    inputs:[{name:'postId',type:'string'},{name:'tokenURI',type:'string'}], outputs:[{type:'uint256'}] },
  { type:'function', name:'tokenIdForPost', stateMutability:'view',
    inputs:[{type:'string'}], outputs:[{type:'uint256'}] },
  { type:'function', name:'minterOf', stateMutability:'view',
    inputs:[{type:'uint256'}], outputs:[{type:'address'}] },
  { type:'function', name:'nextTokenId', stateMutability:'view',
    inputs:[], outputs:[{type:'uint256'}] },
];

const dataUri = (o) => 'data:application/json;base64,' + Buffer.from(JSON.stringify(o)).toString('base64');
const idFrom = (s) => (String(s || '').match(/status(?:es)?\/(\d+)/) || [])[1] || (/^\d+$/.test(String(s || '').trim()) ? String(s).trim() : null);
const fetchTweet = async (id) => { const r = await fetch(`https://api.fxtwitter.com/status/${id}`); const j = await r.json(); return j.tweet || null; };
async function readC(fn, args = []) { let e; for (const u of RPCS) { try { const c = createPublicClient({ chain: base, transport: http(u) }); return await c.readContract({ address: CONTRACT, abi, functionName: fn, args }); } catch (x) { e = x; } } throw e; }

// Pick the best mp4 variant URL from a gif/video media object (fxtwitter shape).
function bestMp4(m) {
  if (!m) return null;
  // fxtwitter video media exposes `.url` (direct mp4) and sometimes `.variants[]` with bitrate.
  if (Array.isArray(m.variants) && m.variants.length) {
    const mp4s = m.variants.filter(v => (v.content_type || v.type || '').includes('mp4') || /\.mp4/.test(v.url || ''));
    const pool = mp4s.length ? mp4s : m.variants;
    pool.sort((a, b) => (Number(b.bitrate || 0)) - (Number(a.bitrate || 0)));
    if (pool[0] && pool[0].url) return pool[0].url;
  }
  if (m.url && /\.mp4/.test(m.url)) return m.url;
  return m.url || null;
}

// Resolve media from a media.all array: returns { image, animationUrl }.
function resolveMedia(all) {
  if (!Array.isArray(all) || !all.length) return { image: null, animationUrl: null };
  const photo = all.find(m => m.type === 'photo');
  if (photo && photo.url) return { image: photo.url, animationUrl: null };
  const vid = all.find(m => m.type === 'video' || m.type === 'gif');
  if (vid) {
    const poster = vid.thumbnail_url || vid.poster || vid.preview_image_url || null;
    const mp4 = bestMp4(vid);
    return { image: poster, animationUrl: mp4 };
  }
  return { image: null, animationUrl: null };
}

// --- Resolve the target status id ---
let statusId = null, resolvedFrom = null;
if (TWEET_URL) {
  statusId = idFrom(TWEET_URL);
  if (!statusId) throw new Error('No status ID found in TWEET_URL');
  resolvedFrom = 'TWEET_URL';
} else if (REPLY_ID) {
  const wrapId = idFrom(REPLY_ID);
  if (!wrapId) throw new Error('REPLY_ID is not a valid status id');
  const wrap = await fetchTweet(wrapId);
  if (!wrap) throw new Error('Could not load the user tweet (protected/deleted?)');
  if (wrap.replying_to_status) { statusId = wrap.replying_to_status; resolvedFrom = 'REPLY_ID(parent)'; }
  else if (wrap.quote && wrap.quote.id) { statusId = wrap.quote.id; resolvedFrom = 'REPLY_ID(quoted)'; }
  else throw new Error('That tweet is neither a reply nor a quote tweet — no target to mint. Ask the user for the target URL.');
} else {
  throw new Error('Provide TWEET_URL or REPLY_ID');
}

// --- DEDUP CHECK FIRST (first-come-first-served, enforced on-chain) ---
const existing = await readC('tokenIdForPost', [String(statusId)]);
if (existing && existing > 0n) {
  const minter = await readC('minterOf', [existing]);
  console.log(JSON.stringify({
    alreadyMinted: true,
    statusId,
    tokenId: existing.toString(),
    minter,
    openseaToken: `https://opensea.io/assets/base/${CONTRACT}/${existing}`,
    openseaCollection: `https://opensea.io/assets/base/${CONTRACT}`,
    resolvedFrom,
  }, null, 2));
  process.exit(0);
}

// --- Not minted yet: resolve tweet + build mint tx ---
const t = await fetchTweet(statusId);
if (!t) throw new Error('Target tweet not found or not public (parent/quoted may be protected/deleted)');
const author = t.author?.screen_name || 'unknown';
const tweetUrl = t.url || `https://x.com/i/status/${statusId}`;

// Media: photo -> gif/video poster+mp4 -> quoted tweet's media -> screenshot fallback.
let { image, animationUrl } = resolveMedia(t.media && t.media.all);
if (!image && !animationUrl && t.quote && t.quote.media && Array.isArray(t.quote.media.all)) {
  ({ image, animationUrl } = resolveMedia(t.quote.media.all));
}
if (!image) {
  // Text-only fallback: rendered screenshot zoomed into the post card.
  // Use the UNENCODED width/crop form: `width/600/crop/800/<tweetUrl>` — verified HTTP 200 + real image/png.
  // Do NOT URL-encode the tweet URL and do NOT use viewportWidth/noanimate variants — those return an
  // image/gif loading-placeholder (dead image) or HTTP 400. Plain width/1200 works too but screenshots the
  // whole page (too zoomed out); width/600/crop/800 frames just the tweet.
  image = `https://image.thum.io/get/width/600/crop/800/${tweetUrl}`;
}

const tokenMeta = { name: `Post by @${author}`, description: `${t.text || ''}\n\n${tweetUrl}`, image, external_url: tweetUrl };
if (animationUrl) tokenMeta.animation_url = animationUrl; // motion for gif/video; poster stays as `image`
const tokenUri = dataUri(tokenMeta);

const nextId = await readC('nextTokenId');
const data = encodeFunctionData({ abi, functionName: 'mintPost', args: [String(statusId), tokenUri] });

console.log(JSON.stringify({
  alreadyMinted: false,
  tx: { chain: 'base', to: CONTRACT, data, value: '0' },
  expectedTokenId: nextId.toString(),
  statusId,
  resolvedFrom,
  // Report ONLY the Basescan link on the fresh-mint path.
  explorerLink: `https://basescan.org/token/${CONTRACT}`,
  preview: { name: tokenMeta.name, image, animationUrl: animationUrl || null, tweetUrl },
}, null, 2));
```

### Step 2 — Submit the transaction (only when `alreadyMinted: false`)

If the script output has `alreadyMinted: true`, DO NOT submit anything — go to Step 3 path B.

Otherwise take the `tx` object and submit it with `submit_raw_transaction` ({ to, data, value, chain: "base" }). The `msg.sender` MUST be the tweeting user's wallet (the wallet passed as `WALLET`) — that wallet becomes the on-chain minter and holder of the NFT.

### Step 3 — Report to the user

**Path A — fresh mint (`alreadyMinted: false`), after the tx confirms:**

```
✅ minted your post as an NFT on Base

- explorer (Basescan): <explorerLink from script output>
- tx: https://basescan.org/tx/<txHash>

metadata is fully on-chain. your NFT will also show up in your Bankr terminal (your NFTs/collectibles) shortly.
```

FORBIDDEN on path A: any zora.co / zora.energy link, any opensea.io link, any per-token link other than the Basescan token page, any other marketplace URL.

**Path B — already minted (`alreadyMinted: true`), NO tx submitted:**

```
this post was already minted by <minter> (first come, first served).

grab it on secondary: <openseaToken>
```

Use `<openseaCollection>` if only the collection link is present. OpenSea IS allowed here — this is the one deliberate exception.

## Important notes

- **One shared collection for everyone.** All mints go to `0xFF8f2e1717C897717CaaeB1fA987876c4059d9A1`. There is no per-user collection anymore. Do NOT deploy anything — the contract already exists on Base.
- **First-come-first-served is real and on-chain.** Each post can be minted once. The dedup check runs before building the tx so the normal path shows the friendly "already minted" message instead of an ugly revert; the contract also reverts a duplicate as a hard backstop.
- **The NFT is held by the minter.** `mintPost` mints to `msg.sender` — the tweeting user's own wallet. The collection contract is shared; token ownership is theirs.
- **Reply & quote context first.** "mint this for me" as a reply means mint the PARENT; as a quote tweet means mint the QUOTED tweet. Pass the user's own tweet ID as `REPLY_ID`; the script follows `replying_to_status` (reply) then `quote.id` (QT). Only ask for a URL if there is genuinely no resolvable target.
- **Do not change the collection name/description strings** ("Postmint" / "Posts minted via Bankr") — they are set on-chain by the contract owner, not per mint. The build script no longer sets collection metadata.
- **The tweet must be public.** Protected/deleted tweets (including an unavailable PARENT or QUOTED tweet) fail at the fxtwitter step with a clear error.
- **GIF & video ARE supported.** For a gif/video post, the NFT's `image` is the poster frame (thumbnail) and `animation_url` is the best mp4 variant, so OpenSea and most marketplaces play the motion while using the poster as the thumbnail. The mp4 stays hosted on Twitter's CDN — if that link ever rots, motion stops but the on-chain poster image and metadata survive. Embedding the video bytes on-chain is intentionally NOT done (far too large/expensive). Videos with no resolvable poster fall back to the screenshot image. The first/primary media item is used when a post has several.
- **Screenshot URL gotcha (text-only posts):** use the UNENCODED width/crop form `https://image.thum.io/get/width/600/crop/800/<tweetUrl>`. This is verified to return HTTP 200 + a real `image/png`, and it frames just the tweet card (zoomed in) instead of the whole page. Do NOT URL-encode the tweet URL, and do NOT use the `viewportWidth/.../crop/...` or `publish.twitter.com/oembed` variants — those return an `image/gif` loading-placeholder (a dead image baked into the NFT). The plain `width/1200/<tweetUrl>` form also returns a valid image but screenshots the entire page (too zoomed out) — that was the old behavior and is why token images looked like a full-screen capture.
- **Royalties:** 5% ERC-2981 to the collection owner, set on-chain. Not something the skill or minter controls per token.

## Troubleshooting

- **Script emits `alreadyMinted: true`:** expected when the post was already minted. Do NOT submit a tx (it reverts). Use OUTPUT CONTRACT path B (minter + OpenSea token link).
- **Tx reverts with "post already minted":** the dedup check was skipped or a race occurred (two mints of the same post within seconds — first wins). Re-run the build script; it will now return `alreadyMinted: true` with the winner's token/minter.
- **Agent asks "which post?" when the user was replying to / quoting a tweet:** the agent didn't pass `REPLY_ID`. Hand the build script the user's OWN tweet ID as `REPLY_ID`; it resolves `replying_to_status` (reply) or `quote.id` (QT).
- **`That tweet is neither a reply nor a quote tweet`:** `REPLY_ID` pointed at a top-level tweet. Ask for the target URL.
- **`parent/quoted may be protected/deleted`:** the target tweet is unavailable via fxtwitter. Nothing to mint; tell the user the original post isn't publicly accessible.
- **GIF/video NFT shows only a still, no motion:** the marketplace doesn't render `animation_url`, or the mp4 CDN link expired. The poster `image` always renders; motion depends on the marketplace + a live Twitter CDN mp4. Nothing to fix on-chain — metadata is immutable.
- **GIF/video NFT has no image at all:** the media had no resolvable `thumbnail_url`/poster; the script then falls back to the thum.io screenshot. If you see a blank, re-run — a transient fxtwitter response may have lacked the poster field.
- **Text-only NFT image looks like a full-screen capture:** the old `width/1200/<tweetUrl>` full-page form was used. The current script uses `width/600/crop/800/<tweetUrl>` to zoom into the post card. (Already-minted tokens can't be changed — metadata is immutable on-chain base64 and the contract has no per-token setURI; this only affects mints going forward.)
- **Text-only NFT image is a blank/loading gif:** an encoded URL or a `viewportWidth`/`publish.twitter` variant was used — those return `image/gif` placeholders. Use the exact unencoded `width/600/crop/800/<tweetUrl>` form.
- **Response shows Zora / wrong links on a fresh mint:** the agent ignored OUTPUT CONTRACT path A. Report ONLY the Basescan token link + basescan tx + the Bankr-terminal note.
- **"skill installed but errored loading" → fell back to Club-gated search:** RETRY loading the skill directly (`use_skill`/`use_skill_file`) and act on the trigger. Never route through `search_skills` (Club-gated).

---
**This skill uses shell commands.** If `execute_cli`, `tail_cli`, `get_cli_task_output`, `kill_cli_task`, or `send_interim_message` are not in your bound tool list, call `request_additional_tools` with the query "execute_cli tail_cli get_cli_task_output kill_cli_task send_interim_message" BEFORE running any commands. Sandbox install rules: do not run `npm install -g`; put npm packages in `execute_cli.packages` and invoke binaries from PATH or `node_modules/.bin`.

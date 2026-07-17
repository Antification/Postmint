const { url } = args;
if (!url) return { error: "No URL provided" };

// This script hands off the heavy lifting to the Postmint skill via the agent.
// The agent will handle tweet fetching, metadata building, and minting.
const response = await bankr.askAgent(
  `Use the postmint skill to mint this tweet: ${url}. Return the transaction hash and NFT link.`
);

return { result: response };
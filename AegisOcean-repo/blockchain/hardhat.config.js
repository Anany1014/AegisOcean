require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const RPC_URL = process.env.POLYGON_AMOY_RPC_URL || process.env.RPC_URL || "https://rpc.ankr.com/polygon_amoy";

const rawKey = process.env.PRIVATE_KEY;
const isValidHexKey = rawKey && /^0x[a-fA-F0-9]{64}$/.test(rawKey);
const PRIVATE_KEY = isValidHexKey
  ? rawKey
  : "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    amoy: {
      url: RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 80002,
      timeout: 20000
    },
    hardhat: {
      chainId: 80002,
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

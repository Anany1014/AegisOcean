const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("==================================================");
  console.log("Starting AegisOcean MaritimeFineLedger Deployment");
  console.log("==================================================");
  console.log(`Network: ${network.name} (Chain ID: ${network.config.chainId || 'local'})`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer Wallet Address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} MATIC/POL`);

  const BASE_FINE = 10000;
  const AREA_MULTIPLIER = 5000;

  console.log(`\nDeploying MaritimeFineLedger with parameters:`);
  console.log(`- Base Fine: $${BASE_FINE} USD`);
  console.log(`- Area Multiplier: $${AREA_MULTIPLIER} USD / sq km\n`);

  const MaritimeFineLedger = await ethers.getContractFactory("MaritimeFineLedger");
  const ledger = await MaritimeFineLedger.deploy(BASE_FINE, AREA_MULTIPLIER);

  console.log("Deploy transaction submitted. Awaiting block confirmation...");
  await ledger.waitForDeployment();

  const contractAddress = await ledger.getAddress();
  const deploymentTx = ledger.deploymentTransaction();
  const txHash = deploymentTx ? deploymentTx.hash : "N/A";

  console.log("\n==================================================");
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("==================================================");
  console.log(`1. Contract Address:            ${contractAddress}`);
  console.log(`2. Deployment Transaction Hash: ${txHash}`);
  console.log(`3. Polygon Amoy Explorer Link:  https://amoy.polygonscan.com/address/${contractAddress}`);
  console.log("==================================================\n");

  // Save deployment artifact details to blockchain/deployments/
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentData = {
    network: network.name,
    chainId: network.config.chainId || 80002,
    contractName: "MaritimeFineLedger",
    contractAddress: contractAddress,
    transactionHash: txHash,
    deployerAddress: deployer.address,
    deployedAt: new Date().toISOString(),
    parameters: {
      baseFine: BASE_FINE,
      areaMultiplier: AREA_MULTIPLIER
    },
    explorerUrl: `https://amoy.polygonscan.com/address/${contractAddress}`
  };

  fs.writeFileSync(
    path.join(deploymentsDir, "amoy-deployment.json"),
    JSON.stringify(deploymentData, null, 2)
  );
  console.log(`Saved deployment details to: ${path.join(deploymentsDir, "amoy-deployment.json")}`);

  // Extract and save contract ABI for backend and frontend integration
  const artifactPath = path.join(__dirname, "../artifacts/contracts/MaritimeFineLedger.sol/MaritimeFineLedger.json");
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    fs.writeFileSync(
      path.join(deploymentsDir, "MaritimeFineLedgerABI.json"),
      JSON.stringify(artifact.abi, null, 2)
    );
    console.log(`Saved contract ABI to:        ${path.join(deploymentsDir, "MaritimeFineLedgerABI.json")}\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment Failed:", error);
    process.exit(1);
  });

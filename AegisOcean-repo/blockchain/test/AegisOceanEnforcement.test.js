const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AegisOceanEnforcement", function () {
  it("Should deploy cleanly and return zero initial incident count", async function () {
    const AegisOceanEnforcement = await ethers.getContractFactory("AegisOceanEnforcement");
    const contract = await AegisOceanEnforcement.deploy();
    await contract.waitForDeployment();

    expect(await contract.getIncidentCount()).to.equal(0);
  });
});

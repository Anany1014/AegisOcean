const { expect } = require("chai");
const IPFSService = require("../services/ipfsService");

describe("IPFS Service Unit Tests", function () {
  let ipfsService;

  const mockEvidenceFiles = {
    suspectMMSI: 367123456,
    satelliteImage: "data:image/tiff;base64,SUZEOQEAAAAAAQAB...",
    spillGeoJSON: {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[[12.49, 41.89], [12.50, 41.89], [12.50, 41.90], [12.49, 41.89]]]
      },
      properties: { areaSqKm: 4.2 }
    },
    driftData: { windSpeedKnots: 15, currentDirectionDeg: 140 },
    aisData: { trajectoryPoints: 120, highestProximityMMSI: 367123456 },
    pasReport: { attributionConfidence: 94.5, modelVersion: "v2.1" }
  };

  beforeEach(function () {
    ipfsService = new IPFSService();
  });

  it("1. Should create a complete evidence bundle with all 5 evidence types", function () {
    const bundle = ipfsService.createEvidenceBundle(mockEvidenceFiles);

    expect(bundle.title).to.include("AegisOcean");
    expect(bundle.suspectMMSI).to.equal(367123456);
    expect(bundle.evidenceFiles.satelliteImage).to.equal(mockEvidenceFiles.satelliteImage);
    expect(bundle.evidenceFiles.spillGeoJSON).to.deep.equal(mockEvidenceFiles.spillGeoJSON);
    expect(bundle.evidenceFiles.driftData).to.deep.equal(mockEvidenceFiles.driftData);
    expect(bundle.evidenceFiles.aisData).to.deep.equal(mockEvidenceFiles.aisData);
    expect(bundle.evidenceFiles.pasReport).to.deep.equal(mockEvidenceFiles.pasReport);
  });

  it("2. Should reject bundle creation if suspectMMSI is missing", function () {
    expect(() => {
      ipfsService.createEvidenceBundle({ satelliteImage: "test" });
    }).to.throw("suspectMMSI is required");
  });

  it("3. Should generate a valid 66-character 0x-prefixed SHA-256 evidence hash", function () {
    const bundle = ipfsService.createEvidenceBundle(mockEvidenceFiles);
    const hash = ipfsService.generateEvidenceHash(bundle);

    expect(hash).to.match(/^0x[a-fA-F0-9]{64}$/);
  });

  it("4. Should upload evidence bundle and return valid CID and evidenceHash", async function () {
    const bundle = ipfsService.createEvidenceBundle(mockEvidenceFiles);
    const result = await ipfsService.uploadEvidenceBundle(bundle);

    expect(result.ipfsCID).to.match(/^Qm/);
    expect(result.evidenceHash).to.match(/^0x[a-fA-F0-9]{64}$/);
    expect(result.timestamp).to.be.a("string");
  });
});

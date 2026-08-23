const IncidentService = require("./incidentService");

/**
 * @class AIPipelineAdapter
 * @notice Adapter interface connecting AegisOcean AI/ML detection outputs to IPFS + Blockchain.
 */
class AIPipelineAdapter {
  /**
   * @param {IncidentService} incidentService Initialized IncidentService instance
   */
  constructor(incidentService) {
    if (!incidentService) {
      throw new Error("AIPipelineAdapter requires an initialized IncidentService instance");
    }
    this.incidentService = incidentService;
  }

  /**
   * Event listener / callback invoked when AI detection pipeline completes.
   * Transforms AI pipeline output into the IncidentService format, uploads evidence to IPFS, and logs to smart contract.
   * @param {Object} aiDetectionResult AI pipeline output object
   * @returns {Promise<Object>} Anchored incident summary including incidentId, ipfsCID, evidenceHash, transactionHash
   */
  async onDetectionCompleted(aiDetectionResult) {
    if (!aiDetectionResult) {
      throw new Error("AI detection result object cannot be empty");
    }

    const rawArea = Number(aiDetectionResult.spillAreaSqKm || aiDetectionResult.spill_area || aiDetectionResult.area_sq_km || 0);

    // Normalizes parameters from Python or Node.js AI models (converting float areas to uint256 integers for Solidity)
    const forensicPayload = {
      suspectMMSI: Number(aiDetectionResult.suspectMMSI || aiDetectionResult.mmsi || aiDetectionResult.vessel_mmsi || 0),
      spillAreaSqKm: Math.round(rawArea),
      attributionScore: Math.round(Number(aiDetectionResult.attributionScore || aiDetectionResult.attribution_score || aiDetectionResult.confidence || 0)),
      satelliteImage: aiDetectionResult.satelliteImage || aiDetectionResult.satellite_image || aiDetectionResult.image_url || null,
      spillGeoJSON: aiDetectionResult.spillGeoJSON || aiDetectionResult.spill_geojson || aiDetectionResult.geojson || null,
      driftData: aiDetectionResult.driftData || aiDetectionResult.drift_info || aiDetectionResult.hydrodynamic_result || null,
      aisData: aiDetectionResult.aisData || aiDetectionResult.ais_result || aiDetectionResult.ais_trajectory || null,
      pasReport: aiDetectionResult.pasReport || aiDetectionResult.pas_report || null
    };

    return await this.incidentService.processAndAnchorIncident(forensicPayload);
  }
}

module.exports = AIPipelineAdapter;

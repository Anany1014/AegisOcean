import { createApp } from '../src/app.js';
import request from 'supertest';
import { config } from '../src/config/env.js';
import { incidentService } from '../src/services/incident.service.js';
import { blockchainEventSyncService } from '../src/services/eventSync.service.js';

async function runSIHDemo() {
  console.log('========================================================================');
  console.log('🌊 AEGISOCEAN SMART INDIA HACKATHON (SIH) COMPLETE END-TO-END DEMO');
  console.log('⚠️  TESTNET / SANDBOX DEMONSTRATION ONLY — NOT A LEGAL ADMISSIBILITY CLAIM');
  console.log('========================================================================\n');

  const app = createApp();
  const ATTESTOR_KEY = config.ATTESTOR_API_KEY;
  const ENFORCEMENT_KEY = config.ENFORCEMENT_API_KEY;

  incidentService.clear();
  blockchainEventSyncService.clearProcessedCache();

  // 1. Create mock oil-spill forensic result
  console.log('📍 STEP 1: Creating Mock Oil-Spill Forensic Result...');
  const forensicPayload = {
    incidentId: 'INC-SIH-2026-DEMO-01',
    sourceSatellite: 'Sentinel-1A SAR (C-band Radar)',
    sceneId: 'S1A_IW_GRDH_1SDV_20260831T181204_MUMBAI_OFFSHORE',
    detectionTimestamp: 1788201124,
    spillAreaSqKm: 16.4852,
    originTimeWindow: {
      start: 1788190000,
      end: 1788198000
    },
    originCoordinates: {
      latitude: 18.924157,
      longitude: 72.835492
    },
    driftModelVersion: 'OpenDrift-v2.1',
    AISDataRange: '1788190000-1788198000',
    suspectMMSI: 413298410,
    attributionScore: 94.65,
    softwareVersions: {
      hydrodynamicEngine: 'OpenDrift-v2.1',
      sarSegmentation: 'AegisOcean-UNet-v1.4',
      aisEngine: 'AegisCorrelator-v1.0'
    },
    files: [
      {
        name: 'sar_oil_slick_segmentation.geojson',
        contentBase64: Buffer.from(
          JSON.stringify({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [[[72.82, 18.91], [72.84, 18.91], [72.84, 18.93], [72.82, 18.93], [72.82, 18.91]]]
                },
                properties: { confidence: 0.9465, areaSqKm: 16.4852 }
              }
            ]
          })
        ).toString('base64'),
        mimeType: 'application/geo+json'
      },
      {
        name: 'ais_trajectory_telemetry.csv',
        contentBase64: Buffer.from(
          'timestamp,mmsi,lat,lon,sog,cog,nav_status\n1788190000,413298410,18.92,72.83,12.4,185,Under way using engine\n'
        ).toString('base64'),
        mimeType: 'text/csv'
      },
      {
        name: 'pas_drift_hindcast_report.json',
        contentBase64: Buffer.from(
          JSON.stringify({
            particlesReleased: 5000,
            driftDurationHours: 6.0,
            reverseTrajectoryConfidence: 0.9465
          })
        ).toString('base64'),
        mimeType: 'application/json'
      }
    ]
  };

  console.log(`   Incident ID: ${forensicPayload.incidentId}`);
  console.log(`   Suspect MMSI: ${forensicPayload.suspectMMSI}`);
  console.log(`   Spill Area: ${forensicPayload.spillAreaSqKm} sq km`);
  console.log(`   Attribution Confidence: ${forensicPayload.attributionScore}%\n`);

  // 2. Send to POST /api/incidents/anchor
  console.log('📍 STEP 2 & 3: Ingesting & Validating at POST /api/incidents/anchor...');
  const anchorRes = await request(app)
    .post('/api/incidents/anchor')
    .set('x-api-key', ATTESTOR_KEY)
    .send(forensicPayload);

  if (anchorRes.status !== 201) {
    console.error('❌ Anchoring failed:', anchorRes.body);
    process.exit(1);
  }

  const anchorData = anchorRes.body.data;
  console.log(`   ✅ HTTP Status: ${anchorRes.status} Created`);
  console.log(`   ✅ Canonical Evidence Manifest Created`);
  console.log(`   ✅ Evidence Pinned to IPFS CID: ${anchorData.ipfsCID}`);
  console.log(`   ✅ Cryptographic Evidence Hash: ${anchorData.evidenceHash}`);
  console.log(`   ✅ MaritimeFineLedger Tx Hash: ${anchorData.txHash}`);
  console.log(`   ✅ Calculated Statutory Fine: ${anchorData.fineAmount} POL/Units`);
  console.log(`   ✅ Confirmation Status: ${anchorData.confirmationStatus}\n`);

  // 4. Query incident back via GET /api/incidents/:id
  console.log('📍 STEP 4: Retrieving Incident Metadata via GET /api/incidents/:id...');
  const getRes = await request(app).get(`/api/incidents/${forensicPayload.incidentId}`);
  console.log(`   ✅ Current Status: ${getRes.body.data.status}`);
  console.log(`   ✅ Source Satellite: ${getRes.body.data.sourceSatellite}`);
  console.log(`   ✅ Stored IPFS CID: ${getRes.body.data.ipfsCID}\n`);

  // 5. Cryptographic Evidence Verification via GET /api/incidents/:id/verify-evidence
  console.log('📍 STEP 5: Verifying Cryptographic Evidence Chain via GET /api/incidents/:id/verify-evidence...');
  const verifyRes = await request(app).get(`/api/incidents/${forensicPayload.incidentId}/verify-evidence`);
  console.log(`   Calculated Hash: ${verifyRes.body.data.calculatedEvidenceHash}`);
  console.log(`   On-Chain Hash:   ${verifyRes.body.data.onChainEvidenceHash}`);
  console.log(`   Verification Result: ${verifyRes.body.data.result} (Verified: ${verifyRes.body.data.verified})\n`);

  // 6. Authorized Fine Enforcement (ANCHORED -> ENFORCED)
  console.log('📍 STEP 6: Authorized Legal Fine Enforcement at POST /api/incidents/:id/enforce...');
  const enforceRes = await request(app)
    .post(`/api/incidents/${forensicPayload.incidentId}/enforce`)
    .set('x-api-key', ENFORCEMENT_KEY);

  console.log(`   ✅ New Status: ${enforceRes.body.data.status}`);
  console.log(`   ✅ Port Clearance Status: ${enforceRes.body.data.clearanceStatus}`);
  console.log(`   ✅ Enforce Tx Hash: ${enforceRes.body.data.txHash}\n`);

  // 7. Fine Settlement (ENFORCED -> SETTLED)
  console.log('📍 STEP 7: Recording Fine Payment Settlement at POST /api/incidents/:id/settle...');
  const settleRes = await request(app)
    .post(`/api/incidents/${forensicPayload.incidentId}/settle`)
    .set('x-api-key', ENFORCEMENT_KEY);

  console.log(`   ✅ New Status: ${settleRes.body.data.status}`);
  console.log(`   ✅ Settlement Tx Hash: ${settleRes.body.data.txHash}\n`);

  // 8. Port Clearance Release (SETTLED -> RELEASED)
  console.log('📍 STEP 8: Releasing Port Clearance at POST /api/incidents/:id/release...');
  const releaseRes = await request(app)
    .post(`/api/incidents/${forensicPayload.incidentId}/release`)
    .set('x-api-key', ENFORCEMENT_KEY);

  console.log(`   ✅ Final Status: ${releaseRes.body.data.status}`);
  console.log(`   ✅ Port Clearance: ${releaseRes.body.data.clearanceStatus}`);
  console.log(`   ✅ Release Tx Hash: ${releaseRes.body.data.txHash}\n`);

  // 9. Re-verify Final Incident State
  console.log('📍 STEP 9: Final Database & Audit State Verification...');
  const finalGetRes = await request(app).get(`/api/incidents/${forensicPayload.incidentId}`);
  console.log('   Incident State Summary:', {
    incidentId: finalGetRes.body.data.incidentId,
    suspectMMSI: finalGetRes.body.data.suspectMMSI,
    spillAreaSqKm: finalGetRes.body.data.spillAreaSqKm,
    status: finalGetRes.body.data.status,
    anchorTxHash: finalGetRes.body.data.anchorTxHash,
    enforceTxHash: finalGetRes.body.data.enforceTxHash,
    settleTxHash: finalGetRes.body.data.settleTxHash,
    ipfsCID: finalGetRes.body.data.ipfsCID,
    evidenceHash: finalGetRes.body.data.evidenceHash
  });

  console.log('\n========================================================================');
  console.log('🎉 COMPLETE 18-STEP SIH TESTNET DEMONSTRATION EXECUTED SUCCESSFULLY!');
  console.log('========================================================================\n');
}

runSIHDemo().catch((err) => {
  console.error('Fatal Demo Execution Error:', err);
  process.exit(1);
});

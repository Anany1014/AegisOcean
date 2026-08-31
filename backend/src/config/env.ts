import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Builds a required-in-production string schema.
 * In production: field is strictly required with no default.
 * In dev/test: falls back to the provided default.
 */
function sensitiveString(devDefault: string) {
  return z
    .string()
    .optional()
    .transform((val, ctx) => {
      if (val && val.length > 0) return val;
      if (process.env.NODE_ENV === 'production') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `This sensitive environment variable is required in production and has no default value`
        });
        return z.NEVER;
      }
      return devDefault;
    });
}

const envSchema = z.object({
  PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:5173'),

  // Blockchain RPC URL & aliases
  RPC_URL: z.string().url().default('https://rpc-amoy.polygon.technology'),
  BLOCKCHAIN_RPC_URL: z.string().url().optional(),

  CHAIN_ID: z.string().default('80002').transform((val) => parseInt(val, 10)),

  // Contract Address & aliases
  CONTRACT_ADDRESS: z.string().default('0x0000000000000000000000000000000000000000'),
  MARITIME_FINE_LEDGER_ADDRESS: z.string().optional(),

  BLOCK_EXPLORER_URL: z.string().default('https://amoy.polygonscan.com'),

  // Server-Side Blockchain Signers — Required in production, safe dev fallbacks only
  ATTESTOR_PRIVATE_KEY: sensitiveString('0x0000000000000000000000000000000000000000000000000000000000000001'),
  BLOCKCHAIN_PRIVATE_KEY: z.string().optional(),
  ENFORCEMENT_PRIVATE_KEY: sensitiveString('0x0000000000000000000000000000000000000000000000000000000000000002'),

  // Role-Based API Access Keys — Required in production
  ENFORCEMENT_API_KEY: sensitiveString('aegis-enforcement-auth-key-2026'),
  ATTESTOR_API_KEY: sensitiveString('aegis-evidence-attestor-key-2026'),
  ADMIN_API_KEY: sensitiveString('aegis-admin-key-2026'),

  // Pinata / IPFS Credentials
  PINATA_API_KEY: z.string().optional().default(''),
  PINATA_SECRET_KEY: z.string().optional().default(''),
  PINATA_API_SECRET: z.string().optional().default(''),
  PINATA_JWT: z.string().optional().default(''),
  IPFS_GATEWAY: z.string().default('https://gateway.pinata.cloud/ipfs/'),

  // Statutory Fine Calculation Defaults
  DEFAULT_BASE_FINE: z.string().default('1000').transform((val) => parseFloat(val)),
  DEFAULT_AREA_MULTIPLIER: z.string().default('500').transform((val) => parseFloat(val)),

  // ML Inference Server
  ML_SERVER_URL: z.string().url().default('http://localhost:8001')
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment configuration');
  }
  const data = result.data;

  // Resolve aliases
  if (data.BLOCKCHAIN_RPC_URL) {
    data.RPC_URL = data.BLOCKCHAIN_RPC_URL;
  }
  if (data.MARITIME_FINE_LEDGER_ADDRESS) {
    data.CONTRACT_ADDRESS = data.MARITIME_FINE_LEDGER_ADDRESS;
  }
  if (data.BLOCKCHAIN_PRIVATE_KEY) {
    data.ATTESTOR_PRIVATE_KEY = data.BLOCKCHAIN_PRIVATE_KEY;
  }
  if (!data.PINATA_SECRET_KEY && data.PINATA_API_SECRET) {
    data.PINATA_SECRET_KEY = data.PINATA_API_SECRET;
  }

  return data;
};

export const config = parseEnv();
export type Config = z.infer<typeof envSchema>;

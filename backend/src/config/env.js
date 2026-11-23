import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env explicitly
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback to current working directory if present

const requiredEnvVars = [
  'MONGODB_URI',
  'SESSION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET'
];

export function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const prodRequired = [...requiredEnvVars];

  if (isProd) {
    prodRequired.push('TOKEN_ENCRYPTION_KEY');
    prodRequired.push('GOOGLE_REDIRECT_URI');
    prodRequired.push('FRONTEND_URL');
  }

  const missing = prodRequired.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const msg = `[Security] Missing required environment variables: ${missing.join(', ')}`;
    if (isProd) {
      throw new Error(msg);
    } else {
      console.warn(`[WARN] ${msg}`);
      console.warn('[WARN] Please ensure backend/.env is properly configured.');
    }
  }

  if (isProd && process.env.SESSION_SECRET === 'dev_session_secret_replace_in_production_12345') {
    throw new Error('[Security] Insecure default SESSION_SECRET cannot be used in production.');
  }

  // Validate TOKEN_ENCRYPTION_KEY if provided
  const encKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (encKey) {
    const trimmed = encKey.trim();
    const isHex64 = /^[0-9a-fA-F]{64}$/.test(trimmed);
    const isBase64_44 = /^[A-Za-z0-9+/=]{44}$/.test(trimmed);
    const isRaw32 = Buffer.byteLength(trimmed, 'utf8') === 32;

    if (!isHex64 && !isBase64_44 && !isRaw32) {
      const err = '[Security] TOKEN_ENCRYPTION_KEY must be a 64-character hex string, 44-character base64 string, or 32 raw bytes.';
      if (isProd) {
        throw new Error(err);
      } else {
        console.warn(`[WARN] ${err}`);
      }
    }
  } else if (!isProd) {
    console.warn('[WARN] TOKEN_ENCRYPTION_KEY is not set. Generating a random key for development or setting one in backend/.env is strongly recommended.');
  }
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/intelligent_email_assistant',
  sessionSecret: process.env.SESSION_SECRET || 'dev_session_secret_replace_in_production_12345',
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  trustProxy: process.env.TRUST_PROXY !== undefined ? process.env.TRUST_PROXY : (process.env.NODE_ENV === 'production' ? 1 : 0),
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || '',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback',
    // Scopes minimized to least privilege:
    // gmail.modify covers all reading (messages.get, messages.list), sending (messages.send),
    // and label/trash modifications. gmail.readonly and gmail.send are redundant.
    scopes: [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ]
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL || '',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    embeddingModel: process.env.EMBEDDING_MODEL || 'gemini-embedding-001',
    embeddingDimension: 768,
    vectorIndexName: process.env.ATLAS_VECTOR_INDEX || 'vector_index'
  }
};

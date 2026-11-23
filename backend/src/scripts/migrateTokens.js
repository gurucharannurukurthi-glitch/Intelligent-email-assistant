import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import {
  encryptToken,
  isEncrypted
} from '../services/tokenEncryptionService.js';

/**
 * Migration Script: Safely encrypts all legacy plaintext Google OAuth tokens in MongoDB.
 *
 * Safety guarantees:
 * - Idempotent: Tokens already prefixed with `enc:v1:` are skipped.
 * - Non-destructive: Does not modify or drop user accounts, emails, or sessions.
 * - Atomic per user: Each user record is updated independently.
 * - Does not log sensitive tokens.
 */
export async function runTokenMigration() {
  console.log('[Migration] Starting Google OAuth token encryption migration...');

  await connectDB();

  const users = await User.find({
    $or: [
      { 'googleTokens.accessToken': { $exists: true, $ne: null } },
      { 'googleTokens.refreshToken': { $exists: true, $ne: null } }
    ]
  });

  console.log(`[Migration] Found ${users.length} total user(s) with Google token records.`);

  let migratedCount = 0;
  let alreadyEncryptedCount = 0;
  let skippedNoTokenCount = 0;

  for (const user of users) {
    const accessToken = user.googleTokens?.accessToken;
    const refreshToken = user.googleTokens?.refreshToken;

    const accessNeedsEnc = accessToken && !isEncrypted(accessToken);
    const refreshNeedsEnc = refreshToken && !isEncrypted(refreshToken);

    if (accessNeedsEnc || refreshNeedsEnc) {
      const updateData = {};
      if (accessNeedsEnc) {
        updateData['googleTokens.accessToken'] = encryptToken(accessToken);
      }
      if (refreshNeedsEnc) {
        updateData['googleTokens.refreshToken'] = encryptToken(refreshToken);
      }

      await User.findByIdAndUpdate(user._id, { $set: updateData });
      migratedCount++;
      console.log(`[Migration] Successfully encrypted tokens for user ID: ${user._id} (${user.email})`);
    } else if (isEncrypted(accessToken) || isEncrypted(refreshToken)) {
      alreadyEncryptedCount++;
    } else {
      skippedNoTokenCount++;
    }
  }

  console.log('==============================================');
  console.log(`[Migration] Token encryption migration complete:`);
  console.log(`  - Migrated (newly encrypted): ${migratedCount}`);
  console.log(`  - Already encrypted:         ${alreadyEncryptedCount}`);
  console.log(`  - Skipped (no active token): ${skippedNoTokenCount}`);
  console.log('==============================================');

  await disconnectDB();
  return { migratedCount, alreadyEncryptedCount, skippedNoTokenCount };
}

// Execute directly if run via node CLI
if (process.argv[1] && process.argv[1].endsWith('migrateTokens.js')) {
  runTokenMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Migration] Migration failed with error:', err.message);
      process.exit(1);
    });
}

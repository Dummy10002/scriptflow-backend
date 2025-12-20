import crypto from 'crypto';

export function generateRequestHash(manychatUserId: string, reelUrl: string, userIdea: string): string {
  const data = `${manychatUserId}-${reelUrl}-${userIdea}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

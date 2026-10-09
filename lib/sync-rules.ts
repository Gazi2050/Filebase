/**
 * Last-write-wins rule shared by the client sync engine and the server
 * sync endpoint. A row wins when it is newer than what we have, unless a
 * deletion tombstone is at least as new (deletions beat resurrection).
 */
export function incomingShouldWin(
  existingUpdatedAt: number | undefined,
  incomingUpdatedAt: number,
  deletedAt?: number
): boolean {
  if (deletedAt !== undefined && deletedAt >= incomingUpdatedAt) {
    return false;
  }
  return existingUpdatedAt === undefined || incomingUpdatedAt > existingUpdatedAt;
}

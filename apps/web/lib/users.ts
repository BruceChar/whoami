/**
 * Web users — thin re-export of the shared user registry (in @delphi/core).
 * The CLI management commands operate on the same registry/profiles.
 */
export type { UserAccount } from "@delphi/core";
export {
  validateUsername,
  usersFile,
  userDir,
  loadUsers,
  findUserByUsername,
  findUserById,
  newUserId,
  publicUser,
  createLocalUser,
  verifyLocalLogin,
  ensureProfileNickname,
} from "@delphi/core";

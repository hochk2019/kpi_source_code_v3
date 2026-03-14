import type { AuthPermissionMap } from '../auth/authTypes.js';
import type { TeamRoster } from './teamRosterDocument.js';

export type TeamsActor = {
  username: string;
  role: string;
  name: string;
  permissions: AuthPermissionMap;
  memberId: string | null;
  memberName: string | null;
  teamId: string | null;
  teamName: string | null;
};

export interface TeamsStore {
  writeRoster(roster: TeamRoster): Promise<TeamRoster>;
}

import { TeamsRepository } from './TeamsRepository.js';
import { normalizeTeamRoster, type TeamRoster } from './teamRosterDocument.js';
import type { TeamsActor, TeamsStore } from './teamsStore.js';

export type TeamsListResponse = {
  version: 1;
  teams: Array<{
    id: string;
    name: string;
    memberCount: number;
    members: Array<{
      id: string;
      name: string;
      notes?: string;
    }>;
  }>;
};

export class TeamsHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TeamsHttpError';
  }
}

export class TeamsService {
  constructor(
    private readonly repository: TeamsRepository,
    private readonly store: TeamsStore,
  ) {}

  async listTeams(): Promise<TeamsListResponse> {
    const roster = await this.repository.listRoster();
    return mapRosterForClient(roster);
  }

  async replaceRoster(actor: TeamsActor, payload: unknown): Promise<TeamsListResponse> {
    this.requireTeamsManage(actor);
    const roster = normalizeTeamRoster(payload);
    const persisted = await this.store.writeRoster(roster);
    return mapRosterForClient(persisted);
  }

  private requireTeamsManage(actor: TeamsActor): void {
    if (!actor.permissions.teamsEdit && !actor.permissions.accountManage) {
      throw new TeamsHttpError(403, 'forbidden', 'Bạn không có quyền quản lý tổ đội.');
    }
  }
}

function mapRosterForClient(roster: TeamRoster): TeamsListResponse {
  return {
    version: roster.version,
    teams: roster.teams.map((team) => ({
      id: team.id,
      name: team.name,
      memberCount: team.members.length,
      members: team.members.map((member) => ({ ...member })),
    })),
  };
}

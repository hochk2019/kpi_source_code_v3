import type { TeamRosterAsyncReader } from './teamRosterAsyncReader.js';
import { normalizeTeamRoster, type TeamRoster } from './teamRosterDocument.js';

export type { TeamMember, TeamRecord, TeamRoster } from './teamRosterDocument.js';

export class TeamsRepository {
  constructor(private readonly reader: TeamRosterAsyncReader) {}

  async listRoster(): Promise<TeamRoster> {
    const raw = await this.reader.readTeamRoster();
    return normalizeTeamRoster(raw);
  }
}

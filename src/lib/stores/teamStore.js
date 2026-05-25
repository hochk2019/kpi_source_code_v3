// Domain barrel: Team Roster Store
// Re-exports team-related operations

export {
  TEAM_KEY,
} from '../storeRuntime.js';

export {
  // Read
  getTeamRoster,
  subscribeTeamRoster,
  mapMemberNamesToTeams,
  // Write
  setTeamRoster,
  applyTeamRosterToMST,
} from '../teamRoster.js';

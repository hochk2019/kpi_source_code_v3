import type { AuthPermissionMap } from '../auth/authTypes.js';
import type { KpiRuleCollection } from './kpiRuleDefaults.js';

export type KpiRulesActor = {
  username: string;
  role: string;
  name: string;
  permissions: AuthPermissionMap;
  memberId: string | null;
  memberName: string | null;
  teamId: string | null;
  teamName: string | null;
};

export interface KpiRulesStore {
  writeRuleCollection(collection: KpiRuleCollection): Promise<KpiRuleCollection>;
}

export function cloneKpiRuleCollection(collection: KpiRuleCollection): KpiRuleCollection {
  return JSON.parse(JSON.stringify(collection)) as KpiRuleCollection;
}

import { defineDomainModule, type DomainModule, type DomainRouteGroup } from '../app/domain-module.js';

type DomainModuleInput = {
  id: string;
  basePath: string;
  description: string;
  schemaTargets: readonly string[];
  routeGroups: readonly DomainRouteGroup[];
};

function toClassName(moduleId: string): string {
  return moduleId
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join('');
}

export function createDomainModule(input: DomainModuleInput): DomainModule {
  const className = toClassName(input.id);
  return defineDomainModule({
    id: input.id,
    basePath: input.basePath,
    description: input.description,
    schemaTargets: [...input.schemaTargets],
    layers: {
      controller: `${className}Controller`,
      service: `${className}Service`,
      repository: `${className}Repository`,
    },
    routeGroups: [...input.routeGroups],
  });
}

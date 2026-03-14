import { z } from 'zod';

const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const domainRouteSchema = z.object({
  method: httpMethodSchema,
  path: z.string().min(1),
  purpose: z.string().min(1),
});

const domainRouteGroupSchema = z.object({
  name: z.string().min(1),
  routes: z.array(domainRouteSchema).min(1),
});

const domainLayerSchema = z.object({
  controller: z.string().min(1),
  service: z.string().min(1),
  repository: z.string().min(1),
});

export const domainModuleSchema = z.object({
  id: z.string().min(1),
  basePath: z.string().startsWith('/api/v4/'),
  description: z.string().min(1),
  schemaTargets: z.array(z.string().min(1)).min(1),
  layers: domainLayerSchema,
  routeGroups: z.array(domainRouteGroupSchema).min(1),
});

export const domainModuleCatalogSchema = z.array(domainModuleSchema).min(1);

export type DomainModule = z.infer<typeof domainModuleSchema>;
export type DomainRouteGroup = z.infer<typeof domainRouteGroupSchema>;

export function defineDomainModule(module: DomainModule): DomainModule {
  return domainModuleSchema.parse(module);
}

export function serializeDomainModules(modules: readonly DomainModule[]): DomainModule[] {
  return domainModuleCatalogSchema.parse(modules);
}

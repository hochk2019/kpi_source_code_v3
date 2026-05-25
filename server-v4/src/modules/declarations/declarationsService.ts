import { DeclarationsRepository, type DeclarationFilters, type DeclarationRecord } from './DeclarationsRepository.js';
import {
  applyDeclarationPatch,
  normalizeDeclarationPatch,
  type DeclarationActor,
  type DeclarationEventRecord,
  type DeletedDeclarationFilters,
  type DeletedDeclarationRecord,
  type DeclarationStoreTarget,
  type DeclarationsStore,
} from './declarationsStore.js';

export type DeclarationsListQuery = DeclarationFilters & {
  limit?: number;
};

export type DeclarationsListResponse = {
  total: number;
  items: DeclarationRecord[];
};

export type DeclarationsImportSearchQuery = {
  filters?: unknown;
  page?: number;
  pageSize?: number;
};

export type DeclarationsImportSearchResponse = {
  total: number;
  page: number;
  pageSize: number;
  rows: DeclarationRecord[];
};

export type DeclarationEventsQuery = {
  limit?: number;
};

export type DeclarationEventsResponse = {
  total: number;
  items: DeclarationEventRecord[];
};

export class DeclarationsHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DeclarationsHttpError';
  }
}

export class DeclarationsService {
  private static readonly IMPORT_SEARCH_DEFAULT_PAGE_SIZE = 10;

  private static readonly IMPORT_SEARCH_MAX_PAGE_SIZE = 200;

  constructor(
    private readonly repository: DeclarationsRepository,
    private readonly store: DeclarationsStore,
  ) {}

  async listDeclarations(query: DeclarationsListQuery = {}): Promise<DeclarationsListResponse> {
    const matches = await this.repository.listDeclarations(query);
    const limit = Number.isFinite(query.limit) && query.limit && query.limit > 0 ? Math.floor(query.limit) : null;

    return {
      total: matches.length,
      items: limit ? matches.slice(0, limit) : matches,
    };
  }

  async searchImportDeclarations(
    query: DeclarationsImportSearchQuery = {},
  ): Promise<DeclarationsImportSearchResponse> {
    const matches = await this.repository.searchDeclarations(query.filters);
    const pageValue = Number(query.page);
    const requestedPageSize = Number(query.pageSize);
    const page = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;
    const pageSizeCandidate =
      Number.isFinite(requestedPageSize) && requestedPageSize > 0
        ? Math.floor(requestedPageSize)
        : DeclarationsService.IMPORT_SEARCH_DEFAULT_PAGE_SIZE;
    const pageSize = Math.max(
      1,
      Math.min(pageSizeCandidate, DeclarationsService.IMPORT_SEARCH_MAX_PAGE_SIZE),
    );
    const total = matches.length;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, maxPage);
    const offset = (safePage - 1) * pageSize;

    return {
      total,
      page: safePage,
      pageSize,
      rows: matches.slice(offset, offset + pageSize),
    };
  }

  async listDeletedDeclarations(
    filters: DeletedDeclarationFilters = {},
  ): Promise<DeletedDeclarationRecord[]> {
    return this.store.listDeletedDeclarations(filters);
  }

  async patchDeclaration(
    actor: DeclarationActor,
    declarationId: string,
    payload: Record<string, unknown>,
  ): Promise<DeclarationRecord> {
    this.requireEditor(actor);
    const target = await this.readTarget(declarationId);

    if (target.current.reviewed && !actor.permissions.accountManage) {
      throw new DeclarationsHttpError(409, 'review_locked', 'Tờ khai đã rà soát chỉ quản trị viên mới được chỉnh sửa.');
    }

    const normalizedPatch = normalizeDeclarationPatch(payload);
    if (normalizedPatch.requestedFields.length === 0) {
      throw new DeclarationsHttpError(400, 'invalid_request', 'Không có trường tờ khai hợp lệ để cập nhật.');
    }

    const preview = applyDeclarationPatch(target.current, normalizedPatch);
    if (!preview.changed) {
      throw new DeclarationsHttpError(400, 'no_change', 'Không có thay đổi mới để lưu cho tờ khai.');
    }

    const stored = await this.store.patchDeclaration(target, normalizedPatch, actor);
    const normalizedRecord = this.repository.coerceDeclarationRecord(stored);
    if (!normalizedRecord) {
      throw new DeclarationsHttpError(500, 'internal_error', 'Không thể chuẩn hoá tờ khai sau khi cập nhật.');
    }

    return normalizedRecord;
  }

  async listDeclarationEvents(
    declarationId: string,
    query: DeclarationEventsQuery = {},
  ): Promise<DeclarationEventsResponse> {
    const target = await this.readTarget(declarationId);
    const events = await this.store.listDeclarationEvents(target);
    const limit = Number.isFinite(query.limit) && query.limit && query.limit > 0 ? Math.floor(query.limit) : null;

    return {
      total: events.length,
      items: limit ? events.slice(0, limit) : events,
    };
  }

  private async readTarget(declarationId: string): Promise<DeclarationStoreTarget> {
    const normalizedId = `${declarationId ?? ''}`.trim();
    if (!normalizedId) {
      throw new DeclarationsHttpError(400, 'invalid_request', 'Thiếu mã tờ khai cần thao tác.');
    }

    const current = await this.repository.readDeclarationByIdentifier(normalizedId);
    if (!current) {
      throw new DeclarationsHttpError(404, 'not_found', 'Không tìm thấy tờ khai cần thao tác.');
    }

    return {
      id: current.id,
      key: current.key,
      declarationId: `${current.declaration_id ?? current.declarationId ?? ''}`.trim() || null,
      soTk: current.so_tk,
      nhanh: current.nhanh,
      current,
    };
  }

  private requireEditor(actor: DeclarationActor): void {
    if (!actor.permissions.importEdit && !actor.permissions.accountManage) {
      throw new DeclarationsHttpError(403, 'forbidden', 'Bạn không có quyền chỉnh sửa tờ khai.');
    }
  }
}

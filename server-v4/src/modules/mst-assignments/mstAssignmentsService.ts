import { MstAssignmentsRepository, type MstAssignment } from './MstAssignmentsRepository.js';

export type ListMstAssignmentsInput = {
  mst?: string;
};

export type ResolveMstAssignmentInput = {
  mst: string;
  date?: string;
};

export class MstAssignmentsService {
  constructor(private readonly repository: MstAssignmentsRepository) {}

  async listAssignments(input: ListMstAssignmentsInput): Promise<{ items: MstAssignment[] }> {
    return {
      items: await this.repository.listAssignments(input),
    };
  }

  async resolveAssignment(
    input: ResolveMstAssignmentInput,
  ): Promise<{ assignment: MstAssignment | null }> {
    return {
      assignment: await this.repository.resolveAssignment(input.mst, input.date),
    };
  }
}

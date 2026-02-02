import { getTimeRepo } from '@/repos';

const repo = getTimeRepo();

export const closeTimeEntryById = repo.closeTimeEntryById;
export const createTimeEntry = repo.createTimeEntry;
export const findActiveTimeEntryForUser = repo.findActiveTimeEntryForUser;
export const findLatestTimeEntriesForUserParts = repo.findLatestTimeEntriesForUserParts;
export const findLatestTimeEntryForUserOrder = repo.findLatestTimeEntryForUserOrder;
export const findTimeEntryById = repo.findTimeEntryById;
export const listTimeEntriesForOrderParts = repo.listTimeEntriesForOrderParts;

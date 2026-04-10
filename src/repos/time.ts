import { getTimeRepo } from '@/repos';

const repo = getTimeRepo();

export const closeTimeEntryById = repo.closeTimeEntryById;
export const createTimeEntry = repo.createTimeEntry;
export const findActiveTimeEntryForUser = repo.findActiveTimeEntryForUser;
export const findActiveTimeEntryForUserDepartment = repo.findActiveTimeEntryForUserDepartment;
export const findLatestTimeEntriesForUserParts = repo.findLatestTimeEntriesForUserParts;
export const findLatestTimeEntryForUserOrder = repo.findLatestTimeEntryForUserOrder;
export const findTimeEntryById = repo.findTimeEntryById;
export const listActiveTimeEntriesForUser = repo.listActiveTimeEntriesForUser;
export const listTimeEntriesForOrderParts = repo.listTimeEntriesForOrderParts;
export const listTimeEntriesForPartsDetailed = repo.listTimeEntriesForPartsDetailed;

export const updateClosedTimeEntryById = repo.updateClosedTimeEntryById;

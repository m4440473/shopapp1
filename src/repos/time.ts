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
export const listActiveTimeEntriesDetailed = repo.listActiveTimeEntriesDetailed;
export const listActiveTimeEntriesForPart = repo.listActiveTimeEntriesForPart;
export const listTimeEntriesForOrderParts = repo.listTimeEntriesForOrderParts;
export const listTimeEntriesForPartsDetailed = repo.listTimeEntriesForPartsDetailed;
export const createTimeEntryWithAction = repo.createTimeEntryWithAction;
export const switchTimeEntryWithActions = repo.switchTimeEntryWithActions;
export const closeWorkerTimeEntryWithAction = repo.closeWorkerTimeEntryWithAction;
export const updateClosedTimeEntryWithAudit = repo.updateClosedTimeEntryWithAudit;

export const updateClosedTimeEntryById = repo.updateClosedTimeEntryById;

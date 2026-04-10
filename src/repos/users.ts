import { getUsersRepo } from '@/repos';

const repo = getUsersRepo();

export const listUsers = repo.listUsers;
export const createUser = repo.createUser;
export const updateUser = repo.updateUser;
export const findUserById = repo.findUserById;
export const findUserByKioskId = repo.findUserByKioskId;
export const findKioskUserByPinEligibility = repo.findKioskUserByPinEligibility;
export const listKioskUsers = repo.listKioskUsers;

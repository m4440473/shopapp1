import { getUsersRepo } from '@/repos';

const repo = getUsersRepo();

export const listUsers = repo.listUsers;
export const createUser = repo.createUser;
export const updateUser = repo.updateUser;
export const findUserById = repo.findUserById;

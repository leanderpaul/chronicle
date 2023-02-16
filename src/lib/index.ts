/**
 * Importing npm packages.
 */

/**
 * Importing user defined packages.
 */

/**
 * Importing and defining types.
 */
import type { User, IUser, IUserSession } from './user';
import type { Expense, IExpense, IExpenseItem } from './expense';
import type { Metadata, IMetadata, IExpenseGroup } from './metadata';

interface ILibrary {
  user: User;
  expense: Expense;
  metadata: Metadata;
}

/**
 * Declaring the constants.
 */
const logger = global.getLogger('library');

let Library: ILibrary = {
  user: null as any,
  expense: null as any,
  metadata: null as any,
};

async function initLibrary() {
  if (Library.user || Library.expense) {
    logger.warn('Library already initiated');
  }
  const { User } = await import('./user');
  const { Expense } = await import('./expense');
  const { Metadata } = await import('./metadata');
  Library = { user: new User(), expense: new Expense(), metadata: new Metadata() };
  Object.freeze(Library);
  logger.debug('Library intiated');
  return Library;
}

export type { IUser, IUserSession, IExpense, IExpenseItem, IExpenseGroup, IMetadata };

export { Library, initLibrary };
export default Library;

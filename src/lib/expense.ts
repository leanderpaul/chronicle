/**
 * Importing npm packages.
 */
import sagus from 'sagus';
import { ObjectId } from 'mongodb';

/**
 * Importing user defined packages.
 */
import { Utils, Context, calculateTotal, AppError } from '@server/utils';
import { Library } from '@server/lib';

/**
 * Importing and defining types.
 */

export interface IExpenseItem {
  /** Name of the expense or bill item */
  name: string;
  /** The price for which the item is sold for */
  price: number;
  /** The quantity of the otem purchased, if this value is empty it means the quantity is one */
  qty?: number;
}

export interface IExpense {
  /** Expense ID ID of the  */
  eid: string;
  /** User ID to whom this expense is associated with' */
  uid: string;
  /** Bill ID that is mentioned in the bill or invoice */
  bid?: string;
  /** Name of the store from which this bill or invoice is issued */
  store: string;
  /** Store Location */
  storeAddr?: string;
  /** The date on which the bill or invoice was issued */
  date: number;
  /** The time of the bill */
  time?: number;
  /** Array containing the items that are in the bill */
  items: IExpenseItem[];
  /** payment method used to pay for this expense */
  pm?: string;
  /** Description of the expense */
  desc?: string;
  /** The currency used to pay the bill */
  currency: 'INR' | 'GBP';
  /** Total amount of the expense sent. It is the sum of the price of all the items in the bill */
  total: number;
}

export type IExpenseDoc = { uid: ObjectId } & Omit<IExpense, 'eid' | 'uid'>;

/**
 * Declaring the constants.
 */
const logger = global.getLogger('models:expense');
const expenseCollection = global.getCollection('expenses');

function validateExpense(input: Omit<IExpense, 'uid' | 'eid' | 'total'>) {
  const items = input.items.filter((item) => item.qty === undefined || item.qty > 0);
  if (!sagus.isValid(input.store)) throw new AppError('VALIDATION_ERROR', 'Invalid store');
  if (input.date > 200101 && input.date < 991231) throw new AppError('VALIDATION_ERROR', 'Invalid date');
  if (input.time && input.time > 0 && input.date < 2359) throw new AppError('VALIDATION_ERROR', 'Invalid time');
  if (items.some((i) => !sagus.isValid(i.name))) throw new AppError('VALIDATION_ERROR', 'Expense item name invalid');
  if (!/^(INR|GBP)$/.test(input.currency)) throw new AppError('VALIDATION_ERROR', 'Currency invalid or not supported');

  const obj = {
    bid: sagus.isValid(input.bid) ? input.bid.trim() : null,
    date: input.date,
    time: sagus.isValid(input.time) ? input.time : null,
    store: input.store.trim(),
    storeAddr: sagus.isValid(input.storeAddr) ? input.storeAddr.trim() : null,
    items: items.map((i) => ({ ...i, qty: i.qty && i.qty === 1 ? null : i.qty })),
    pm: sagus.isValid(input.pm) ? input.pm.trim() : null,
    total: calculateTotal(input.items),
    desc: sagus.isValid(input.desc) ? input.desc.trim() : null,
  };

  return sagus.trimObject(obj) as Omit<IExpense, 'eid' | 'uid'>;
}

export class Expense {
  async list(): Promise<IExpense[]> {
    const skip = 0;
    const limit = 20;
    const { uid } = Context.getCurrentUser();
    const expenses = await expenseCollection.find({ uid: new ObjectId(uid) }, { sort: { date: -1 }, limit, skip }).toArray();
    return expenses.map((obj) => ({ eid: obj._id.toString(), uid, ...sagus.removeKeys(obj, ['_id', 'uid']) }));
  }

  async findByID(eid: ObjectId | string): Promise<IExpense | null> {
    const { uid } = Context.getCurrentUser();
    if (typeof eid === 'string') eid = new ObjectId(eid);
    const expense = await expenseCollection.findOne({ _id: eid, uid: new ObjectId(uid) });
    if (!expense) return null;
    const obj = sagus.removeKeys(expense, ['_id', 'uid']);
    return { eid: expense._id.toString(), uid, ...obj };
  }

  async add(input: Omit<IExpense, 'uid' | 'eid' | 'total'>): Promise<IExpense> {
    const { uid } = Context.getCurrentUser();
    const obj = validateExpense(input);
    const expense = { uid, ...obj };
    const result = await expenseCollection.insertOne({ ...expense, uid: new ObjectId(uid) });
    await Library.metadata.incrementBillCounter(uid, 1);
    return { eid: result.insertedId.toString(), ...expense };
  }

  async update(eid: string | ObjectId, update: Omit<IExpense, 'uid' | 'eid' | 'total'>) {
    const { uid } = Context.getCurrentUser();
    if (typeof eid === 'string') eid = new ObjectId(eid);
    const updatedExpense = validateExpense(update);
    await expenseCollection.updateOne({ _id: eid, uid: new ObjectId(uid) }, { $set: updatedExpense });
    return { eid: eid.toString(), uid, ...updatedExpense };
  }

  async delete(eid: string | ObjectId) {
    const { uid } = Context.getCurrentUser();
    if (typeof eid === 'string') eid = new ObjectId(eid);
    await expenseCollection.deleteOne({ _id: eid, uid: new ObjectId(uid) });
    await Library.metadata.incrementBillCounter(uid, -1);
  }
}

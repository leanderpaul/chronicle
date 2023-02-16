/**
 * Importing npm packages.
 */
import sagus from 'sagus';
import { ObjectId } from 'mongodb';

/**
 * Importing user defined packages.
 */
import { Context, AppError, SERVICE_NAME } from '@server/utils';

/**
 * Importing and defining types.
 */
export interface IExpenseGroup {
  /** Expense group ID */
  id: number;
  /** Name of the expense group */
  name: string;
  // operation: number;
  /** Words to include in expense group */
  words: string[];
}

export interface IMetadata {
  /** User ID to whom this expense is associated with */
  uid: string;
  /** The service to which this metadata is associated with */
  service: 'chronicle';
  /** Array containg the expense groups associated with the user */
  groups: IExpenseGroup[];
  /** Array containg payment methods associated with the user */
  pms: string[];
  /** The total count of the expenses or bills that the user has added */
  billCount: number;
}

export type IMetadataDoc = { uid: ObjectId } & Omit<IMetadata, 'uid'>;

/**
 * Declaring the constants.
 */
const logger = global.getLogger('lib:metadata');
const metadataCollection = global.getCollection('metadata');

function validateExpenseGroup(input: Omit<IExpenseGroup, 'id'>) {
  if (!sagus.isValid(input.name)) throw new AppError('VALIDATION_ERROR', 'Expense group name invalid');
  const words = input.words.filter((w) => sagus.isValid(w));
  return { name: input.name, words };
}

export class Metadata {
  async findByUID(uid: string | ObjectId): Promise<IMetadata | null> {
    if (typeof uid === 'string') uid = new ObjectId(uid);
    const metadata = await metadataCollection.findOne({ uid, service: SERVICE_NAME });
    if (!metadata) return null;
    return { uid: uid.toString(), ...sagus.removeKeys(metadata, ['_id', 'uid']) };
  }

  async incrementBillCounter(uid: string | ObjectId, val = 1) {
    if (typeof uid === 'string') uid = new ObjectId(uid);
    await metadataCollection.updateOne({ uid, service: SERVICE_NAME }, { $inc: { billCount: val } });
  }

  async addPaymentmethod(paymentName: string) {
    const { uid } = Context.getCurrentUser();
    await metadataCollection.updateOne({ uid: new ObjectId(uid), service: SERVICE_NAME }, { $push: { paymentMethods: paymentName } });
  }

  async removePaymentmethod(paymentName: string) {
    const { uid } = Context.getCurrentUser();
    await metadataCollection.updateOne({ uid: new ObjectId(uid), service: SERVICE_NAME }, { $pull: { paymentMethods: paymentName } });
  }

  async addExpenseGroup(input: Omit<IExpenseGroup, 'id'>) {
    const { uid, metadata } = Context.getCurrentUser();
    const expenseGroup = validateExpenseGroup(input);
    const lastGroup = metadata.groups[metadata.groups.length - 1];
    const id = lastGroup ? lastGroup.id + 1 : 1;
    await metadataCollection.updateOne({ uid: new ObjectId(uid), service: SERVICE_NAME }, { $push: { groups: { id, ...expenseGroup } } });
  }

  async removeExpenseGroup(id: number) {
    const { uid } = Context.getCurrentUser();
    await metadataCollection.updateOne({ uid: new ObjectId(uid), service: SERVICE_NAME }, { $pull: { groups: { id } } });
  }

  async updateExpenseGroup(id: number, input: Omit<IExpenseGroup, 'id'>) {
    const { uid } = Context.getCurrentUser();
    const expenseGroup = validateExpenseGroup(input);
    const update = { 'groups.$.name': expenseGroup.name, 'groups.$.words': expenseGroup.words };
    await metadataCollection.updateOne({ uid: new ObjectId(uid), service: SERVICE_NAME, 'groups.id': id }, { $set: update });
  }
}

import { createCollection } from '../../DB/collection';

export const Supplier = createCollection('suppliers', { softDelete: true });

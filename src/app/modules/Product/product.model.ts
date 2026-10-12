import { createCollection } from '../../DB/collection';

export const Product = createCollection('products', { softDelete: true });

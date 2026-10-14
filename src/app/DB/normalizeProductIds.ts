import { Product } from '../modules/Product/product.model';

/**
 * One-time (idempotent) cleanup: older/manually-typed product IDs were
 * entered randomly (e.g. "011", "022"). This renumbers every product to a
 * clean, contiguous serial starting at 1, ordered by creation date, so the
 * sequence is predictable. Safe to run on every boot — it is a no-op once
 * the IDs are already sequential.
 */
export default async function normalizeProductIds(): Promise<void> {
  try {
    const products = await Product.find({ isDeleted: { $in: [true, false] } })
      .sort({ createdAt: 1 })
      .lean();

    if (!products.length) return;

    const alreadySequential = products.every(
      (p: any, idx: number) => String(p.productId) === String(idx + 1),
    );
    if (alreadySequential) return;

    for (let i = 0; i < products.length; i++) {
      const expected = String(i + 1);
      const doc: any = products[i];
      if (String(doc.productId) !== expected) {
        await Product.findByIdAndUpdate(doc._id, { productId: expected });
      }
    }
    console.log(`Product IDs normalized to a serial 1-${products.length} sequence.`);
  } catch (err) {
    console.error('Failed to normalize product IDs:', err);
  }
}

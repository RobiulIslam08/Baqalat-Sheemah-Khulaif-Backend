import httpStatus from 'http-status';
import AppError from '../errors/AppError';
import { Product } from '../modules/Product/product.model';
import { ProductLink } from '../modules/ProductLink/productLink.model';

export function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export async function resolveActiveProduct(code: string) {
  const value = String(code ?? '').trim();
  if (!value) return null;
  const byCode = await Product.findOne({ productCode: value });
  if (byCode) return byCode;
  const byId = await Product.findOne({ productId: value });
  if (byId) return byId;
  return Product.findOne({ barcodeValue: value });
}

export async function stockMove(product: { productCode: string; boxQty?: number }, type: string, quantity: number) {
  const qty = Number(quantity) || 0;
  if (type !== 'BOX') return { holderCode: product.productCode, units: qty };

  const link = await ProductLink.findOne({ boxProductCode: product.productCode });
  if (link) {
    if (link.singleProductCode === product.productCode) {
      throw new AppError(httpStatus.BAD_REQUEST, 'A product cannot be linked to itself');
    }
    const single = await resolveActiveProduct(link.singleProductCode);
    if (!single) {
      throw new AppError(httpStatus.BAD_REQUEST, `Linked single product ${link.singleProductCode} was not found`);
    }
    const per = Number(link.conversionQty) > 0 ? Number(link.conversionQty) : 1;
    return { holderCode: single.productCode, units: qty * per };
  }

  const per = Number(product.boxQty) > 0 ? Number(product.boxQty) : 1;
  return { holderCode: product.productCode, units: qty * per };
}

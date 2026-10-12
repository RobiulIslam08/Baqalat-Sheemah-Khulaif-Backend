import httpStatus from 'http-status';
import { startSession } from '../../DB/session';
import { Purchase } from './purchase.model';
import { IPurchase } from './purchase.interface';
import { ProductLink } from '../ProductLink/productLink.model';
import { SupplierCredit } from '../Credit/credit.model';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../utils/QueryBuilder';
import { resolveActiveProduct, roundMoney } from '../../utils/productStock';

const searchableFields = ['invoiceNo', 'purchaseOrderNo', 'createdBy'];

// Create purchase (adds stock)
const createPurchase = async (payload: IPurchase, userId: string) => {
  const session = await startSession();

  try {
    session.startTransaction();

    payload.createdBy = userId;

    // Check duplicate invoice
    const existing = await Purchase.findOne({ invoiceNo: payload.invoiceNo });
    if (existing) {
      throw new AppError(httpStatus.CONFLICT, 'Purchase invoice already exists');
    }

    let lineNet = 0;
    const stock = new Map<string, any>();
    const hold = async (code: string) => {
      const found = await resolveActiveProduct(code);
      if (!found) return null;
      if (!stock.has(found.productCode)) stock.set(found.productCode, found);
      return stock.get(found.productCode);
    };
    for (const item of payload.items) {
      const product = await hold(item.barcode || '');
      if (!product) {
        throw new AppError(httpStatus.BAD_REQUEST, `Product not found for ${item.barcode || item.itemName}`);
      }
      const qty = Number(item.totalQty) || 0;
      const free = Number(item.free) || 0;
      const price = Number(item.purchasePrice) || 0;
      const gross = qty * price;
      let discountAmt = Number(item.discountAmt) || 0;
      if (!discountAmt && Number(item.discountPercent) > 0) {
        discountAmt = roundMoney(gross * Number(item.discountPercent) / 100);
      }
      if (discountAmt > gross) {
        throw new AppError(httpStatus.BAD_REQUEST, `Discount cannot exceed the line total for ${item.itemName}`);
      }
      item.barcode = product.productCode;
      item.discountAmt = roundMoney(discountAmt);
      item.netAmount = roundMoney(gross - discountAmt);
      lineNet += item.netAmount;

      const received = qty + free;
      const link = await ProductLink.findOne({ boxProductCode: product.productCode });
      if (link) {
        if (link.singleProductCode === product.productCode) {
          throw new AppError(httpStatus.BAD_REQUEST, 'A product cannot be linked to itself');
        }
        const single = await hold(link.singleProductCode);
        if (!single) {
          throw new AppError(httpStatus.BAD_REQUEST, `Linked single product ${link.singleProductCode} was not found`);
        }
        const per = Number(link.conversionQty) > 0 ? Number(link.conversionQty) : 1;
        single.quantity += received * per;
        await single.save({ session });
      } else {
        const per = product.productType === 'BOX' && Number(product.boxQty) > 1 ? Number(product.boxQty) : 1;
        product.quantity += received * per;
      }
      if (item.sellingPrice > 0) product.sellingPrice = item.sellingPrice;
      product.purchasePrice = item.purchasePrice;
      await product.save({ session });
    }

    lineNet = roundMoney(lineNet);
    const headerDiscount = roundMoney(Number(payload.discount) || 0);
    const vat = roundMoney(Number(payload.vat) || 0);
    if (headerDiscount < 0 || vat < 0) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Discount and VAT cannot be negative');
    }
    if (headerDiscount > lineNet) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Discount cannot exceed the purchase total');
    }
    payload.netAmount = lineNet;
    payload.discount = headerDiscount;
    payload.vat = vat;
    payload.totalAmount = roundMoney(lineNet - headerDiscount + vat);

    const [result] = await Purchase.create([payload], { session });

    if (payload.supplier) {
      const supplier = typeof payload.supplier === 'string' ? payload.supplier : String(payload.supplier);
      await SupplierCredit.create({
        supplier,
        invoiceNo: payload.invoiceNo,
        dueAmount: payload.totalAmount,
        paidAmount: payload.totalAmount,
        remaining: 0,
        paymentDate: payload.invoiceDate || new Date().toISOString(),
        paymentMethod: payload.paymentMethod === 'creditCard' ? 'Card' : 'Cash',
        status: 'Settled',
        createdBy: userId,
      }, { session });
    }

    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Get all purchases with filters
const getAllPurchases = async (query: Record<string, unknown>) => {
  if (query.fromDate || query.toDate) query.dateField = 'invoiceDate';
  const purchaseQuery = new QueryBuilder(Purchase.find(), query)
    .search(searchableFields).filter().sort().paginate().fields();

  const result = await purchaseQuery.modelQuery.populate('supplier');
  const meta = await purchaseQuery.countTotal();
  return { meta, data: result };
};

// Get single purchase
const getPurchaseById = async (id: string) => {
  const purchase = await Purchase.findById(id).populate('supplier');
  if (!purchase) throw new AppError(httpStatus.NOT_FOUND, 'Purchase not found');
  return purchase;
};

export const PurchaseService = { createPurchase, getAllPurchases, getPurchaseById };

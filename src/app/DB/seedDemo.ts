import { Customer } from '../modules/Customer/customer.model';
import { Product } from '../modules/Product/product.model';
import { Sale } from '../modules/Sale/sale.model';
import { Settings } from '../modules/Settings/settings.model';
import { Supplier } from '../modules/Supplier/supplier.model';

const seedDemo = async () => {
  const existingSettings = await Settings.findOne();
  if (!existingSettings) {
    await Settings.create({
      storeName: 'بقالة شيمه خليف عايد العنزي للمواد الغذائية',
      vatNumber: '300123456789003',
      invoicePrefix: 'INV',
      defaultPayment: 'Cash',
      timezone: 'Asia/Riyadh',
      supportContact: '0500000000',
      lowStockAlert: 10,
      allowNegativeStock: 'no',
      currency: 'SR',
      currencySymbol: 'SR',
      vatPercent: 15,
      defaultLanguage: 'ar',
      invoiceLanguage: 'both',
      dateLocale: 'en-GB',
      timeLocale: 'en-US',
      storeAddress: 'خميس مشيط',
      crNumber: '7006133065',
    });
    console.log('Store settings seeded');
  }

  const productCount = await Product.countDocuments();
  if (productCount > 0) return;

  const milk = await Product.create({
    productId: 'P-100',
    productCode: '6281000000011',
    productName: 'Almarai Full Milk 1L',
    arabicName: 'حليب المراعي كامل الدسم 1 لتر',
    quantity: 24,
    packageVal: '1 L',
    vat: 15,
    mrp: 6,
    purchasePrice: 4.5,
    sellingPrice: 6,
    storage: 'Fridge',
    minQty: 6,
    productType: 'SINGLE',
    boxQty: 1,
    isDeleted: false,
  });

  await Product.create({
    productId: 'P-101',
    productCode: '6281000000028',
    productName: 'Basmati Rice 5kg',
    arabicName: 'أرز بسمتي 5 كجم',
    quantity: 15,
    packageVal: '5 kg',
    vat: 15,
    mrp: 42,
    purchasePrice: 32,
    sellingPrice: 42,
    storage: 'Shelf A',
    minQty: 4,
    productType: 'SINGLE',
    boxQty: 1,
    isDeleted: false,
  });

  await Product.create({
    productId: 'P-102',
    productCode: '6281000000035',
    productName: 'Drinking Water 330ml',
    arabicName: 'مياه شرب 330 مل',
    quantity: 48,
    packageVal: '330 ml',
    vat: 15,
    mrp: 1,
    purchasePrice: 0.5,
    sellingPrice: 1,
    storage: 'Shelf B',
    minQty: 12,
    productType: 'SINGLE',
    boxQty: 1,
    isDeleted: false,
  });

  const customer = await Customer.create({
    customerCode: 'C-100',
    customerName: 'Walk-in Customer',
    mobile: '0551112233',
    address: 'Khamis Mushait',
    creditLimit: 500,
    isDeleted: false,
  });

  await Supplier.create({
    supplierCode: 'S-100',
    supplierName: 'Almarai Distributor',
    contactPerson: 'Khalid',
    phone: '0559998877',
    address: 'Abha',
    creditLimit: 5000,
    isDeleted: false,
  });

  const lineTotal = 6;
  await Sale.create({
    billNo: 8500,
    customer: customer._id,
    items: [
      {
        code: milk.productCode,
        productName: milk.productName,
        type: 'SINGLE',
        quantity: 1,
        price: 6,
        vat: 15,
        total: lineTotal,
      },
    ],
    totalAmount: lineTotal,
    discount: 0,
    vatPercent: 15,
    netAmount: lineTotal,
    amountPaid: lineTotal,
    balance: 0,
    paymentMode: 'CASH',
    createdBy: 'admin',
    isReturn: false,
  });

  console.log('Demo products, customer, supplier, and sale seeded');
};

export default seedDemo;

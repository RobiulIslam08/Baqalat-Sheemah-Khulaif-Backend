export interface IBarcodeJob {
  productCode: string;
  barcodeValue?: string;
  labelCount: number;
  paperSize: string;
  printType: string;
  printer: string;
  generatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { ProductLinkService } from './productLink.service';

const linkProducts = catchAsync(async (req, res) => {
  const result = await ProductLinkService.linkProducts(req.body);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Products linked successfully', data: result });
});

const getLinks = catchAsync(async (req, res) => {
  const result = await ProductLinkService.getLinks(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Product links retrieved', meta: result.meta, data: result.data });
});

export const ProductLinkController = { linkProducts, getLinks };

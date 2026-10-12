import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import catchAsync from '../utils/catchAsync';

//validation
const validateRequest = (schema: ZodSchema) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const parsed = await schema.parseAsync({
      body: req.body,
      cookies: req.cookies,
    }) as { body?: Request['body']; cookies?: Request['cookies'] };
    if (parsed?.body) req.body = parsed.body;
    if (parsed?.cookies) req.cookies = { ...req.cookies, ...parsed.cookies };
    next();
  });
};
export default validateRequest;
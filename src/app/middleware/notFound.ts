import { NextFunction, Request, Response } from "express";

const notFound = ( req:Request, res:Response, next:NextFunction)=>{
	
	const message =   `API endpoint not found from notFound.ts: "${req.originalUrl}"`
	 res.status(404).json({
	  success:false,
	  message,
	  error: ''
	})
  }
export default notFound
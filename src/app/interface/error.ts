export type TErrorSourses = {
    path:string | number,
    message:string
  }[]

export type TGenericErrorResponse = {
  statusCode:number,
  errorSources:TErrorSourses,
  message:string
}
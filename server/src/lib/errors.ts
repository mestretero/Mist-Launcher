export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function notFound(message = "Not found") {
  return new AppError(404, "NOT_FOUND", message);
}

export function unauthorized(message = "Unauthorized") {
  return new AppError(401, "UNAUTHORIZED", message);
}

export function conflict(message = "Conflict") {
  return new AppError(409, "CONFLICT", message);
}

export function badRequest(message = "Bad request") {
  return new AppError(400, "BAD_REQUEST", message);
}

export function forbidden(message = "Forbidden") {
  return new AppError(403, "FORBIDDEN", message);
}

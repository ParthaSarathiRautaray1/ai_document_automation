/**
 * ApiResponse - standard success envelope so every endpoint returns a
 * consistent, predictable shape:
 *   { success: true, message, data, meta }
 */
export default class ApiResponse {
  constructor(data = null, message = 'Success', meta = null) {
    this.success = true;
    this.message = message;
    this.data = data;
    if (meta) this.meta = meta;
  }

  static send(res, statusCode, data, message, meta) {
    return res.status(statusCode).json(new ApiResponse(data, message, meta));
  }
}

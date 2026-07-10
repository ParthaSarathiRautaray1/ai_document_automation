/**
 * validate - request validation middleware factory backed by Zod.
 *
 * Accepts a schema object with optional `body`, `query`, and `params` Zod
 * schemas. Parsed (and thus coerced/sanitized) values replace the originals so
 * downstream handlers receive clean, typed data. Failures throw a ZodError,
 * which the global error handler converts into a 422 response.
 *
 * Usage:
 *   router.post('/login', validate({ body: loginSchema }), controller.login);
 */
export default function validate(schema) {
  return (req, _res, next) => {
    try {
      if (schema.params) req.params = schema.params.parse(req.params);
      if (schema.query) req.query = schema.query.parse(req.query);
      if (schema.body) req.body = schema.body.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

const assert = require('node:assert');

const { buildSuggestedBug } = require('../src/app-log-analyzer');

function run(): void {
  const cases = [
    {
      event: {
        message: 'HTTP 504 Gateway Timeout calling payment-service',
        service: 'etihad-booking-service',
        logger: 'PaymentClient',
        attributes: {
          flow: 'BOOKING_CREATE',
          downstreamService: 'payment-service',
          httpStatus: 504,
          url: 'https://pay.svc/payments',
        },
      },
      cat: { id: 'DOWNSTREAM_TIMEOUT' },
      exp: '[BOOKING_CREATE] Booking creation fails when payment-service returns 504 Gateway Timeout',
    },
    {
      event: {
        message: 'ERROR: relation "bookings" does not exist',
        stackTrace: 'org.postgresql.util.PSQLException: ERROR: relation "bookings" does not exist',
        attributes: { flow: 'BOOKING_VIEW', table: 'bookings' },
      },
      cat: { id: 'DB_SCHEMA_OR_QUERY' },
      exp: '[BOOKING_VIEW] Booking retrieval fails due to missing database table bookings',
    },
    {
      event: {
        message: 'Cannot invoke ... because "discount" is null',
        stackTrace: 'java.lang.NullPointerException: Cannot invoke ... because "discount" is null',
        attributes: { flow: 'BOOKING_PRICE' },
      },
      cat: { id: 'NULL_POINTER_OR_BUG' },
      exp: '[BOOKING_PRICE] Fare calculation fails when discount value is null',
    },
    {
      event: {
        message: 'JWT validation failed: SignatureException: JWT signature does not match...',
        attributes: { flow: 'LOGIN' },
      },
      cat: { id: 'AUTHN_AUTHZ' },
      exp: '[LOGIN] Authentication request rejected due to JWT signature validation failure',
    },
  ];

  for (const c of cases) {
    const got = buildSuggestedBug(c.event, c.cat);
    assert.strictEqual(got, c.exp);
  }

  // Basic safety: ensure we never leak trace/span IDs into suggestedBug.
  const got = buildSuggestedBug(
    { message: 'HTTP 500 Internal Server Error - correlationId=CORR-7788 traceId=abc spanId=def', attributes: { flow: 'BOOKING_VIEW' } },
    { id: 'GENERIC_5XX' },
  );
  assert.ok(!/traceId|spanId|correlationId/i.test(got));
}

run();
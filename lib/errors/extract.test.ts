import { extractSafeErrorReference } from "./extract";

describe("extractSafeErrorReference", () => {
  describe("positive cases - valid identifiers", () => {
    it("extracts UUID v4 request ID", () => {
      const response = {
        message: "Not found",
        requestId: "550e8400-e29b-41d4-a716-446655440000",
      };

      const result = extractSafeErrorReference(response, 404);

      expect(result.status).toBe(404);
      expect(result.message).toBe("Not found");
      expect(result.requestId).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("extracts alphanumeric request ID with hyphens", () => {
      const response = {
        message: "Internal error",
        request_id: "req-abc123-xyz789",
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.requestId).toBe("req-abc123-xyz789");
    });

    it("extracts correlation ID with underscores", () => {
      const response = {
        message: "Service unavailable",
        correlationId: "corr_12345678_abcdefgh",
      };

      const result = extractSafeErrorReference(response, 503);

      expect(result.correlationId).toBe("corr_12345678_abcdefgh");
    });

    it("extracts both request ID and correlation ID", () => {
      const response = {
        message: "Bad request",
        requestId: "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789",
        correlationId: "trace-9876543210",
      };

      const result = extractSafeErrorReference(response, 400);

      expect(result.requestId).toBe("a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789");
      expect(result.correlationId).toBe("trace-9876543210");
    });

    it("extracts traceId as request ID", () => {
      const response = {
        message: "Error",
        traceId: "trace123456789abc",
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.requestId).toBe("trace123456789abc");
    });

    it("uses error field as message when message is absent", () => {
      const response = {
        error: "Authentication failed",
        requestId: "auth-req-12345678",
      };

      const result = extractSafeErrorReference(response, 401);

      expect(result.message).toBe("Authentication failed");
      expect(result.requestId).toBe("auth-req-12345678");
    });
  });

  describe("negative cases - sensitive data rejection", () => {
    it("rejects JWT tokens as request ID", () => {
      const response = {
        message: "Unauthorized",
        requestId:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
      };

      const result = extractSafeErrorReference(response, 401);

      expect(result.requestId).toBeUndefined();
    });

    it("rejects bearer token format", () => {
      const response = {
        message: "Error",
        requestId: "Bearer abc123xyz456",
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.requestId).toBeUndefined();
    });

    it("rejects API keys with key_ prefix", () => {
      const response = {
        message: "Error",
        requestId: "key_live_1234567890abcdef",
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.requestId).toBeUndefined();
    });

    it("rejects secret keys with sk_ prefix", () => {
      const response = {
        message: "Error",
        correlationId: "sk_test_abcdefghijklmnop",
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.correlationId).toBeUndefined();
    });

    it("rejects public keys with pk_ prefix", () => {
      const response = {
        message: "Error",
        requestId: "pk_live_xyz123",
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.requestId).toBeUndefined();
    });

    it("rejects token with token prefix", () => {
      const response = {
        message: "Error",
        requestId: "token abcd1234efgh5678",
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.requestId).toBeUndefined();
    });

    it("rejects IDs that are too short (less than 8 chars)", () => {
      const response = {
        message: "Error",
        requestId: "short",
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.requestId).toBeUndefined();
    });

    it("rejects IDs that are too long (more than 64 chars)", () => {
      const response = {
        message: "Error",
        requestId: "a".repeat(65),
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.requestId).toBeUndefined();
    });

    it("rejects non-string values", () => {
      const response = {
        message: "Error",
        requestId: 12345678,
        correlationId: { id: "test" },
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.requestId).toBeUndefined();
      expect(result.correlationId).toBeUndefined();
    });

    it("ignores sensitive fields like stack traces", () => {
      const response = {
        message: "Internal error",
        requestId: "valid-req-12345678",
        stack: "Error: test\n    at Object.<anonymous> (/app/index.js:10:15)",
        credentials: { username: "user", password: "pass" },
      };

      const result = extractSafeErrorReference(response, 500);

      // Should only extract the safe requestId
      expect(result.requestId).toBe("valid-req-12345678");
      expect(result).not.toHaveProperty("stack");
      expect(result).not.toHaveProperty("credentials");
    });
  });

  describe("boundary cases", () => {
    it("handles null response body", () => {
      const result = extractSafeErrorReference(null, 500);

      expect(result.status).toBe(500);
      expect(result.message).toBe("Request failed with status 500");
      expect(result.requestId).toBeUndefined();
    });

    it("handles undefined response body", () => {
      const result = extractSafeErrorReference(undefined, 404);

      expect(result.status).toBe(404);
      expect(result.message).toBe("Request failed with status 404");
    });

    it("handles empty object response", () => {
      const result = extractSafeErrorReference({}, 400);

      expect(result.status).toBe(400);
      expect(result.message).toBe("Request failed with status 400");
      expect(result.requestId).toBeUndefined();
    });

    it("handles response with only message", () => {
      const response = {
        message: "Validation failed",
      };

      const result = extractSafeErrorReference(response, 422);

      expect(result.status).toBe(422);
      expect(result.message).toBe("Validation failed");
      expect(result.requestId).toBeUndefined();
    });

    it("handles response with empty string message", () => {
      const response = {
        message: "",
        requestId: "req-12345678",
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.message).toBe("Request failed with status 500");
      expect(result.requestId).toBe("req-12345678");
    });

    it("prefers first matching field name for request ID", () => {
      const response = {
        message: "Error",
        requestId: "first-id-12345678",
        request_id: "second-id-87654321",
        traceId: "third-id-abcdefgh",
      };

      const result = extractSafeErrorReference(response, 500);

      // Should use requestId (first in priority list)
      expect(result.requestId).toBe("first-id-12345678");
    });

    it("handles UUID with uppercase letters", () => {
      const response = {
        message: "Error",
        requestId: "550E8400-E29B-41D4-A716-446655440000",
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.requestId).toBe("550E8400-E29B-41D4-A716-446655440000");
    });

    it("handles minimum length ID (8 characters)", () => {
      const response = {
        message: "Error",
        requestId: "abcd1234",
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.requestId).toBe("abcd1234");
    });

    it("handles maximum length ID (64 characters)", () => {
      const longId = "a".repeat(64);
      const response = {
        message: "Error",
        requestId: longId,
      };

      const result = extractSafeErrorReference(response, 500);

      expect(result.requestId).toBe(longId);
    });
  });

  describe("regression cases", () => {
    it("does not leak authorization headers", () => {
      const response = {
        message: "Unauthorized",
        authorization: "Bearer secret-token-12345",
        requestId: "req-valid-12345678",
      };

      const result = extractSafeErrorReference(response, 401);

      expect(result.requestId).toBe("req-valid-12345678");
      expect(result).not.toHaveProperty("authorization");
    });

    it("does not expose user credentials from error response", () => {
      const response = {
        message: "Login failed",
        username: "john.doe@example.com",
        password: "p@ssw0rd",
        requestId: "auth-req-12345678",
      };

      const result = extractSafeErrorReference(response, 401);

      expect(result.requestId).toBe("auth-req-12345678");
      expect(result).not.toHaveProperty("username");
      expect(result).not.toHaveProperty("password");
    });

    it("handles mixed case field names", () => {
      const response = {
        message: "Error",
        RequestId: "not-extracted-case-sensitive",
        requestId: "req-12345678",
      };

      const result = extractSafeErrorReference(response, 500);

      // Should only extract exact match (case-sensitive)
      expect(result.requestId).toBe("req-12345678");
    });

    it("handles non-object primitive response", () => {
      const result1 = extractSafeErrorReference("string error", 500);
      const result2 = extractSafeErrorReference(42, 500);
      const result3 = extractSafeErrorReference(true, 500);

      expect(result1.requestId).toBeUndefined();
      expect(result2.requestId).toBeUndefined();
      expect(result3.requestId).toBeUndefined();
    });
  });
});

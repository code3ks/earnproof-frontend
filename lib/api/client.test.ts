import { apiClient } from "./client";
import { ApiError } from "@/lib/errors";

// Mock fetch globally
global.fetch = jest.fn();

describe("apiClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("successful requests", () => {
    it("returns parsed JSON response on success", async () => {
      const mockResponse = { id: "123", name: "Test" };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiClient({
        path: "/test",
        method: "GET",
      });

      expect(result).toEqual(mockResponse);
    });

    it("includes content-type header by default", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await apiClient({ path: "/test" });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
          },
        })
      );
    });

    it("merges custom headers with defaults", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await apiClient({
        path: "/test",
        headers: {
          Authorization: "Bearer token",
        },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token",
          },
        })
      );
    });
  });

  describe("error responses with request IDs", () => {
    it("throws ApiError with request ID from response", async () => {
      const errorBody = {
        message: "Resource not found",
        requestId: "req-abc123xyz",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => errorBody,
      });

      await expect(
        apiClient({ path: "/test" })
      ).rejects.toThrow(ApiError);

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.message).toBe("Resource not found");
        expect(apiError.status).toBe(404);
        expect(apiError.requestId).toBe("req-abc123xyz");
      }
    });

    it("throws ApiError with correlation ID from response", async () => {
      const errorBody = {
        message: "Internal error",
        correlationId: "corr-xyz789abc",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => errorBody,
      });

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.correlationId).toBe("corr-xyz789abc");
      }
    });

    it("throws ApiError with both IDs from response", async () => {
      const errorBody = {
        message: "Service error",
        requestId: "req-123456789",
        correlationId: "corr-987654321",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => errorBody,
      });

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.requestId).toBe("req-123456789");
        expect(apiError.correlationId).toBe("corr-987654321");
      }
    });
  });

  describe("error responses without request IDs", () => {
    it("throws ApiError without IDs when not in response", async () => {
      const errorBody = {
        message: "Validation failed",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorBody,
      });

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.message).toBe("Validation failed");
        expect(apiError.requestId).toBeUndefined();
        expect(apiError.correlationId).toBeUndefined();
      }
    });

    it("handles non-JSON error response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("Not JSON");
        },
      });

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError).toBeInstanceOf(ApiError);
        expect(apiError.status).toBe(500);
        expect(apiError.message).toBe("Request failed with status 500");
      }
    });

    it("handles empty error response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({}),
      });

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.message).toBe("Request failed with status 502");
      }
    });
  });

  describe("security - sensitive data exclusion", () => {
    it("does not include JWT token in error", async () => {
      const errorBody = {
        message: "Unauthorized",
        requestId:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => errorBody,
      });

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        const apiError = error as ApiError;
        // JWT should be rejected by validation
        expect(apiError.requestId).toBeUndefined();
      }
    });

    it("does not include bearer tokens in error", async () => {
      const errorBody = {
        message: "Error",
        requestId: "Bearer abc123xyz456",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => errorBody,
      });

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.requestId).toBeUndefined();
      }
    });

    it("does not include API keys in error", async () => {
      const errorBody = {
        message: "Error",
        requestId: "sk_live_1234567890abcdef",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => errorBody,
      });

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.requestId).toBeUndefined();
      }
    });
  });

  describe("HTTP status codes", () => {
    it("handles 400 bad request", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: "Bad request" }),
      });

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
      }
    });

    it("handles 401 unauthorized", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      });

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(401);
      }
    });

    it("handles 403 forbidden", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: "Forbidden" }),
      });

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(403);
      }
    });

    it("handles 404 not found", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: "Not found" }),
      });

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(404);
      }
    });

    it("handles 500 internal server error", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: "Internal error", requestId: "req-12345678" }),
      });

      try {
        await apiClient({ path: "/test" });
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(500);
        expect(apiError.requestId).toBe("req-12345678");
      }
    });
  });
});

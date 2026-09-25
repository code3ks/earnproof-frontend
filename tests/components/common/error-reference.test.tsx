/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ErrorReference } from "@/components/common/error-reference";
import { ApiError } from "@/lib/errors";

// Mock clipboard API
const mockClipboard = {
  writeText: jest.fn(),
};

Object.assign(navigator, {
  clipboard: mockClipboard,
});

describe("ErrorReference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClipboard.writeText.mockResolvedValue(undefined);
  });

  describe("ApiError with request IDs", () => {
    it("renders error message with request ID", () => {
      const error = new ApiError({
        status: 500,
        message: "Internal server error",
        requestId: "req-12345678-abcd",
      });

      render(<ErrorReference error={error} />);

      expect(screen.getByText("Internal server error")).toBeInTheDocument();
      expect(screen.getByText(/Request ID:/)).toBeInTheDocument();
      expect(screen.getByText(/req-12345678-abcd/)).toBeInTheDocument();
    });

    it("renders error message with correlation ID", () => {
      const error = new ApiError({
        status: 503,
        message: "Service unavailable",
        correlationId: "corr-xyz-987654",
      });

      render(<ErrorReference error={error} />);

      expect(screen.getByText("Service unavailable")).toBeInTheDocument();
      expect(screen.getByText(/Correlation ID:/)).toBeInTheDocument();
      expect(screen.getByText(/corr-xyz-987654/)).toBeInTheDocument();
    });

    it("renders both request ID and correlation ID", () => {
      const error = new ApiError({
        status: 400,
        message: "Bad request",
        requestId: "req-abc123xyz",
        correlationId: "corr-def456uvw",
      });

      render(<ErrorReference error={error} />);

      expect(screen.getByText(/Request ID:/)).toBeInTheDocument();
      expect(screen.getByText(/req-abc123xyz/)).toBeInTheDocument();
      expect(screen.getByText(/Correlation ID:/)).toBeInTheDocument();
      expect(screen.getByText(/corr-def456uvw/)).toBeInTheDocument();
    });

    it("displays support instruction text", () => {
      const error = new ApiError({
        status: 500,
        message: "Error occurred",
        requestId: "req-12345678",
      });

      render(<ErrorReference error={error} />);

      expect(
        screen.getByText("Include this reference when contacting support.")
      ).toBeInTheDocument();
    });

    it("renders copy button", () => {
      const error = new ApiError({
        status: 500,
        message: "Error",
        requestId: "req-12345678",
      });

      render(<ErrorReference error={error} />);

      const copyButton = screen.getByRole("button", {
        name: "Copy error reference",
      });
      expect(copyButton).toBeInTheDocument();
      expect(screen.getByText("Copy")).toBeInTheDocument();
    });
  });

  describe("Copy functionality", () => {
    it("copies request ID to clipboard", async () => {
      const error = new ApiError({
        status: 500,
        message: "Error",
        requestId: "req-12345678",
      });

      render(<ErrorReference error={error} />);

      const copyButton = screen.getByRole("button", {
        name: "Copy error reference",
      });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
          "Request ID: req-12345678"
        );
      });
    });

    it("copies both IDs to clipboard when both present", async () => {
      const error = new ApiError({
        status: 500,
        message: "Error",
        requestId: "req-abc123",
        correlationId: "corr-xyz789",
      });

      render(<ErrorReference error={error} />);

      const copyButton = screen.getByRole("button", {
        name: "Copy error reference",
      });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
          "Request ID: req-abc123\nCorrelation ID: corr-xyz789"
        );
      });
    });

    it("shows copied confirmation after clicking copy", async () => {
      const error = new ApiError({
        status: 500,
        message: "Error",
        requestId: "req-12345678",
      });

      render(<ErrorReference error={error} />);

      const copyButton = screen.getByRole("button", {
        name: "Copy error reference",
      });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText("Copied")).toBeInTheDocument();
      });
    });

    it("resets copy confirmation after timeout", async () => {
      jest.useFakeTimers();

      const error = new ApiError({
        status: 500,
        message: "Error",
        requestId: "req-12345678",
      });

      render(<ErrorReference error={error} />);

      const copyButton = screen.getByRole("button", {
        name: "Copy error reference",
      });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText("Copied")).toBeInTheDocument();
      });

      // Fast-forward time by 2 seconds
      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.getByText("Copy")).toBeInTheDocument();
        expect(screen.queryByText("Copied")).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it("handles clipboard API failure gracefully", async () => {
      mockClipboard.writeText.mockRejectedValueOnce(
        new Error("Clipboard access denied")
      );

      const error = new ApiError({
        status: 500,
        message: "Error",
        requestId: "req-12345678",
      });

      render(<ErrorReference error={error} />);

      const copyButton = screen.getByRole("button", {
        name: "Copy error reference",
      });

      // Should not throw error
      fireEvent.click(copyButton);

      // Component should still be rendered
      expect(screen.getByText("Error")).toBeInTheDocument();
    });
  });

  describe("Error without request IDs", () => {
    it("renders simple error for regular Error", () => {
      const error = new Error("Something went wrong");

      render(<ErrorReference error={error} />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.queryByText(/Request ID:/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Copy error reference" })
      ).not.toBeInTheDocument();
    });

    it("renders simple error for ApiError without IDs", () => {
      const error = new ApiError({
        status: 404,
        message: "Not found",
      });

      render(<ErrorReference error={error} />);

      expect(screen.getByText("Not found")).toBeInTheDocument();
      expect(screen.queryByText(/Request ID:/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Copy error reference" })
      ).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper aria-label on copy button", () => {
      const error = new ApiError({
        status: 500,
        message: "Error",
        requestId: "req-12345678",
      });

      render(<ErrorReference error={error} />);

      const copyButton = screen.getByRole("button", {
        name: "Copy error reference",
      });
      expect(copyButton).toHaveAttribute("aria-label", "Copy error reference");
    });

    it("uses semantic button element", () => {
      const error = new ApiError({
        status: 500,
        message: "Error",
        requestId: "req-12345678",
      });

      render(<ErrorReference error={error} />);

      const copyButton = screen.getByRole("button", {
        name: "Copy error reference",
      });
      expect(copyButton.tagName).toBe("BUTTON");
      expect(copyButton).toHaveAttribute("type", "button");
    });

    it("has visible focus indicator", () => {
      const error = new ApiError({
        status: 500,
        message: "Error",
        requestId: "req-12345678",
      });

      render(<ErrorReference error={error} />);

      const copyButton = screen.getByRole("button", {
        name: "Copy error reference",
      });
      expect(copyButton).toHaveClass("focus-visible:outline-none");
      expect(copyButton).toHaveClass("focus-visible:ring-2");
    });
  });

  describe("Visual styling", () => {
    it("renders with error styling colors", () => {
      const error = new ApiError({
        status: 500,
        message: "Error",
        requestId: "req-12345678",
      });

      const { container } = render(<ErrorReference error={error} />);

      const errorBox = container.querySelector(".border-rose-300\\/30");
      expect(errorBox).toBeInTheDocument();
    });

    it("renders IDs in monospace font", () => {
      const error = new ApiError({
        status: 500,
        message: "Error",
        requestId: "req-12345678",
      });

      const { container } = render(<ErrorReference error={error} />);

      const monoElements = container.querySelectorAll(".font-mono");
      expect(monoElements.length).toBeGreaterThan(0);
    });
  });

  describe("Edge cases", () => {
    it("handles very long request IDs", () => {
      const longId = "req-" + "a".repeat(60);
      const error = new ApiError({
        status: 500,
        message: "Error",
        requestId: longId,
      });

      render(<ErrorReference error={error} />);

      expect(screen.getByText(new RegExp(longId))).toBeInTheDocument();
    });

    it("handles special characters in error message", () => {
      const error = new ApiError({
        status: 400,
        message: 'Invalid input: "name" & "email" are required',
        requestId: "req-12345678",
      });

      render(<ErrorReference error={error} />);

      expect(
        screen.getByText('Invalid input: "name" & "email" are required')
      ).toBeInTheDocument();
    });

    it("handles UUID format request IDs", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const error = new ApiError({
        status: 500,
        message: "Error",
        requestId: uuid,
      });

      render(<ErrorReference error={error} />);

      expect(screen.getByText(new RegExp(uuid))).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "../components/ui/confirm-dialog";

function noop() {}

async function flushFrames() {
  // Drain queued requestAnimationFrame callbacks so focus management runs.
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

describe("ConfirmDialog", () => {
  it("renders title, description, and children", async () => {
    render(
      <ConfirmDialog
        open
        title="Place live orders?"
        description="This will use real funds."
        onConfirm={noop}
        onCancel={noop}
      >
        <p data-testid="extra">Strategy: Test #1</p>
      </ConfirmDialog>,
    );
    await flushFrames();

    expect(screen.getByText("Place live orders?")).toBeTruthy();
    expect(screen.getByText("This will use real funds.")).toBeTruthy();
    expect(screen.getByTestId("extra")).toBeTruthy();
  });

  it("does not render when open is false", () => {
    render(
      <ConfirmDialog
        open={false}
        title="Hidden"
        description="Should not appear"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("moves default focus to the Cancel button on open", async () => {
    render(
      <ConfirmDialog
        open
        title="Cancel order"
        description="Are you sure?"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    await flushFrames();

    expect(document.activeElement).toBe(
      screen.getByTestId("confirm-dialog-cancel"),
    );
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        description="d"
        onConfirm={noop}
        onCancel={onCancel}
      />,
    );
    await flushFrames();

    fireEvent.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Escape is pressed", async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        description="d"
        onConfirm={noop}
        onCancel={onCancel}
      />,
    );
    await flushFrames();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Confirm is clicked (no delay configured)", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        description="d"
        onConfirm={onConfirm}
        onCancel={noop}
      />,
    );
    await flushFrames();

    fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onConfirm when the focused Cancel button is activated via Enter", async () => {
    // Cancel is focused on open. Enter on a focused <button type="button"> activates that button.
    // This locks in the WCAG 3.3.4 default-of-safety behavior.
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        description="d"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    await flushFrames();

    const cancel = screen.getByTestId("confirm-dialog-cancel");
    expect(document.activeElement).toBe(cancel);

    // Browser semantics: Enter/Space on a focused button click()s it. We simulate
    // the resulting click rather than the keydown to keep the test framework-agnostic
    // for happy-dom (which does not implement the full button-activation pipeline).
    fireEvent.click(cancel);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  describe("delayMs (delay-to-accept)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("disables Confirm until the delay elapses, then enables it", async () => {
      const onConfirm = vi.fn();
      render(
        <ConfirmDialog
          open
          title="Place live orders"
          description="Real funds."
          onConfirm={onConfirm}
          onCancel={noop}
          delayMs={2000}
          confirmLabel="Place live orders"
        />,
      );
      // Drain the focus rAF without advancing wall-clock time.
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const confirm = screen.getByTestId("confirm-dialog-confirm");
      expect(confirm.disabled).toBe(true);
      expect(confirm.getAttribute("aria-disabled")).toBe("true");

      // Clicks while disabled must be ignored.
      fireEvent.click(confirm);
      expect(onConfirm).not.toHaveBeenCalled();

      // Advance past the delay window.
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });

      expect(confirm.disabled).toBe(false);
      fireEvent.click(confirm);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("shows a countdown suffix on the confirm label while waiting", async () => {
      render(
        <ConfirmDialog
          open
          title="t"
          description="d"
          onConfirm={noop}
          onCancel={noop}
          delayMs={2000}
          confirmLabel="Place"
        />,
      );
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // First tick fires at 100ms, then the label updates with the remaining seconds.
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      const confirm = screen.getByTestId("confirm-dialog-confirm");
      expect(confirm.textContent).toMatch(/Place\s*\(\d+s\)/);
    });

    it("resets the delay timer when the dialog reopens", async () => {
      const { rerender } = render(
        <ConfirmDialog
          open
          title="t"
          description="d"
          onConfirm={noop}
          onCancel={noop}
          delayMs={2000}
        />,
      );
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });

      // Dialog closes, then reopens — confirm must be disabled again until the new delay elapses.
      rerender(
        <ConfirmDialog
          open={false}
          title="t"
          description="d"
          onConfirm={noop}
          onCancel={noop}
          delayMs={2000}
        />,
      );
      rerender(
        <ConfirmDialog
          open
          title="t"
          description="d"
          onConfirm={noop}
          onCancel={noop}
          delayMs={2000}
        />,
      );
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const confirm = screen.getByTestId("confirm-dialog-confirm");
      expect(confirm.disabled).toBe(true);
    });
  });

  it("disables both buttons while isLoading", async () => {
    render(
      <ConfirmDialog
        open
        title="t"
        description="d"
        onConfirm={noop}
        onCancel={noop}
        isLoading
      />,
    );
    await flushFrames();

    expect(screen.getByTestId("confirm-dialog-cancel").disabled).toBe(true);
    expect(screen.getByTestId("confirm-dialog-confirm").disabled).toBe(true);
  });

  it("escalates role to alertdialog when tone is danger", async () => {
    render(
      <ConfirmDialog
        open
        title="Cancel order"
        description="This DELETEs the order."
        onConfirm={noop}
        onCancel={noop}
        tone="danger"
      />,
    );
    await flushFrames();

    const dialog = screen.getByTestId("confirm-dialog");
    expect(dialog.getAttribute("role")).toBe("alertdialog");
  });

  it("uses default role=dialog for the standard tone", async () => {
    render(
      <ConfirmDialog
        open
        title="t"
        description="d"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    await flushFrames();

    const dialog = screen.getByTestId("confirm-dialog");
    expect(dialog.getAttribute("role")).toBe("dialog");
  });

  it("links the description to the dialog via aria-describedby", async () => {
    render(
      <ConfirmDialog
        open
        title="t"
        description="risk copy"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    await flushFrames();

    const dialog = screen.getByTestId("confirm-dialog");
    const describedById = dialog.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const desc = document.getElementById(describedById);
    expect(desc?.textContent).toBe("risk copy");
  });
});

import { describe, it, expect } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { useRef } from "react";
import { useFocusTrap } from "@polyforge/ui";

function Trapped({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(active, ref);
  return (
    <div>
      <button data-testid="outside-before">outside-before</button>
      <div ref={ref}>
        <button data-testid="trap-first">first</button>
        <button data-testid="trap-middle">middle</button>
        <button data-testid="trap-last">last</button>
      </div>
      <button data-testid="outside-after">outside-after</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("moves focus into the container on activation", () => {
    const { getByTestId } = render(<Trapped active={true} />);
    expect(document.activeElement).toBe(getByTestId("trap-first"));
  });

  it("wraps Tab from last to first focusable", () => {
    const { getByTestId } = render(<Trapped active={true} />);
    const last = getByTestId("trap-last");
    last.focus();
    expect(document.activeElement).toBe(last);

    // Simulate Tab on document (the hook listens at the document level, capture phase)
    act(() => {
      fireEvent.keyDown(document, { key: "Tab" });
    });
    expect(document.activeElement).toBe(getByTestId("trap-first"));
  });

  it("wraps Shift+Tab from first to last focusable", () => {
    const { getByTestId } = render(<Trapped active={true} />);
    const first = getByTestId("trap-first");
    first.focus();

    act(() => {
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    });
    expect(document.activeElement).toBe(getByTestId("trap-last"));
  });

  it("does not trap focus when inactive", () => {
    const { getByTestId } = render(<Trapped active={false} />);
    const outsideAfter = getByTestId("outside-after");
    outsideAfter.focus();
    expect(document.activeElement).toBe(outsideAfter);
  });
});

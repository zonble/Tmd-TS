export function makeDraggable(element: HTMLElement): void {
  let isDragging = false;
  let startPointerX = 0;
  let startPointerY = 0;
  let startElementX = 0;
  let startElementY = 0;

  element.addEventListener("pointerdown", (e: PointerEvent) => {
    // Ignore clicks on inputs, buttons, selects, or other interactive elements
    const target = e.target as HTMLElement | null;
    if (target && target.closest("button, input, select, a")) {
      return;
    }

    // Only respond to primary mouse click or touch
    if (e.button !== 0 && e.pointerType === "mouse") return;

    isDragging = true;
    startPointerX = e.clientX;
    startPointerY = e.clientY;

    const rect = element.getBoundingClientRect();
    startElementX = rect.left;
    startElementY = rect.top;

    // Reset right/bottom positioning to explicit top/left
    element.style.right = "auto";
    element.style.bottom = "auto";
    element.style.left = `${startElementX}px`;
    element.style.top = `${startElementY}px`;

    element.classList.add("dragging");
    element.setPointerCapture(e.pointerId);
  });

  element.addEventListener("pointermove", (e: PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startPointerX;
    const deltaY = e.clientY - startPointerY;

    const rect = element.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - rect.width);
    const maxY = Math.max(0, window.innerHeight - rect.height);

    const newX = Math.min(Math.max(0, startElementX + deltaX), maxX);
    const newY = Math.min(Math.max(0, startElementY + deltaY), maxY);

    element.style.left = `${newX}px`;
    element.style.top = `${newY}px`;
  });

  const stopDrag = (e: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    element.classList.remove("dragging");
    if (element.hasPointerCapture(e.pointerId)) {
      element.releasePointerCapture(e.pointerId);
    }
  };

  element.addEventListener("pointerup", stopDrag);
  element.addEventListener("pointercancel", stopDrag);
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Trash2 } from "lucide-react";

export function ChatActions({
  title,
  disabled,
  onDelete,
}: {
  title: string;
  disabled: boolean;
  onDelete: () => void;
}) {
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const item = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!position) return;
    item.current?.focus();
    const outside = (event: PointerEvent) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setPosition(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPosition(null);
        trigger.current?.focus();
      } else if (event.key === "Tab") setPosition(null);
      else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        item.current?.focus();
      }
    };
    const dismiss = () => setPosition(null);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [position]);
  function toggle() {
    if (position) {
      setPosition(null);
      return;
    }
    const rect = trigger.current!.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(window.innerWidth - 180, rect.right - 172)),
      top:
        rect.bottom + 56 > window.innerHeight
          ? Math.max(8, rect.top - 52)
          : rect.bottom + 4,
    });
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="chat-options-button"
        aria-label={`Chat options: ${title}`}
        title="Chat options"
        aria-haspopup="menu"
        aria-expanded={!!position}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!position) toggle();
          }
        }}
      >
        <MoreHorizontal size={17} />
      </button>
      {position &&
        !disabled &&
        createPortal(
          <div
            ref={menu}
            className="chat-actions-menu"
            role="menu"
            aria-label="Chat actions"
            style={{ left: position.left, top: position.top }}
          >
            <button
              ref={item}
              type="button"
              role="menuitem"
              onClick={() => {
                setPosition(null);
                trigger.current?.focus();
                onDelete();
              }}
            >
              <Trash2 size={15} /> Delete chat
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

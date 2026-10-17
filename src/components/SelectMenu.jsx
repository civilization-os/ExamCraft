import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function SelectMenu({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  disabled = false,
  dataNoDrag = false
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const optionRefs = useRef([]);
  const selectedIndex = useMemo(
    () => Math.max(0, options.findIndex((option) => String(option.value) === String(value))),
    [options, value]
  );
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [open]);

  const focusOption = (index) => {
    const nextIndex = Math.max(0, Math.min(options.length - 1, index));
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus());
  };

  const openMenu = (index = selectedIndex) => {
    setActiveIndex(index);
    setOpen(true);
  };

  const selectOption = (option) => {
    onChange(option.value);
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openMenu(selectedIndex);
        requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
      } else {
        focusOption(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
      }
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      focusOption(options.length - 1);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} data-no-drag={dataNoDrag ? '' : undefined} className={`relative inline-flex min-w-0 ${className}`} onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || options.length === 0}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={buttonClassName || 'inline-flex w-full items-center justify-between gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-left text-body-md text-on-surface shadow-xs transition hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50'}
      >
        <span className="min-w-0 truncate">{selectedOption?.label ?? '请选择'}</span>
        <span className={`material-symbols-outlined shrink-0 text-[18px] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute right-0 top-full z-[80] mt-1 max-h-64 min-w-full w-max max-w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-1.5 shadow-xl ${menuClassName}`}
        >
          {options.map((option, index) => {
            const selected = String(option.value) === String(value);
            return (
              <div
                key={String(option.value)}
                ref={(node) => { optionRefs.current[index] = node; }}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                onClick={() => selectOption(option)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectOption(option);
                  }
                }}
                className={`cursor-pointer rounded-lg px-3 py-2 text-sm outline-none transition-colors ${selected ? 'bg-primary text-on-primary font-semibold' : 'text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low'}`}
              >
                {option.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

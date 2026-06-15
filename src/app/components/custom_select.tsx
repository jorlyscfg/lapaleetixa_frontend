"use client";

import React, { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
  disabled?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  className = "",
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  const handleSelect = (val: string) => {
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block w-full text-left">
      <div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex w-full items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-extrabold text-white outline-none focus:border-slate-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
          <span className="truncate">{selectedOption?.label || ""}</span>
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1.5 w-full min-w-[200px] origin-top-right rounded-xl border border-slate-800 bg-slate-950/95 backdrop-blur-md shadow-2xl ring-1 ring-black/5 focus:outline-none max-h-60 overflow-y-auto animate-fade-in">
          <div className="py-1">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`flex w-full items-center px-4 py-2.5 text-xs text-left font-bold transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-indigo-500/10 text-indigo-400 font-extrabold"
                      : "text-slate-350 hover:bg-slate-900/60 hover:text-white"
                  }`}
                >
                  <span className="truncate flex-1">{opt.label}</span>
                  {isSelected && (
                    <svg className="h-4 w-4 text-indigo-400 ml-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

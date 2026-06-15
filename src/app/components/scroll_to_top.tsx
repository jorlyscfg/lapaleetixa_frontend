"use client";

import React, { useEffect, useState, useRef } from "react";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      // Validar que sea un elemento HTML con capacidad de scroll vertical
      if (target && target.tagName && target.scrollHeight > target.clientHeight) {
        if (target.scrollTop > 300) {
          scrollContainerRef.current = target;
          setVisible(true);
        } else if (scrollContainerRef.current === target && target.scrollTop <= 300) {
          setVisible(false);
        }
      }
    };

    // Usar fase de captura (true) para interceptar scroll en cualquier contenedor interno
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      title="Volver arriba"
      className="safe-area-bottom-6 fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-slate-900 dark:bg-slate-950/95 border border-slate-800 text-white shadow-2xl hover:bg-slate-800 dark:hover:bg-slate-900 transition-all duration-300 active:scale-95 flex items-center justify-center cursor-pointer backdrop-blur"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  );
}

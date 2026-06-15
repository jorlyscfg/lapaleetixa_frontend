"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";

interface CustomDatePickerProps {
  value: string; // Formato YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  align?: "left" | "right";
}

const MONTHS_SPANISH = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const DAYS_SHORT = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

export function CustomDatePicker({
  value,
  onChange,
  className = "",
  placeholder = "Seleccionar fecha...",
  disabled = false,
  align = "left"
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parsing seguro local para evitar desajustes por zona horaria (UTC vs Local)
  const getLocalDateObj = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split("-");
    if (parts.length !== 3) return new Date();
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  };

  const selectedDate = useMemo(() => (value ? getLocalDateObj(value) : null), [value]);

  // Estados de navegación interna del calendario
  const [navDate, setNavDate] = useState(() => selectedDate || new Date());

  // Actualizar la navegación cuando cambie el valor externo
  useEffect(() => {
    if (selectedDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNavDate(selectedDate);
    }
  }, [selectedDate]);

  // Cerrar al hacer clic afuera
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

  const navYear = navDate.getFullYear();
  const navMonth = navDate.getMonth();

  const handlePrevMonth = () => {
    setNavDate(new Date(navYear, navMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setNavDate(new Date(navYear, navMonth + 1, 1));
  };

  const handlePrevYear = () => {
    setNavDate(new Date(navYear - 1, navMonth, 1));
  };

  const handleNextYear = () => {
    setNavDate(new Date(navYear + 1, navMonth, 1));
  };

  const handleSelectDay = (day: number, month: number, year: number) => {
    if (disabled) return;
    
    // Formatear a YYYY-MM-DD
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const formatted = `${year}-${mStr}-${dStr}`;
    
    onChange(formatted);
    setIsOpen(false);
  };

  // Formateador amigable de la fecha seleccionada
  const formatFriendlyDate = (date: Date | null) => {
    if (!date) return placeholder;
    const day = date.getDate();
    const month = MONTHS_SPANISH[date.getMonth()].substring(0, 3);
    const year = date.getFullYear();
    return `${day} ${month}, ${year}`;
  };

  // Generar cuadrícula del mes (42 celdas)
  const generateCells = () => {
    const firstDayIndex = new Date(navYear, navMonth, 1).getDay(); // 0 = Domingo
    const daysInCurrentMonth = new Date(navYear, navMonth + 1, 0).getDate();
    
    const prevMonthIdx = navMonth === 0 ? 11 : navMonth - 1;
    const prevYearIdx = navMonth === 0 ? navYear - 1 : navYear;
    const daysInPrevMonth = new Date(prevYearIdx, prevMonthIdx + 1, 0).getDate();
    
    const nextMonthIdx = navMonth === 11 ? 0 : navMonth + 1;
    const nextYearIdx = navMonth === 11 ? navYear + 1 : navYear;

    const cells = [];

    // Relleno del mes anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        day: daysInPrevMonth - i,
        month: prevMonthIdx,
        year: prevYearIdx,
        isCurrentMonth: false
      });
    }

    // Días del mes actual
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      cells.push({
        day: i,
        month: navMonth,
        year: navYear,
        isCurrentMonth: true
      });
    }

    // Relleno del mes siguiente
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        day: i,
        month: nextMonthIdx,
        year: nextYearIdx,
        isCurrentMonth: false
      });
    }

    return cells;
  };

  const cells = generateCells();

  return (
    <div ref={containerRef} className="relative inline-block w-full text-left font-sans">
      <div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex w-full items-center justify-between gap-2.5 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        >
          <span className="truncate flex items-center gap-2">
            {/* Icono de Calendario */}
            <svg className="h-4.5 w-4.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatFriendlyDate(selectedDate)}
          </span>
          {/* Chevron Indicador */}
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
        <div className={`absolute z-50 mt-2 w-72 rounded-2xl border border-slate-800 bg-slate-950/95 backdrop-blur-md shadow-2xl p-4 animate-scale-in text-white select-none ${
          align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"
        }`}>
          {/* Cabecera del Calendario */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handlePrevYear}
                title="Año anterior"
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-850 hover:bg-slate-850 hover:text-white transition-all text-slate-400 active:scale-90 cursor-pointer"
              >
                «
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Mes anterior"
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-850 hover:bg-slate-850 hover:text-white transition-all text-slate-400 active:scale-90 cursor-pointer"
              >
                ‹
              </button>
            </div>
            
            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
              {MONTHS_SPANISH[navMonth]} {navYear}
            </span>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleNextMonth}
                title="Mes siguiente"
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-850 hover:bg-slate-850 hover:text-white transition-all text-slate-400 active:scale-90 cursor-pointer"
              >
                ›
              </button>
              <button
                type="button"
                onClick={handleNextYear}
                title="Año siguiente"
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-850 hover:bg-slate-850 hover:text-white transition-all text-slate-400 active:scale-90 cursor-pointer"
              >
                »
              </button>
            </div>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAYS_SHORT.map((d) => (
              <span key={d} className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-1">
                {d}
              </span>
            ))}
          </div>

          {/* Cuadrícula de días */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {cells.map((cell, idx) => {
              const isSelected = selectedDate && 
                selectedDate.getDate() === cell.day &&
                selectedDate.getMonth() === cell.month &&
                selectedDate.getFullYear() === cell.year;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDay(cell.day, cell.month, cell.year)}
                  className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all active:scale-90 cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white font-extrabold shadow-lg shadow-indigo-600/35 border border-indigo-500"
                      : cell.isCurrentMonth
                        ? "text-slate-200 hover:bg-slate-900 hover:text-white"
                        : "text-slate-600 hover:bg-slate-900/40 hover:text-slate-400"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

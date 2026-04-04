"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  step?: string;
}

export function NumericInput({ value, onValueChange, className, placeholder, step }: Props) {
  const [local, setLocal] = useState(value?.toString() ?? "");
  const focused = useRef(false);

  // Sync from prop when not focused (external updates like reset)
  useEffect(() => {
    if (!focused.current) {
      setLocal(value?.toString() ?? "");
    }
  }, [value]);

  return (
    <Input
      type="number"
      step={step}
      className={className}
      placeholder={placeholder}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        const num = parseFloat(local);
        if (!isNaN(num)) {
          onValueChange(num);
          setLocal(num.toString());
        } else {
          onValueChange(0);
          setLocal("0");
        }
      }}
    />
  );
}

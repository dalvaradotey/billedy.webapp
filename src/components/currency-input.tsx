'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  currency?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'default' | 'lg';
}

// Currency configuration
const currencyConfig: Record<string, { locale: string; decimals: number; symbol: string }> = {
  CLP: { locale: 'es-CL', decimals: 0, symbol: '$' },
  USD: { locale: 'en-US', decimals: 2, symbol: '$' },
  EUR: { locale: 'de-DE', decimals: 2, symbol: '€' },
  // Add more currencies as needed
};

const defaultConfig = { locale: 'es-CL', decimals: 0, symbol: '$' };

export function CurrencyInput({
  value,
  onChange,
  currency = 'CLP',
  placeholder = '0',
  disabled = false,
  className,
  size = 'default',
}: CurrencyInputProps) {
  const isLarge = size === 'lg';
  const config = currencyConfig[currency] ?? defaultConfig;
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Format number for display
  const formatForDisplay = (num: number | undefined): string => {
    if (num === undefined || num === null || isNaN(num)) return '';

    return new Intl.NumberFormat(config.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: config.decimals,
    }).format(num);
  };

  // Parse display string to number
  const parseToNumber = (str: string): number | undefined => {
    if (!str || str.trim() === '') return undefined;

    // Remove currency symbol and spaces
    let cleaned = str.replace(/[^\d.,\-]/g, '');

    // Handle different decimal separators based on locale
    if (config.locale === 'de-DE' || config.locale === 'es-CL') {
      // European/Chilean format: 1.234,56 -> 1234.56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.56 -> 1234.56
      cleaned = cleaned.replace(/,/g, '');
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  };

  // Update display when value prop changes (and not focused)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatForDisplay(value));
    }
  }, [value, currency, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Allow empty input
    if (!input) {
      setDisplayValue('');
      onChange(undefined);
      return;
    }

    // Get the decimal separator for this locale
    const decimalSeparator = config.locale === 'en-US' ? '.' : ',';

    // Only allow numbers, one decimal separator, and minus sign at start
    const regex = config.locale === 'en-US'
      ? /^-?\d*\.?\d*$/
      : /^-?\d*,?\d*$/;

    // Remove thousand separators for validation
    const cleanedForValidation = config.locale === 'en-US'
      ? input.replace(/,/g, '')
      : input.replace(/\./g, '');

    if (!regex.test(cleanedForValidation)) {
      return; // Invalid input, don't update
    }

    // Parse the number
    const numValue = parseToNumber(input);

    // Format while typing (but preserve cursor position logic)
    if (numValue !== undefined) {
      // For currencies without decimals, format immediately
      if (config.decimals === 0) {
        const formatted = formatForDisplay(numValue);
        setDisplayValue(formatted);
      } else {
        // For currencies with decimals, only format the integer part while typing
        // to avoid issues with decimal input
        const parts = cleanedForValidation.split(decimalSeparator);
        if (parts.length === 2) {
          // Has decimal part - format integer part only
          const intPart = parseInt(parts[0].replace('-', ''), 10);
          const formattedInt = isNaN(intPart) ? '' : formatForDisplay(intPart);
          const sign = parts[0].startsWith('-') ? '-' : '';
          setDisplayValue(`${sign}${formattedInt}${decimalSeparator}${parts[1]}`);
        } else {
          setDisplayValue(formatForDisplay(numValue));
        }
      }
    } else {
      setDisplayValue(input);
    }

    onChange(numValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Format properly on blur
    if (value !== undefined) {
      setDisplayValue(formatForDisplay(value));
    } else {
      setDisplayValue('');
    }
  };

  return (
    <div className="relative">
      <span className={cn(
        "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground",
        isLarge ? "text-2xl left-4" : "text-sm"
      )}>
        {config.symbol}
      </span>
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          isLarge
            ? 'pl-10 h-16 text-3xl font-semibold text-center'
            : 'pl-7',
          className
        )}
      />
    </div>
  );
}

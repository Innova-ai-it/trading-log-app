import React, { useState, useRef, useEffect } from 'react';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  label?: string;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  suggestions,
  placeholder,
  required = false,
  className = '',
  label
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filtra i suggerimenti in base al valore digitato
  useEffect(() => {
    if (value.trim() === '') {
      setFilteredSuggestions(suggestions);
    } else {
      const filtered = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
    }
  }, [value, suggestions]);

  // Chiudi il dropdown quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestions(true);
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  return (
    <div className="space-y-2 relative">
      {label && (
        <label className="text-sm font-medium text-gray-300">{label}</label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          required={required}
          placeholder={placeholder}
          className={`w-full bg-background border border-border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-primary outline-none ${className}`}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-primary/20 transition-colors first:rounded-t-lg last:rounded-b-lg"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


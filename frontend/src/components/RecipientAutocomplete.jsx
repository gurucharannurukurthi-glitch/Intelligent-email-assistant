import React, { useState, useEffect, useRef } from 'react';
import { Mail, Sparkles } from 'lucide-react';
import api from '../services/api';

export function RecipientAutocomplete({
  value = '',
  onChange,
  placeholder = 'Type name or email address...',
  required = true,
  className = ''
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch suggestions when value changes
  useEffect(() => {
    const query = value.trim();
    if (!query || query.length < 1) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    let isMounted = true;
    const fetchSuggestions = async () => {
      try {
        const res = await api.get('/emails/contacts', {
          params: { q: query }
        });
        if (isMounted) {
          const list = res.data?.contacts || [];
          setSuggestions(list);
          setIsOpen(list.length > 0);
          setSelectedIndex(-1);
        }
      } catch (err) {
        if (isMounted) setSuggestions([]);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 120);
    return () => {
      isMounted = false;
      clearTimeout(debounceTimer);
    };
  }, [value]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (contact) => {
    onChange(contact.email);
    setIsOpen(false);
    setSelectedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="email"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />

      {/* Floating Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 theme-card rounded-2xl border theme-border shadow-2xl overflow-hidden max-h-64 overflow-y-auto divide-y theme-border backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-60 theme-text-muted bg-black/5 dark:bg-white/5 flex items-center justify-between">
            <span>Matching Suggestions</span>
            <span>Gmail & Live Search</span>
          </div>

          {suggestions.map((contact, idx) => {
            const isSelected = idx === selectedIndex;
            const initial = (contact.name || contact.email || 'U')[0].toUpperCase();

            return (
              <div
                key={contact.email}
                onClick={() => handleSelect(contact)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar Icon / Initial */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white font-semibold text-xs shrink-0 shadow-sm">
                    {initial}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold theme-text-main truncate">
                      {contact.name || contact.email.split('@')[0]}
                    </div>
                    <div className="text-[11px] opacity-70 theme-text-muted truncate flex items-center gap-1">
                      <Mail className="w-3 h-3 shrink-0" />
                      <span>{contact.email}</span>
                    </div>
                  </div>
                </div>

                {contact.isSuggestedDomain ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                    <Sparkles className="w-2.5 h-2.5" /> Suggestion
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 theme-text-muted shrink-0">
                    Contact
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

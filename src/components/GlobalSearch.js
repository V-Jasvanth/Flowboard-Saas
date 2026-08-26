'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowRight, Hash, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export default function GlobalSearch() {
  const { headers } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  // Debounced search
  const doSearch = useCallback(async (q) => {
    if (!q.trim() || !currentWorkspace) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Abort previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&workspace_id=${currentWorkspace.id}`,
        { headers: headers(), signal: controller.signal }
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, headers]);

  // Debounce input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    setLoading(true);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cmd+K shortcut
  useEffect(() => {
    const handleShortcut = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (inputRef.current) {
          inputRef.current.focus();
          if (query) setIsOpen(true);
        }
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') { setQuery(''); setIsOpen(false); inputRef.current?.blur(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      navigateToResult(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Navigate to the board with task highlight
  const navigateToResult = (result) => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    router.push(`/dashboard/board/${result.projectId}?highlight=${result.id}`);
  };

  const priorityColors = {
    critical: { bg: 'var(--danger-soft)', color: 'var(--danger)' },
    high: { bg: 'var(--warning-soft)', color: 'var(--warning)' },
    medium: { bg: 'var(--primary-soft)', color: 'var(--primary-hover)' },
    low: { bg: 'rgba(100,116,139,0.2)', color: 'var(--text-muted)' },
  };

  const highlightMatch = (text, q) => {
    if (!q || !text) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: 'rgba(99,102,241,0.3)', color: 'var(--text)', borderRadius: 2, padding: '0 1px' }}>
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className="global-search" style={{ position: 'relative' }}>
      <div className="search-bar">
        <Search size={16} />
        <input
          ref={inputRef}
          type="text"
          className="input"
          placeholder="Search... (Cmd+K)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (query.trim()) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          style={{ width: isOpen || query ? 320 : 200, paddingLeft: 36, transition: 'width 0.2s ease' }}
        />
        {query && (
          <button
            className="search-clear"
            onClick={() => { setQuery(''); setResults([]); setIsOpen(false); inputRef.current?.focus(); }}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
        {loading && (
          <div className="search-spinner">
            <Loader2 size={14} className="search-loading-icon" />
          </div>
        )}
      </div>

      {isOpen && (
        <div ref={dropdownRef} className="search-dropdown" id="search-results-dropdown">
          {loading && results.length === 0 ? (
            <div className="search-dropdown-empty">
              <Loader2 size={20} className="search-loading-icon" />
              <span>Searching...</span>
            </div>
          ) : results.length === 0 && query.trim() ? (
            <div className="search-dropdown-empty">
              <Search size={20} />
              <span>No matching tasks found</span>
            </div>
          ) : (
            <>
              <div className="search-dropdown-header">
                <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
                <span className="search-hint">↑↓ navigate · ↵ open · esc close</span>
              </div>
              <div className="search-dropdown-list">
                {results.map((r, i) => {
                  const pc = priorityColors[r.priority] || priorityColors.medium;
                  return (
                    <div
                      key={r.id}
                      className={`search-result-item ${i === activeIndex ? 'active' : ''}`}
                      onClick={() => navigateToResult(r)}
                      onMouseEnter={() => setActiveIndex(i)}
                    >
                      <div className="search-result-left">
                        <span className="search-result-key">{r.taskKey}</span>
                        <span className="search-result-title">{highlightMatch(r.title, query)}</span>
                      </div>
                      <div className="search-result-right">
                        <span
                          className="search-result-status"
                          style={{ borderLeft: `3px solid ${r.columnColor || '#64748b'}` }}
                        >
                          {r.columnName}
                        </span>
                        <span
                          className="search-result-priority"
                          style={{ background: pc.bg, color: pc.color }}
                        >
                          {r.priority}
                        </span>
                        {r.assigneeName && (
                          <span className="search-result-assignee" title={r.assigneeName}>
                            {r.assigneeName.split(' ')[0]}
                          </span>
                        )}
                        <ArrowRight size={14} className="search-result-arrow" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

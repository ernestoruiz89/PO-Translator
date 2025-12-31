import { useState, useCallback, useEffect } from 'react';
import './App.css';
import { parsePOFile, generatePOFile } from './utils/poParser';
import type { TranslationEntry, ParsedPO } from './utils/poParser';
import { loadSettings, saveSettings, getAISuggestions, type AISettings, type AIProvider } from './utils/aiService';

type FilterType = 'all' | 'pending' | 'translated';

function App() {
  const [poData, setPoData] = useState<ParsedPO | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<TranslationEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(loadSettings);
  const [error, setError] = useState<string | null>(null);

  // Save settings when they change
  useEffect(() => {
    saveSettings(aiSettings);
  }, [aiSettings]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const parsed = parsePOFile(content);
        setPoData(parsed);
        setSelectedEntry(null);
        setAiSuggestions([]);
      } catch (err) {
        console.error('Error parsing PO file:', err);
        alert('Error parsing PO file. Please check the file format.');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.name.endsWith('.po')) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          const parsed = parsePOFile(content);
          setPoData(parsed);
          setSelectedEntry(null);
          setAiSuggestions([]);
        } catch (err) {
          console.error('Error parsing PO file:', err);
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const updateTranslation = useCallback((id: string, newMsgstr: string) => {
    if (!poData) return;

    setPoData({
      ...poData,
      entries: poData.entries.map((entry) =>
        entry.id === id
          ? { ...entry, msgstr: newMsgstr, status: newMsgstr ? 'translated' : 'pending' }
          : entry
      ),
    });

    if (selectedEntry?.id === id) {
      setSelectedEntry({ ...selectedEntry, msgstr: newMsgstr, status: newMsgstr ? 'translated' : 'pending' });
    }
  }, [poData, selectedEntry]);

  const handleAISuggest = useCallback(async (entry: TranslationEntry) => {
    // Check if API key is configured
    const hasKey = aiSettings.provider === 'openai' ? aiSettings.openaiKey : aiSettings.geminiKey;
    if (!hasKey) {
      setShowSettings(true);
      setError('Please configure your API key first');
      return;
    }

    setIsLoading(true);
    setAiSuggestions([]);
    setError(null);

    try {
      // Get target language from PO headers
      const targetLang = poData?.headers?.['Language'] || poData?.headers?.['language'] || 'Spanish';
      const langName = getLanguageName(targetLang);

      const suggestions = await getAISuggestions(entry.msgid, langName, aiSettings, entry.comments);
      setAiSuggestions(suggestions);
    } catch (err) {
      console.error('AI suggestion error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get AI suggestions');
    } finally {
      setIsLoading(false);
    }
  }, [poData, aiSettings]);

  const applySuggestion = useCallback((suggestion: string) => {
    if (!selectedEntry || !poData) return;

    setPoData({
      ...poData,
      entries: poData.entries.map((e) =>
        e.id === selectedEntry.id
          ? { ...e, msgstr: suggestion, status: 'translated' as const }
          : e
      ),
    });
    setSelectedEntry({ ...selectedEntry, msgstr: suggestion, status: 'translated' });
    setAiSuggestions([]);
  }, [poData, selectedEntry]);

  const handleExport = useCallback(() => {
    if (!poData) return;

    const content = generatePOFile(poData);
    const blob = new Blob([content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    let exportName = fileName || 'translations.po';
    if (!exportName.toLowerCase().endsWith('.po')) {
      exportName = exportName.replace(/\.[^/.]+$/, '') + '.po';
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = exportName;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
  }, [poData, fileName]);

  const handleSelectEntry = useCallback((entry: TranslationEntry) => {
    setSelectedEntry(entry);
    setAiSuggestions([]);
    setError(null);
  }, []);

  const filteredEntries = poData?.entries.filter((entry) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'pending' && entry.status === 'pending') ||
      (filter === 'translated' && (entry.status === 'translated' || entry.status === 'ai-suggested'));

    const matchesSearch =
      !searchQuery ||
      entry.msgid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.msgstr.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  }) || [];

  const stats = {
    total: poData?.entries.length || 0,
    translated: poData?.entries.filter((e) => e.status !== 'pending').length || 0,
    pending: poData?.entries.filter((e) => e.status === 'pending').length || 0,
  };

  return (
    <div className="app">
      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>AI Settings</h2>
              <button className="btn btn-ghost" onClick={() => setShowSettings(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="setting-group">
                <label>AI Provider</label>
                <div className="provider-tabs">
                  {(['openai', 'gemini'] as AIProvider[]).map((p) => (
                    <button
                      key={p}
                      className={`provider-tab ${aiSettings.provider === p ? 'active' : ''}`}
                      onClick={() => setAiSettings({ ...aiSettings, provider: p })}
                    >
                      {p === 'openai' ? 'OpenAI' : 'Google Gemini'}
                    </button>
                  ))}
                </div>
              </div>

              {aiSettings.provider === 'openai' && (
                <div className="setting-group">
                  <label>OpenAI API Key</label>
                  <input
                    type="password"
                    value={aiSettings.openaiKey}
                    onChange={(e) => setAiSettings({ ...aiSettings, openaiKey: e.target.value })}
                    placeholder="sk-..."
                  />
                  <p className="setting-hint">Uses gpt-4o-mini model</p>
                </div>
              )}

              {aiSettings.provider === 'gemini' && (
                <div className="setting-group">
                  <label>Gemini API Key</label>
                  <input
                    type="password"
                    value={aiSettings.geminiKey}
                    onChange={(e) => setAiSettings({ ...aiSettings, geminiKey: e.target.value })}
                    placeholder="AIza..."
                  />
                  <p className="setting-hint">Uses gemini-2.5-flash model</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowSettings(false)}>
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span>PO Translator</span>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost" onClick={() => setShowSettings(true)} title="AI Settings">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            {poData && (
              <button className="btn btn-primary" onClick={handleExport}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export .po
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        {!poData ? (
          /* Dropzone */
          <div
            className="dropzone glass animate-fadeIn"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="dropzone-content">
              <div className="dropzone-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M12 12v6" />
                  <path d="m15 15-3-3-3 3" />
                </svg>
              </div>
              <h2>Drop your .po file here</h2>
              <p>or click to browse</p>
              <input
                type="file"
                accept=".po"
                onChange={handleFileUpload}
                className="dropzone-input"
              />
            </div>
          </div>
        ) : (
          /* Main Content */
          <div className="content animate-fadeIn">
            {/* Stats Bar */}
            <div className="stats-bar glass">
              <div className="stat">
                <span className="stat-value">{stats.total}</span>
                <span className="stat-label">Total</span>
              </div>
              <div className="stat">
                <span className="stat-value stat-success">{stats.translated}</span>
                <span className="stat-label">Translated</span>
              </div>
              <div className="stat">
                <span className="stat-value stat-warning">{stats.pending}</span>
                <span className="stat-label">Pending</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${stats.total ? (stats.translated / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Filter Bar */}
            <div className="filter-bar">
              <div className="filter-tabs">
                {(['all', 'pending', 'translated'] as FilterType[]).map((f) => (
                  <button
                    key={f}
                    className={`filter-tab ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    <span className="filter-count">
                      {f === 'all' ? stats.total : f === 'pending' ? stats.pending : stats.translated}
                    </span>
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search translations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Main Grid */}
            <div className="workspace">
              {/* Entry List */}
              <div className="entry-list glass">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`entry-item ${selectedEntry?.id === entry.id ? 'selected' : ''}`}
                    onClick={() => handleSelectEntry(entry)}
                  >
                    <div className="entry-header">
                      <span className={`badge badge-${entry.status === 'pending' ? 'pending' : 'translated'}`}>
                        {entry.status === 'pending' ? 'Pending' : 'Done'}
                      </span>
                    </div>
                    <div className="entry-msgid">{entry.msgid}</div>
                    {entry.msgstr && <div className="entry-msgstr">{entry.msgstr}</div>}
                  </div>
                ))}
                {filteredEntries.length === 0 && (
                  <div className="empty-state">
                    <p>No entries match your filter</p>
                  </div>
                )}
              </div>

              {/* Detail Panel */}
              <div className="detail-panel glass">
                {selectedEntry ? (
                  <>
                    <div className="detail-section">
                      <label>Source (msgid)</label>
                      <div className="source-text">{selectedEntry.msgid}</div>
                    </div>
                    {selectedEntry.comments && (
                      <div className="detail-section">
                        <label>Context</label>
                        <div className="context-text">{selectedEntry.comments}</div>
                      </div>
                    )}
                    <div className="detail-section">
                      <label>Translation (msgstr)</label>
                      <textarea
                        value={selectedEntry.msgstr}
                        onChange={(e) => updateTranslation(selectedEntry.id, e.target.value)}
                        placeholder="Enter translation..."
                      />
                    </div>

                    {/* AI Suggestions Section */}
                    <div className="detail-section">
                      <div className="ai-section-header">
                        <label>
                          AI Suggestions
                          <span className="provider-badge">
                            {aiSettings.provider === 'openai' ? 'OpenAI' : 'Gemini'}
                          </span>
                        </label>
                        <button
                          className="btn btn-secondary ai-btn"
                          onClick={() => handleAISuggest(selectedEntry)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <span className="spinner"></span>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 22l-.75-12.07A4.001 4.001 0 0 1 12 2z" />
                              </svg>
                              Generate
                            </>
                          )}
                        </button>
                      </div>

                      {error && (
                        <div className="error-message">{error}</div>
                      )}

                      {aiSuggestions.length > 0 && (
                        <div className="suggestions-list">
                          {aiSuggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              className="suggestion-item"
                              onClick={() => applySuggestion(suggestion)}
                            >
                              <span className="suggestion-text">{suggestion}</span>
                              <span className="suggestion-apply">Apply</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {!isLoading && !error && aiSuggestions.length === 0 && (
                        <p className="suggestions-hint">Click "Generate" to get AI suggestions</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="m5 8 6 6m-6 0 6-6" />
                      <path d="M12 19a7 7 0 1 0 0-14v14" />
                    </svg>
                    <p>Select an entry to translate</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Helper function to get language name from code
function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    es: 'Spanish', en: 'English', fr: 'French', de: 'German',
    pt: 'Portuguese', it: 'Italian', nl: 'Dutch', pl: 'Polish',
    ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
    ar: 'Arabic', hi: 'Hindi', tr: 'Turkish', vi: 'Vietnamese',
  };
  const langCode = code.split('_')[0].toLowerCase();
  return languages[langCode] || code;
}

export default App;

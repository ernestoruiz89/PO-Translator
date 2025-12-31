/**
 * Browser-native PO file parser
 * No external dependencies required
 */

export interface TranslationEntry {
    id: string;
    msgid: string;
    msgstr: string;
    context?: string;
    comments?: string;
    status: 'pending' | 'translated' | 'ai-suggested';
}

export interface ParsedPO {
    headers: Record<string, string>;
    entries: TranslationEntry[];
}

// Parse a PO file string into structured data
export function parsePOFile(content: string): ParsedPO {
    const entries: TranslationEntry[] = [];
    const headers: Record<string, string> = {};

    // Normalize line endings
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split into blocks (separated by blank lines)
    const blocks = normalizedContent.split(/\n\n+/);

    for (const block of blocks) {
        if (!block.trim()) continue;

        const entry = parseBlock(block);
        if (!entry) continue;

        // Header block has empty msgid
        if (entry.msgid === '') {
            parseHeaders(entry.msgstr, headers);
        } else {
            entries.push({
                id: `${entry.context || ''}_${entry.msgid}`,
                msgid: entry.msgid,
                msgstr: entry.msgstr,
                context: entry.context,
                comments: entry.comments,
                status: entry.msgstr ? 'translated' : 'pending',
            });
        }
    }

    return { headers, entries };
}

interface RawEntry {
    msgid: string;
    msgstr: string;
    context?: string;
    comments?: string;
}

function parseBlock(block: string): RawEntry | null {
    const lines = block.split('\n');

    let msgid = '';
    let msgstr = '';
    let context: string | undefined;
    let comments = '';
    let currentField: 'msgid' | 'msgstr' | 'msgctxt' | null = null;

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) continue;

        // Comment lines
        if (trimmed.startsWith('#')) {
            if (trimmed.startsWith('#.')) {
                comments += trimmed.slice(2).trim() + ' ';
            } else if (trimmed.startsWith('#:')) {
                // Reference comment, could be useful
                comments += trimmed.slice(2).trim() + ' ';
            }
            continue;
        }

        // Field declarations
        if (trimmed.startsWith('msgctxt ')) {
            context = extractString(trimmed.slice(8));
            currentField = 'msgctxt';
        } else if (trimmed.startsWith('msgid ')) {
            msgid = extractString(trimmed.slice(6));
            currentField = 'msgid';
        } else if (trimmed.startsWith('msgstr ')) {
            msgstr = extractString(trimmed.slice(7));
            currentField = 'msgstr';
        } else if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            // Continuation line
            const continued = extractString(trimmed);
            if (currentField === 'msgid') {
                msgid += continued;
            } else if (currentField === 'msgstr') {
                msgstr += continued;
            } else if (currentField === 'msgctxt') {
                context = (context || '') + continued;
            }
        }
    }

    return { msgid, msgstr, context, comments: comments.trim() || undefined };
}

function extractString(quoted: string): string {
    // Remove surrounding quotes and unescape
    const match = quoted.match(/^"(.*)"$/);
    if (!match) return quoted;

    return match[1]
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
}

function parseHeaders(headerStr: string, headers: Record<string, string>) {
    const lines = headerStr.split('\n');
    for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            const value = line.slice(colonIdx + 1).trim();
            headers[key] = value;
        }
    }
}

// Generate a PO file string from structured data
export function generatePOFile(data: ParsedPO): string {
    const lines: string[] = [];

    // Header
    lines.push('# Translation File');
    lines.push('msgid ""');
    lines.push('msgstr ""');

    const headerLines = Object.entries(data.headers)
        .map(([key, value]) => `"${key}: ${value}\\n"`)
        .join('\n');
    if (headerLines) {
        lines.push(headerLines);
    }
    lines.push('');

    // Entries
    for (const entry of data.entries) {
        if (entry.comments) {
            lines.push(`#. ${entry.comments}`);
        }
        if (entry.context) {
            lines.push(`msgctxt ${escapeString(entry.context)}`);
        }
        lines.push(`msgid ${escapeString(entry.msgid)}`);
        lines.push(`msgstr ${escapeString(entry.msgstr)}`);
        lines.push('');
    }

    return lines.join('\n');
}

function escapeString(str: string): string {
    const escaped = str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r');

    return `"${escaped}"`;
}

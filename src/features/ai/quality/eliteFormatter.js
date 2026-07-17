/**
 * EliteFormatter Module (Architectural Version 12.0 - Gemini Pro Standard)
 * Responsibility: Transforming raw AI text into a high-end visual response.
 * Focus: Cognitive Ease (Visual Calm), Closed-Loop Completion, and Persistent Personalization.
 */
class EliteFormatter {
    static format(text, meta = {}) {
        if (!text) return "";
        let formatted = text;
        const intent = String(meta.intent || 'GENERAL').toUpperCase();

        // 1. Core Cleanup (Anti-Stutter & Fluff Removal)
        formatted = this._removeStuttering(formatted);
        formatted = this._stripFluff(formatted);

        // 1b. Repair tables the model wrote as one run-on line instead of one row per line
        // (e.g. "| A | B | |-|-| C | D | | E | F |") — this happens under streaming/token
        // pressure even with correct prompt instructions, so we defend against it here too.
        formatted = this._repairCollapsedTables(formatted);

        // 1c. Even a well-formed table can have cells too long for a mobile column (prose
        // crammed into a cell) — demote those specific tables to a bulleted list instead.
        formatted = this._demoteVerboseTables(formatted);

        // 2. Cognitive Ease: Visual Calm Standard (Point 42)
        formatted = this._applyCognitiveEase(formatted);

        // 3. Intent-Based Visual Logic
        if (['JOB_QUERY', 'JOB_SEARCH', 'JOB_DETAILS', 'FIELD_DETAILS', 'SCHOLARSHIP', 'GRANTS', 'RESULT_ADMIT_CARD'].includes(intent)) {
            formatted = this._ensureTables(formatted);
            formatted = this._highlightMatchScores(formatted);
        } else if (['CAREER_GUIDANCE', 'SKILLS', 'INTERVIEW', 'CAREER_ADVICE', 'PART_TIME'].includes(intent)) {
            formatted = this._ensureRoadmap(formatted);
        } else if (intent === 'RESUME') {
            formatted = this._ensureChecklist(formatted);
        }

        // 4. Common Enhancements
        formatted = this._highlightScams(formatted);
        formatted = this._highlightDatesAndLinks(formatted);
        formatted = this._removeConflictingQualificationClaims(formatted, meta.userProfile);

        // 5. Closed-Loop Completion (Point 43)
        formatted = this._addPersonalizedClosing(formatted, meta.userProfile, intent);

        return formatted.trim();
    }

    /**
     * Detects a table the model wrote as a single run-on line (header, "|-|-|-|" separator,
     * and all data rows concatenated with no real newlines — row boundaries show up as an
     * artifact "| |" where one row's closing pipe touches the next row's opening pipe) and
     * rebuilds it into a proper one-row-per-line GFM table using the header's column count.
     */
    static _repairCollapsedTables(text) {
        if (!text || !text.includes('|')) return text;

        return text.split(/\n{2,}/).map(block => {
            const pipeLines = block.split('\n').filter(l => l.trim().startsWith('|'));
            // Already row-per-line (a normal, well-formed table) — leave it untouched.
            if (pipeLines.length >= 2) return block;
            if (!block.includes('|')) return block;
            return this._rebuildCollapsedTable(block);
        }).join('\n\n');
    }

    static _rebuildCollapsedTable(block) {
        const firstPipe = block.indexOf('|');
        if (firstPipe === -1) return block;

        const before = block.slice(0, firstPipe).trim();
        const tableText = block.slice(firstPipe);

        const rawCells = tableText.split('|').map(c => c.trim());
        const cells = rawCells.filter((c, i) => !(i === 0 && c === ''));

        // Locate the separator run (consecutive dash-only cells, e.g. "-", "---", ":--", "--:").
        let sepStart = -1, sepLen = 0;
        for (let i = 0; i < cells.length; i++) {
            if (/^:?-{1,}:?$/.test(cells[i])) {
                let j = i;
                while (j < cells.length && /^:?-{1,}:?$/.test(cells[j])) j++;
                sepStart = i;
                sepLen = j - i;
                break;
            }
        }
        if (sepStart < 1) return block; // no real separator run found — not a table, leave alone

        const headerCells = cells.slice(0, sepStart).filter(c => c !== '');
        const columns = headerCells.length;
        if (columns < 2) return block;

        const dataCells = cells.slice(sepStart + sepLen).filter(c => c !== '');
        if (dataCells.length === 0) return block;

        const rows = [];
        for (let i = 0; i + columns <= dataCells.length; i += columns) {
            rows.push(dataCells.slice(i, i + columns));
        }
        if (rows.length === 0) return block;

        const headerRow = `| ${headerCells.join(' | ')} |`;
        const sepRow = `| ${headerCells.map(() => '---').join(' | ')} |`;
        const dataRows = rows.map(r => `| ${r.join(' | ')} |`).join('\n');

        return [before, `${headerRow}\n${sepRow}\n${dataRows}`].filter(Boolean).join('\n\n');
    }

    /**
     * Defense-in-depth: even with prompt guidance, the model sometimes renders a table whose
     * cells are long prose fragments (e.g. "12th ke baad 1-yr Foundation course with NCERT and
     * basic computer"). On mobile this squeezes columns unreadably thin. If any data cell
     * exceeds the word threshold, convert the whole table into a bulleted list — one bullet
     * per row, using the header as bold field labels. Runs on already row-per-line tables
     * (post `_repairCollapsedTables`); does not touch that function or its output otherwise.
     */
    static _demoteVerboseTables(text, maxWordsPerCell = 8) {
        if (!text || !text.includes('|')) return text;

        return text.split(/\n{2,}/).map(block => {
            const pipeLines = block.split('\n').filter(l => l.trim().startsWith('|'));
            if (pipeLines.length < 2) return block; // not a well-formed table block

            const parsed = this._parseGfmTable(block.split('\n'));
            if (!parsed) return block;

            const { header, rows } = parsed;
            const tooVerbose = rows.some(row =>
                row.some(cell => cell.split(/\s+/).filter(Boolean).length > maxWordsPerCell)
            );
            if (!tooVerbose) return block;

            return this._tableToBullets(header, rows);
        }).join('\n\n');
    }

    /**
     * Parses a well-formed (row-per-line) GFM table block into { header, rows }.
     * Returns null if the block isn't a clean header+separator+data table.
     */
    static _parseGfmTable(lines) {
        const pipeLineIdx = lines
            .map((l, i) => (l.trim().startsWith('|') ? i : -1))
            .filter(i => i !== -1);
        if (pipeLineIdx.length < 2) return null;

        const splitRow = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

        const headerLine = lines[pipeLineIdx[0]];
        const sepLine = lines[pipeLineIdx[1]];
        if (!/^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(sepLine)) return null;

        const header = splitRow(headerLine);
        const rows = pipeLineIdx.slice(2).map(i => splitRow(lines[i])).filter(r => r.length === header.length);
        if (rows.length === 0) return null;

        return { header, rows };
    }

    /**
     * Converts a parsed table into a bulleted list: one top-level bullet per row (labelled by
     * the first column), with remaining fields as "**Header:** value" sub-bullets.
     */
    static _tableToBullets(header, rows) {
        return rows.map(row => {
            const title = row[0];
            const fields = header.slice(1).map((h, i) => `  - **${h}:** ${row[i + 1]}`).join('\n');
            return `- **${title}**\n${fields}`;
        }).join('\n\n');
    }

    /**
     * Ensures paragraphs are short and white space is used as a 'Visual Calm' (Point 42).
     */
    static _applyCognitiveEase(text) {
        if (!text) return text;

        // Ensure double newlines between blocks, but keep table rows / consecutive list items
        // adjacent (single newline) within their own block — GFM tables require the header,
        // separator, and data rows to be on consecutive lines with no blank line between them.
        // Trim trailing whitespace only — leading indentation is preserved so nested sub-bullets
        // (e.g. "  - **Field:** value" under a parent bullet) don't collapse to flat top-level items.
        let lines = text.split('\n').map(l => l.replace(/\s+$/, ''));
        let blocks = [];
        let currentPara = [];
        let currentPassthrough = [];

        const flushPara = () => {
            if (currentPara.length > 0) {
                blocks.push(currentPara.join(' '));
                currentPara = [];
            }
        };
        const flushPassthrough = () => {
            if (currentPassthrough.length > 0) {
                blocks.push(currentPassthrough.join('\n'));
                currentPassthrough = [];
            }
        };
        const isPassthroughLine = (line) => {
            const trimmed = line.trimStart();
            return trimmed.startsWith('#') || trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('|') || /^\d+\./.test(trimmed);
        };

        for (let line of lines) {
            if (line.trim() === "") {
                flushPara();
                flushPassthrough();
                continue;
            }

            if (isPassthroughLine(line)) {
                flushPara();
                currentPassthrough.push(line);
            } else {
                flushPassthrough();
                const trimmedLine = line.trim();
                currentPara.push(trimmedLine);
                // Force break if paragraph exceeds ~3 sentences
                if ((trimmedLine.endsWith('.') || trimmedLine.endsWith('!') || trimmedLine.endsWith('?')) && currentPara.length >= 3) {
                    flushPara();
                }
            }
        }
        flushPara();
        flushPassthrough();

        return blocks.join('\n\n');
    }

    /**
     * Career Advice ko ek "Step-by-Step Roadmap" jaisa dikhana.
     */
    static _ensureRoadmap(text) {
        return text;
    }

    /**
     * Resume guidance ko ek "Checklist" jaisa dikhana.
     */
    static _ensureChecklist(text) {
        return text.replace(/^- /gm, '✅ ');
    }

    /**
     * Highlights key fields in job listings. Does NOT touch '|' table syntax —
     * the client renders real GFM tables now, so stripping pipes here would break them.
     */
    static _ensureTables(text) {
        return text
            .replace(/(Vacancy|Post|seat):/gi, '📋 **Vacancy**:')
            .replace(/(Last Date|अंतिम तिथि):/gi, '📅 **Last Date**:')
            .replace(/(Fees?|paisa):/gi, '💰 **Fees**:')
            .replace(/\n{3,}/g, '\n\n');
    }

    static _highlightDatesAndLinks(text) {
        return text.replace(/(https?:\/\/[^\s]+)/g, (url) => {
            if (url.includes(']') || url.includes(')')) return url;
            return `[Official Link](${url})`;
        });
    }

    /**
     * Visual treatment for Match Scores (Point 14).
     */
    static _highlightMatchScores(text) {
        return text.replace(/Match Score:\s*(\d+)%/gi, (match, score) => {
            let emoji = score > 80 ? "🔥" : "⚖️";
            return `**${emoji} Match Score: ${score}%**`;
        });
    }

    /**
     * Red Alert treatment for potential scams (Point 36).
     */
    static _highlightScams(text) {
        if (text.includes('SCAM ALERT') || text.includes('RED ALERT') || text.includes('FAKE')) {
            return `🚨 **SCAM ALERT / WARNING** 🚨\n\n${text}`;
        }
        return text;
    }

    static _stripFluff(text) {
        const patterns = [
            /^Aapke liye ye rahi jankari:?\s*/i,
            /^Zaroor, main batata hoon:?\s*/i,
            /^Niche di gayi details dekhein:?\s*/i,
            /^As an AI, I can help:?\s*/i
        ];
        let cleaned = text;
        patterns.forEach(p => { cleaned = cleaned.replace(p, ''); });
        return cleaned;
    }

    static _removeStuttering(text) {
        if (!text) return text;
        // Table rows are legitimately repetitive (e.g. "| --- | --- | --- |") — the pattern-loop
        // check below would otherwise collapse a valid separator row down to a single cell.
        return text.split('\n').map(line => {
            if (line.trim().startsWith('|')) return line;
            let cleaned = line.replace(/(.)\1{4,}/g, '$1'); // Character stutter
            cleaned = cleaned.replace(/\b(\w{3,})\s+\1\b/gi, '$1'); // Word stutter
            cleaned = cleaned.replace(/(.{4,10}?)\1{2,}/gi, '$1'); // Pattern loops
            cleaned = cleaned.replace(/([\u{1F300}-\u{1F9FF}!.?])\1+/gu, '$1');
            return cleaned;
        }).join('\n');
    }

    /**
     * Point 43: Closed-Loop Completion. Adds a closing only when the answer has not
     * already given the user an actionable next move.
     */
    static _addPersonalizedClosing(text, profile, intent) {
        const cleanText = String(text || '');
        const hasAction = /\b(next step|agla step|action item|aaj ka task|roadmap|apply|documents?|practice|start with|pehla step)\b/i.test(cleanText);
        const hasQuestion = /\?\s*$/m.test(cleanText.trim());
        const isFactual = ['JOB_QUERY', 'JOB_SEARCH', 'JOB_DETAILS', 'FIELD_DETAILS', 'SCHOLARSHIP', 'GRANTS', 'RESULT_ADMIT_CARD', 'LOCAL_SCOUT', 'PART_TIME'].includes(intent);

        if (hasAction || hasQuestion || cleanText.length < 180) return text;

        const closing = isFactual
            ? `\n\nNext step: official link/status verify karke hi form ya payment proceed karna.`
            : `\n\nNext step: apni current situation ka ek detail bata do, main isko aur exact bana dunga.`;

        return text + closing;
    }

    static _removeConflictingQualificationClaims(text, profile) {
        if (!profile || !profile.qualification) return text;
        const qualification = String(profile.qualification).toLowerCase();
        const profileIs12th = /\b12th\b|\b12वीं\b|\bbarahvi\b|\bintermediate\b/i.test(qualification);
        if (profileIs12th) return text;

        return text
            .split('\n')
            .filter(line => !/\baap\s+(12th|12वीं|barahvi|intermediate)\s*(pass)?\s*(ho|hai|hain)?\b/i.test(line))
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
}

module.exports = EliteFormatter;

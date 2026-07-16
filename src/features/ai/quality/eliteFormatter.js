/**
 * EliteFormatter Module (Architectural Version 12.0 - Gemini Pro Standard)
 * Responsibility: Transforming raw AI text into a high-end visual response.
 * Focus: Cognitive Ease (Visual Calm), Closed-Loop Completion, and Persistent Personalization.
 */
const Grounding = require('./grounding');

class EliteFormatter {
    static format(text, meta = {}) {
        if (!text) return "";
        let formatted = text;
        const intent = String(meta.intent || 'GENERAL').toUpperCase();

        // 1. Core Cleanup (Anti-Stutter & Fluff Removal)
        formatted = this._removeStuttering(formatted);
        formatted = this._stripFluff(formatted);

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

        // 5. Closed-Loop Completion & EQ closing (Point 43 & 18)
        formatted = this._addPersonalizedClosing(formatted, meta.userProfile, intent);
        formatted = this._appendVerificationFooter(formatted, meta, intent);

        return formatted.trim();
    }

    /**
     * Ensures paragraphs are short and white space is used as a 'Visual Calm' (Point 42).
     */
    static _applyCognitiveEase(text) {
        if (!text) return text;

        // Ensure double newlines between blocks, but keep table rows / consecutive list items
        // adjacent (single newline) within their own block — GFM tables require the header,
        // separator, and data rows to be on consecutive lines with no blank line between them.
        let lines = text.split('\n').map(l => l.trim());
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
        const isPassthroughLine = (line) =>
            line.startsWith('#') || line.startsWith('-') || line.startsWith('*') || line.startsWith('|') || /^\d+\./.test(line);

        for (let line of lines) {
            if (line === "") {
                flushPara();
                flushPassthrough();
                continue;
            }

            if (isPassthroughLine(line)) {
                flushPara();
                currentPassthrough.push(line);
            } else {
                flushPassthrough();
                currentPara.push(line);
                // Force break if paragraph exceeds ~3 sentences
                if ((line.endsWith('.') || line.endsWith('!') || line.endsWith('?')) && currentPara.length >= 3) {
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

    static _appendVerificationFooter(text, meta = {}, intent = 'GENERAL') {
        if (!text || /Verification Sources|Official source abhi available/i.test(text)) return text;
        if (/server\s+(busy|error)|connection error|phir puch|try again|try karein|jawab nahi mila/i.test(text)) return text;

        const factualIntents = new Set([
            'JOB_QUERY', 'JOB_SEARCH', 'JOB_DETAILS', 'FIELD_DETAILS', 'SCHOLARSHIP', 'GRANTS',
            'RESULT_ADMIT_CARD', 'LOCAL_SCOUT', 'PART_TIME', 'ACADEMIC_AUDIT'
        ]);

        const evidence = Array.isArray(meta.evidence) ? meta.evidence : [];
        if (evidence.length > 0) return text + Grounding.footer(evidence);
        if (factualIntents.has(intent)) return text + Grounding.footer([]);
        return text;
    }
}

module.exports = EliteFormatter;

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

        // 2. Cognitive Ease: Visual Calm Standard (Point 42)
        formatted = this._applyCognitiveEase(formatted);

        // 3. Intent-Based Visual Logic
        if (['JOB_QUERY', 'JOB_SEARCH', 'JOB_DETAILS', 'FIELD_DETAILS', 'SCHOLARSHIP', 'RESULT_ADMIT_CARD'].includes(intent)) {
            formatted = this._ensureTables(formatted);
            formatted = this._highlightMatchScores(formatted);
        } else if (['CAREER_GUIDANCE', 'SKILLS', 'INTERVIEW', 'CAREER_ADVICE'].includes(intent)) {
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

        return formatted.trim();
    }

    /**
     * Ensures paragraphs are short and white space is used as a 'Visual Calm' (Point 42).
     */
    static _applyCognitiveEase(text) {
        if (!text) return text;

        // Ensure double newlines between paragraphs
        let lines = text.split('\n').map(l => l.trim());
        let result = [];
        let currentPara = [];

        for (let line of lines) {
            if (line === "") {
                if (currentPara.length > 0) {
                    result.push(currentPara.join(' '));
                    currentPara = [];
                }
                continue;
            }

            // If the line is a heading or list item, flush current paragraph
            if (line.startsWith('#') || line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)) {
                if (currentPara.length > 0) {
                    result.push(currentPara.join(' '));
                    currentPara = [];
                }
                result.push(line);
            } else {
                currentPara.push(line);
                // Force break if paragraph exceeds ~3 sentences
                if (line.endsWith('.') || line.endsWith('!') || line.endsWith('?')) {
                    if (currentPara.length >= 3) {
                        result.push(currentPara.join(' '));
                        currentPara = [];
                    }
                }
            }
        }
        if (currentPara.length > 0) result.push(currentPara.join(' '));

        return result.join('\n\n');
    }

    /**
     * Career Advice ko ek "Step-by-Step Roadmap" jaisa dikhana.
     */
    static _ensureRoadmap(text) {
        return text.replace(/^\d+\.\s+/gm, '🚀 Step: ');
    }

    /**
     * Resume guidance ko ek "Checklist" jaisa dikhana.
     */
    static _ensureChecklist(text) {
        return text.replace(/^- /gm, '✅ ');
    }

    /**
     * Converts raw text or messy tables into a clean Elite Card format.
     */
    static _ensureTables(text) {
        let cleaned = text.replace(/^[|]| [|] |[|]$/gm, '').replace(/^[-\s|]+$/gm, '');
        return cleaned
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
        let cleaned = text.replace(/(.)\1{4,}/g, '$1'); // Character stutter
        cleaned = cleaned.replace(/\b(\w{3,})\s+\1\b/gi, '$1'); // Word stutter
        cleaned = cleaned.replace(/(.{4,10}?)\1{2,}/gi, '$1'); // Pattern loops
        cleaned = cleaned.replace(/([\u{1F300}-\u{1F9FF}!.?])\1+/gu, '$1');
        return cleaned;
    }

    /**
     * Point 43: Closed-Loop Completion. Always ensures a next step.
     */
    static _addPersonalizedClosing(text, profile, intent) {
        const userName = profile?.name?.split(' ')[0] || "Bhai";
        let closing = "";

        // Only add if not already present
        if (text.includes('Next Step') || text.includes('Agle Din')) return text;

        if (['JOB_QUERY', 'JOB_SEARCH', 'JOB_DETAILS'].includes(intent)) {
            closing = `\n\n💡 **Bhai Ki Tip:** ${userName}, in jobs ke liye Eligibility check kar lena. Agar kisi tool ki help chahiye toh bata!`;
        } else if (['CAREER_ADVICE', 'CAREER_GUIDANCE'].includes(intent)) {
            closing = `\n\n🎯 **Action Item:** ${userName}, ye roadmap follow kar. Koi bhi doubt ho toh tera bhai yahi hai.`;
        } else {
            closing = `\n\n🤔 **Aur kuch?** ${userName} bhai, kisi aur cheez me help karun?`;
        }

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

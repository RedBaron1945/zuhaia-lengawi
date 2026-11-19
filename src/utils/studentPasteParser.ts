import { Circle } from '../types';
import { CIRCLE_NAME_TO_ID_MAP, INITIAL_TEACHERS } from '../data/mockData';

export interface ParsedStudentEntry {
  lineNumber: number;
  raw: string;
  name: string;
  uid: string;
  circleId: string;
  detectedCircle: boolean;
  isValid: boolean;
  error?: string;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const FIREBASE_UID_TOKEN_REGEX = /(?:^|[\s|,;\t:])([a-zA-Z0-9_-]{18,128})(?=$|[\s|,;\t])/;

export function isValidStudentIdFormat(id: string): boolean {
  return VALID_ID_REGEX.test(id.trim());
}

export function normalizeArabicLoose(text: string): string {
  return text
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '') // strip tashkeel / shadda / dagger alif
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/عبد\s+/g, 'عبد')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// Multi-word circle phrases safe to detect anywhere in text without colliding with student/father names (e.g., عمر، سعد، عثمان)
const SAFE_CIRCLE_PHRASES: Array<{ phrase: string; norm: string; circleId: string }> = (() => {
  const entries: Array<{ phrase: string; norm: string; circleId: string }> = [];
  const seen = new Set<string>();

  Object.entries(CIRCLE_NAME_TO_ID_MAP).forEach(([key, circleId]) => {
    if (key.startsWith('circle_') || key === 'unassigned') return;
    const words = key.trim().split(/\s+/);
    // Single-word phrases only safe if prefixed with 'حلقة' or at least 2 words
    if (words.length < 2) return;
    const norm = normalizeArabicLoose(key);
    if (!seen.has(norm)) {
      seen.add(norm);
      entries.push({ phrase: key, norm, circleId });
    }
  });

  // Sort longest first so "حلقة عمر بن عبدالعزيز" matches before "عمر بن عبدالعزيز" or "عمر بن الخطاب"
  entries.sort((a, b) => b.norm.length - a.norm.length);
  return entries;
})();

const TEACHER_LIST_SORTED = INITIAL_TEACHERS.map((t) => ({
  id: t.id,
  name: t.name,
  norm: normalizeArabicLoose(t.name),
  circleIds: t.circleIds,
})).sort((a, b) => b.norm.length - a.norm.length);

function buildNormalizedArabicPattern(normalizedTarget: string): string {
  const chars = Array.from(normalizedTarget);
  return chars
    .map((ch, i) => {
      let token: string;
      if (ch === ' ') token = '\\s+';
      else if (ch === 'ا') token = '[اأإآ]';
      else if (ch === 'ه') token = '[هة]';
      else if (ch === 'ي') token = '[يى]';
      else token = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // If this character is 'د' ending 'عبد', allow optional whitespace after it
      if (ch === 'د' && i >= 2 && chars[i - 2] === 'ع' && chars[i - 1] === 'ب') {
        return `${token}\\s*`;
      }
      return `${token}[\\u064B-\\u065F\\u0670]*`;
    })
    .join('');
}

function stripMatchedNormalizedSpan(original: string, normalizedTarget: string): string {
  const body = buildNormalizedArabicPattern(normalizedTarget);
  const pattern = `(?:(?:ال)?حلقه|الحلقة|حلقة)?\\s*:?\\s*${body}`;
  try {
    return original.replace(new RegExp(pattern, 'gi'), ' ');
  } catch {
    return original;
  }
}

export function parseSingleStudentLine(
  rawLine: string,
  circles: Circle[],
  defaultCircleId: string,
  lineNumber = 1
): ParsedStudentEntry {
  const raw = rawLine.trim();
  let working = raw;
  let uid = '';
  let circleId = defaultCircleId;
  let detectedCircle = false;

  // 1. Extract Firebase UID token (must include at least one ASCII letter to avoid phone/national IDs)
  const uidMatch = working.match(FIREBASE_UID_TOKEN_REGEX);
  if (uidMatch && /[a-zA-Z]/.test(uidMatch[1])) {
    uid = uidMatch[1].trim();
    const idx = working.indexOf(uid);
    if (idx !== -1) {
      working = `${working.slice(0, idx)} ${working.slice(idx + uid.length)}`;
    }
  }

  // 2. Check explicit circle_ ID token (e.g. circle_zubair)
  const explicitCircleMatch = working.match(/\b(circle_[a-z0-9_]+)\b/i);
  if (explicitCircleMatch) {
    const foundCircle = circles.find((c) => c.id.toLowerCase() === explicitCircleMatch[1].toLowerCase());
    if (foundCircle) {
      circleId = foundCircle.id;
      detectedCircle = true;
      working = working.replace(explicitCircleMatch[0], ' ');
    }
  }

  // 3. Check explicit "الحلقة: <name>" or "حلقة <name>" or safe multi-word circle phrase
  if (!detectedCircle) {
    const workingNorm = normalizeArabicLoose(working);
    for (const item of SAFE_CIRCLE_PHRASES) {
      if (workingNorm.includes(item.norm)) {
        circleId = item.circleId;
        detectedCircle = true;
        working = stripMatchedNormalizedSpan(working, item.norm);
        break;
      }
    }
  }

  // Also strip explicit "الحلقة:" / "حلقة:" label followed by known single-word circle alias if present
  if (!detectedCircle) {
    const labeledCircleMatch = working.match(/(?:الحلقة|حلقة)\s*:\s*([^\t|،,;]+)/);
    if (labeledCircleMatch) {
      const candidate = normalizeArabicLoose(labeledCircleMatch[1]);
      for (const [key, cid] of Object.entries(CIRCLE_NAME_TO_ID_MAP)) {
        if (normalizeArabicLoose(key) === candidate) {
          circleId = cid;
          detectedCircle = true;
          working = working.replace(labeledCircleMatch[0], ' ');
          break;
        }
      }
    }
  }

  // 4. Strip "المعلم: <teacherName>" or "المعلم <teacherName>" and infer circle if unique
  const workingNormAfterCircle = normalizeArabicLoose(working);
  for (const teacher of TEACHER_LIST_SORTED) {
    const hasTeacherLabel =
      workingNormAfterCircle.includes(`المعلم ${teacher.norm}`) ||
      workingNormAfterCircle.includes(`المعلم: ${teacher.norm}`) ||
      workingNormAfterCircle.includes(`معلم: ${teacher.norm}`) ||
      workingNormAfterCircle.includes(`المعلم:${teacher.norm}`);

    if (hasTeacherLabel) {
      const teacherRegex = new RegExp(
        `(?:ال)?معلم\\s*:?\\s*${buildNormalizedArabicPattern(teacher.norm)}`,
        'gi'
      );
      working = working.replace(teacherRegex, ' ');
      if (!detectedCircle && teacher.circleIds.length === 1) {
        circleId = teacher.circleIds[0];
        detectedCircle = true;
      }
      break;
    }
  }

  // Fallback: strip standalone labels like "المعلم:" or "الحلقة:" if trailing
  working = working
    .replace(/(?:الحلقة|حلقة|المعلم|الاسم|الطالب)\s*:/g, ' ')
    .replace(/[|،,;\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const name = working;

  let isValid = Boolean(name);
  let error: string | undefined;
  if (!name) {
    isValid = false;
    error = 'لم يتم التعرف على اسم الطالب';
  } else if (uid && !isValidStudentIdFormat(uid)) {
    isValid = false;
    error = 'صيغة المعرّف (UID) غير صالحة';
  }

  return {
    lineNumber,
    raw,
    name,
    uid,
    circleId,
    detectedCircle,
    isValid,
    error,
  };
}

/**
 * Question Import Parser and Validator
 * Handles JSON import format for question sets
 */

const VALID_VARIANTS = ['open_ended', 'multiple_choice', 'binary', 'pool_selection'];
const MIN_MC_OPTIONS = 2;
const MAX_MC_OPTIONS = 6;
const BINARY_OPTIONS_COUNT = 2;

/**
 * Parse JSON format question set
 * @param {string} content - Raw JSON string
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
function parseJSON(content) {
  try {
    const data = JSON.parse(content);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: `Invalid JSON: ${err.message}` };
  }
}

/**
 * Validate a parsed question set
 * @param {object} data - Parsed question set data
 * @returns {{ valid: boolean, error?: string }}
 */
function validateQuestionSet(data) {
  // Check top-level structure
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Question set must be an object' };
  }

  if (!data.title || typeof data.title !== 'string') {
    return { valid: false, error: 'Question set must have a title string' };
  }

  if (!Array.isArray(data.chapters) || data.chapters.length === 0) {
    return { valid: false, error: 'Question set must have at least one chapter' };
  }

  // Validate each chapter
  for (let ci = 0; ci < data.chapters.length; ci++) {
    const chapter = data.chapters[ci];
    const chapterPrefix = `Chapter ${ci + 1}`;

    if (!chapter || typeof chapter !== 'object') {
      return { valid: false, error: `${chapterPrefix}: Invalid chapter structure` };
    }

    if (!chapter.title || typeof chapter.title !== 'string') {
      return { valid: false, error: `${chapterPrefix}: Missing or invalid title` };
    }

    if (!Array.isArray(chapter.questions) || chapter.questions.length === 0) {
      return { valid: false, error: `${chapterPrefix} (${chapter.title}): Must have at least one question` };
    }

    // Validate each question
    for (let qi = 0; qi < chapter.questions.length; qi++) {
      const question = chapter.questions[qi];
      const questionPrefix = `${chapterPrefix}, Question ${qi + 1}`;

      if (!question || typeof question !== 'object') {
        return { valid: false, error: `${questionPrefix}: Invalid question structure` };
      }

      if (!question.question || typeof question.question !== 'string') {
        return { valid: false, error: `${questionPrefix}: Missing or invalid question text` };
      }

      // Validate variant
      const variant = question.variant || 'open_ended';
      if (!VALID_VARIANTS.includes(variant)) {
        return { valid: false, error: `${questionPrefix}: Invalid variant "${variant}". Must be one of: ${VALID_VARIANTS.join(', ')}` };
      }

      // Validate options based on variant
      if (variant === 'multiple_choice') {
        if (!Array.isArray(question.options)) {
          return { valid: false, error: `${questionPrefix}: Multiple choice requires an options array` };
        }
        if (question.options.length < MIN_MC_OPTIONS || question.options.length > MAX_MC_OPTIONS) {
          return { valid: false, error: `${questionPrefix}: Multiple choice requires ${MIN_MC_OPTIONS}-${MAX_MC_OPTIONS} options, got ${question.options.length}` };
        }
        // Validate each option is a non-empty string
        for (let oi = 0; oi < question.options.length; oi++) {
          if (typeof question.options[oi] !== 'string' || !question.options[oi].trim()) {
            return { valid: false, error: `${questionPrefix}: Option ${oi + 1} must be a non-empty string` };
          }
        }
      } else if (variant === 'binary') {
        // Binary can have custom options or default to Player 1/Player 2
        if (question.options != null) {
          if (!Array.isArray(question.options) || question.options.length !== BINARY_OPTIONS_COUNT) {
            return { valid: false, error: `${questionPrefix}: Binary requires exactly ${BINARY_OPTIONS_COUNT} options` };
          }
        }
      } else if (variant === 'open_ended') {
        // Open ended should not have options
        if (question.options != null && question.options.length > 0) {
          return { valid: false, error: `${questionPrefix}: Open ended questions should not have options` };
        }
      } else if (variant === 'pool_selection') {
        // Pool selection should not have options
        if (question.options != null && question.options.length > 0) {
          return { valid: false, error: `${questionPrefix}: Pool selection questions should not have options` };
        }
      }

      // Normalize the question object
      question.variant = variant;
      if (question.answerForBoth === undefined) {
        question.answerForBoth = false;
      }
    }
  }

  return { valid: true };
}

/**
 * Count total questions in a question set
 * @param {object} data - Validated question set
 * @returns {number}
 */
function countQuestions(data) {
  return data.chapters.reduce((total, chapter) => total + chapter.questions.length, 0);
}

module.exports = {
  parseJSON,
  validateQuestionSet,
  countQuestions
};

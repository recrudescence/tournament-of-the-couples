const questionImporter = require('../questionImporter');

describe('Question Importer', () => {
  describe('parseJSON', () => {
    it('parses valid JSON', () => {
      const json = JSON.stringify({
        title: 'Test Questions',
        chapters: [{ title: 'Ch1', questions: [{ question: 'Q1', variant: 'open_ended' }] }]
      });
      const result = questionImporter.parseJSON(json);
      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Test Questions');
    });

    it('returns error for invalid JSON', () => {
      const result = questionImporter.parseJSON('not valid json');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });
  });

  describe('validateQuestionSet', () => {
    it('validates well-formed question set', () => {
      const data = {
        title: 'Test',
        chapters: [{
          title: 'Chapter 1',
          questions: [
            { question: 'Q1', variant: 'open_ended' },
            { question: 'Q2', variant: 'multiple_choice', options: ['A', 'B', 'C'] },
            { question: 'Q3', variant: 'binary', options: ['Yes', 'No'] }
          ]
        }]
      };
      const result = questionImporter.validateQuestionSet(data);
      expect(result.valid).toBe(true);
    });

    it('rejects missing title', () => {
      const data = { chapters: [{ title: 'Ch', questions: [{ question: 'Q', variant: 'open_ended' }] }] };
      const result = questionImporter.validateQuestionSet(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('title');
    });

    it('rejects empty chapters', () => {
      const data = { title: 'Test', chapters: [] };
      const result = questionImporter.validateQuestionSet(data);
      expect(result.valid).toBe(false);
    });

    it('rejects invalid variant', () => {
      const data = {
        title: 'Test',
        chapters: [{ title: 'Ch', questions: [{ question: 'Q', variant: 'invalid' }] }]
      };
      const result = questionImporter.validateQuestionSet(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid variant');
    });

    it('rejects multiple_choice with too few options', () => {
      const data = {
        title: 'Test',
        chapters: [{ title: 'Ch', questions: [{ question: 'Q', variant: 'multiple_choice', options: ['A'] }] }]
      };
      const result = questionImporter.validateQuestionSet(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2-6');
    });

    it('rejects multiple_choice with too many options', () => {
      const data = {
        title: 'Test',
        chapters: [{ title: 'Ch', questions: [{ question: 'Q', variant: 'multiple_choice', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }] }]
      };
      const result = questionImporter.validateQuestionSet(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2-6');
    });

    it('accepts multiple_choice with 6 options', () => {
      const data = {
        title: 'Test',
        chapters: [{ title: 'Ch', questions: [{ question: 'Q', variant: 'multiple_choice', options: ['A', 'B', 'C', 'D', 'E', 'F'] }] }]
      };
      const result = questionImporter.validateQuestionSet(data);
      expect(result.valid).toBe(true);
    });

    it('rejects binary with wrong option count', () => {
      const data = {
        title: 'Test',
        chapters: [{ title: 'Ch', questions: [{ question: 'Q', variant: 'binary', options: ['Yes'] }] }]
      };
      const result = questionImporter.validateQuestionSet(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exactly 2');
    });

    it('rejects open_ended with options', () => {
      const data = {
        title: 'Test',
        chapters: [{ title: 'Ch', questions: [{ question: 'Q', variant: 'open_ended', options: ['A'] }] }]
      };
      const result = questionImporter.validateQuestionSet(data);
      expect(result.valid).toBe(false);
    });

    it('accepts pool_selection variant', () => {
      const data = {
        title: 'Test',
        chapters: [{ title: 'Ch', questions: [{ question: 'Q', variant: 'pool_selection' }] }]
      };
      const result = questionImporter.validateQuestionSet(data);
      expect(result.valid).toBe(true);
    });

    it('rejects pool_selection with options', () => {
      const data = {
        title: 'Test',
        chapters: [{ title: 'Ch', questions: [{ question: 'Q', variant: 'pool_selection', options: ['A'] }] }]
      };
      const result = questionImporter.validateQuestionSet(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Pool selection');
    });
  });

  describe('countQuestions', () => {
    it('counts questions across chapters', () => {
      const data = {
        title: 'Test',
        chapters: [
          { title: 'Ch1', questions: [{ question: 'Q1' }, { question: 'Q2' }] },
          { title: 'Ch2', questions: [{ question: 'Q3' }] }
        ]
      };
      expect(questionImporter.countQuestions(data)).toBe(3);
    });
  });
});

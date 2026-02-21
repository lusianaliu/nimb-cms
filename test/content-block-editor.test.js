import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from '../src/core/content/content-service.js';

test('registers built-in block definitions', () => {
  const contentService = new ContentService();
  const blocks = contentService.listRegisteredBlocks();
  const blockTypes = blocks.map((block) => block.type).sort();

  assert.deepEqual(blockTypes, ['button', 'divider', 'heading', 'image', 'list', 'paragraph', 'quote']);
});

test('creates content with structured JSON block body', () => {
  const contentService = new ContentService();
  const result = contentService.createContent({
    type: 'page',
    title: 'Phase 6 Content',
    body: [
      {
        type: 'heading',
        data: { level: 2, text: 'Welcome' }
      },
      {
        type: 'paragraph',
        data: { text: 'Block based content body' }
      },
      {
        type: 'divider',
        data: {}
      }
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(result.content.body.length, 3);
  assert.equal(result.content.revisions[0].state.body.length, 3);
});

test('rejects invalid block schema payload', () => {
  const contentService = new ContentService();
  const result = contentService.createContent({
    type: 'post',
    title: 'Invalid block',
    body: [
      {
        type: 'heading',
        data: { level: 8, text: 'Nope' }
      }
    ]
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /Invalid block body/);
});

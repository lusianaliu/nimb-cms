import { apiClient } from './api-client.js';

const sessionStatus = document.querySelector('#session-status');
const runtimeOutput = document.querySelector('#runtime-output');
const systemOutput = document.querySelector('#system-output');
const adminOutput = document.querySelector('#admin-output');
const actionStatus = document.querySelector('#action-status');
const contentStatus = document.querySelector('#content-status');

const restartButton = document.querySelector('#restart-runtime');
const persistButton = document.querySelector('#persist-state');
const reconcileButton = document.querySelector('#reconcile-goals');

const contentTypeForm = document.querySelector('#content-type-form');
const entryForm = document.querySelector('#entry-form');
const saveEntryButton = document.querySelector('#save-entry');
const resetEntryButton = document.querySelector('#reset-entry');
const entryTitle = document.querySelector('#entry-title');
const entryBody = document.querySelector('#entry-body');
const entriesList = document.querySelector('#entries-list');

const state = {
  contentType: 'article',
  editingEntryId: null
};

const toDeterministicJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const setText = (element, text) => {
  if (element) {
    element.textContent = text;
  }
};

const setContentMessage = (message) => {
  setText(contentStatus, message);
};

const ensureContentType = async (type) => {
  const listResult = await apiClient.getContentTypes();
  if (!listResult.ok) {
    return false;
  }

  const known = listResult.payload?.data?.contentTypes ?? [];
  const exists = known.some((entry) => entry?.name === type);
  if (exists) {
    return true;
  }

  const createResult = await apiClient.createContentType({
    name: type,
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'body', type: 'text', required: true }
    ]
  });

  return createResult.ok;
};

const renderEntries = (entries) => {
  if (!entriesList) {
    return;
  }

  entriesList.innerHTML = '';

  if (entries.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="4">No entries yet.</td>';
    entriesList.appendChild(row);
    return;
  }

  for (const entry of entries) {
    const row = document.createElement('tr');
    const actions = document.createElement('td');

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => loadEntryForEdit(entry.id));

    const publish = document.createElement('button');
    publish.type = 'button';
    publish.textContent = 'Publish';
    publish.addEventListener('click', () => transitionEntry(entry.id, 'publish'));

    const archive = document.createElement('button');
    archive.type = 'button';
    archive.textContent = 'Archive';
    archive.addEventListener('click', () => transitionEntry(entry.id, 'archive'));

    const draft = document.createElement('button');
    draft.type = 'button';
    draft.textContent = 'Revert Draft';
    draft.addEventListener('click', () => transitionEntry(entry.id, 'draft'));

    actions.className = 'row-actions';
    actions.append(edit, publish, archive, draft);

    row.innerHTML = `
      <td>${entry.data?.title ?? ''}</td>
      <td>${entry.state}</td>
      <td>${entry.updatedAt}</td>
    `;
    row.append(actions);
    entriesList.appendChild(row);
  }
};

const refreshEntries = async () => {
  const listResult = await apiClient.listEntries(state.contentType);
  if (!listResult.ok) {
    setContentMessage('Failed to load entries.');
    renderEntries([]);
    return;
  }

  const entries = listResult.payload?.data?.entries ?? [];
  renderEntries(entries);
};

const loadEntryForEdit = async (entryId) => {
  const result = await apiClient.getEntry(state.contentType, entryId);
  if (!result.ok) {
    setContentMessage('Could not load entry for editing.');
    return;
  }

  const entry = result.payload?.data?.entry;
  if (!entry) {
    setContentMessage('Could not load entry for editing.');
    return;
  }

  state.editingEntryId = entry.id;
  if (entryTitle) {
    entryTitle.value = entry.data?.title ?? '';
  }
  if (entryBody) {
    entryBody.value = entry.data?.body ?? '';
  }
  setContentMessage(`Editing ${entry.id}`);
};

const transitionEntry = async (entryId, transition) => {
  const result = transition === 'publish'
    ? await apiClient.publishEntry(state.contentType, entryId)
    : transition === 'archive'
      ? await apiClient.archiveEntry(state.contentType, entryId)
      : await apiClient.draftEntry(state.contentType, entryId);

  if (!result.ok) {
    setContentMessage(`Failed to ${transition} entry.`);
    return;
  }

  setContentMessage(`Entry ${transition} successful.`);
  await refreshEntries();
};

const resetEditor = () => {
  state.editingEntryId = null;
  if (entryForm instanceof HTMLFormElement) {
    entryForm.reset();
  }
  setContentMessage('Ready to create a new entry.');
};

const saveEntryAsDraft = async () => {
  if (!state.editingEntryId) {
    setContentMessage('Select an entry to edit first.');
    return;
  }

  const title = entryTitle?.value ?? '';
  const body = entryBody?.value ?? '';

  const createResult = await apiClient.createEntry(state.contentType, { title, body });
  if (!createResult.ok) {
    setContentMessage('Failed to save draft changes.');
    return;
  }

  const createdId = createResult.payload?.data?.entry?.id;
  await apiClient.archiveEntry(state.contentType, state.editingEntryId);
  if (createdId) {
    await apiClient.draftEntry(state.contentType, createdId);
  }

  state.editingEntryId = createdId ?? null;
  setContentMessage('Draft changes saved as a new deterministic revision entry.');
  await refreshEntries();
};

const refreshDashboard = async () => {
  const [systemResult, runtimeResult, adminResult] = await Promise.all([
    apiClient.getSystem(),
    apiClient.getRuntime(),
    apiClient.getAdminStatus()
  ]);

  if (!adminResult.ok) {
    setText(sessionStatus, 'Auth status: unauthorized');
    setText(adminOutput, toDeterministicJson(adminResult.payload));
    return;
  }

  setText(sessionStatus, 'Auth status: authenticated');
  setText(systemOutput, toDeterministicJson(systemResult.payload));
  setText(runtimeOutput, toDeterministicJson(runtimeResult.payload));
  setText(adminOutput, toDeterministicJson(adminResult.payload));
};

const runAction = async (action, label) => {
  const result = await action();
  setText(actionStatus, `${label}: ${result.status}`);
  await refreshDashboard();
};

restartButton?.addEventListener('click', () => runAction(() => apiClient.restartRuntime(), 'Restart Runtime'));
persistButton?.addEventListener('click', () => runAction(() => apiClient.persistState(), 'Persist State'));
reconcileButton?.addEventListener('click', () => runAction(() => apiClient.reconcileGoals(), 'Reconcile Goals'));

contentTypeForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(contentTypeForm);
  const type = `${formData.get('contentType') ?? ''}`.trim();

  if (!type) {
    setContentMessage('Content type is required.');
    return;
  }

  state.contentType = type;
  const ensured = await ensureContentType(type);
  if (!ensured) {
    setContentMessage('Could not prepare content type.');
    return;
  }

  setContentMessage(`Using content type: ${type}`);
  await refreshEntries();
});

entryForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(entryForm);
  const title = `${formData.get('title') ?? ''}`;
  const body = `${formData.get('body') ?? ''}`;

  const result = await apiClient.createEntry(state.contentType, { title, body });
  if (!result.ok) {
    setContentMessage('Failed to create entry.');
    return;
  }

  state.editingEntryId = result.payload?.data?.entry?.id ?? null;
  setContentMessage('Entry created as draft.');
  await refreshEntries();
});

saveEntryButton?.addEventListener('click', saveEntryAsDraft);
resetEntryButton?.addEventListener('click', resetEditor);

window.addEventListener('nimb:auth-ready', async () => {
  await refreshDashboard();
  await ensureContentType(state.contentType);
  await refreshEntries();
  resetEditor();
});

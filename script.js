// ===== 定数 =====

// リストは3つ固定のため、プログラムの中に直接書く（保存しない）
const LISTS = [
  { id: 'todo', name: '未着手' },
  { id: 'doing', name: '作業中' },
  { id: 'done', name: '完了' },
];

const PRIORITY_LABELS = { high: '高', medium: '中', low: '低' };
// 優先度の低い順。時間厳守のときは、この並びで1段階上げる
const PRIORITY_LEVELS = ['low', 'medium', 'high'];
// 期限の日付が「今日から何日後まで」なら中にするか（当日以前は高）
const MEDIUM_PRIORITY_DAYS = 7;

const STORAGE_KEY = 'taskmanagement.cards';
const TITLE_MAX_LENGTH = 50;
const CHECK_INTERVAL_MS = 30 * 1000;

// ===== データ =====

// カードの配列。リスト内の表示順は、この配列の順番で表す
let cards = [];

// 編集ウィンドウで扱っているカード（追加のときは null）
let editingCardId = null;
// 追加のときに、カードを入れるリスト
let addingListId = null;
// ドラッグ直後のクリックで編集ウィンドウが開かないようにする
let isDragging = false;

function loadCards() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    return null;
  }
  try {
    // 優先度は自動で決めるため、以前の保存データにある priority は読み捨てる
    return JSON.parse(saved).map(({ priority, ...card }) => ({ strict: false, ...card }));
  } catch {
    return [];
  }
}

function saveCards() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

function createId() {
  return Date.now().toString() + Math.random().toString(36).slice(2, 6);
}

// ===== 期限の判定と表示 =====

function isOverdue(card) {
  return card.dueDate !== '' && card.listId !== 'done' && new Date(card.dueDate) <= new Date();
}

function shouldNotify(card) {
  return isOverdue(card) && !card.notified;
}

// 期限の日付が今日から何日後か（今日は0、過ぎていればマイナス）
function daysUntilDue(dueDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / (24 * 60 * 60 * 1000));
}

// 期限と時間厳守から優先度を決める
function getPriority(card) {
  let level = 0;
  if (card.dueDate !== '') {
    const days = daysUntilDue(card.dueDate);
    if (days <= 0) {
      level = 2;
    } else if (days <= MEDIUM_PRIORITY_DAYS) {
      level = 1;
    }
  }
  if (card.strict) {
    level = Math.min(level + 1, PRIORITY_LEVELS.length - 1);
  }
  return PRIORITY_LEVELS[level];
}

// 「9/30 20:00」の形にする
function formatDue(dueDate) {
  const d = new Date(dueDate);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

// ===== SC-01 ボード画面 =====

function render() {
  const showOverdueText = getProtoSettings().overdueText === 'show';

  LISTS.forEach((list) => {
    const section = document.querySelector(`.list[data-list-id="${list.id}"]`);
    const area = section.querySelector('.card-area');
    const listCards = cards.filter((card) => card.listId === list.id);

    section.querySelector('.list-count').textContent = listCards.length;
    area.innerHTML = '';

    listCards.forEach((card) => {
      area.appendChild(createCardElement(card, showOverdueText));
    });
  });
}

function createCardElement(card, showOverdueText) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.id = card.id;

  const line1 = document.createElement('div');
  line1.className = 'card-line1';

  const check = createCheckbox(card);

  const priority = document.createElement('span');
  setPriorityLabel(priority, getPriority(card));

  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = card.title;

  line1.append(check, priority, title);
  el.appendChild(line1);

  if (card.dueDate !== '') {
    const due = document.createElement('div');
    due.className = 'card-due';
    due.textContent = formatDue(card.dueDate);

    if (isOverdue(card)) {
      el.classList.add('overdue');
      if (showOverdueText) {
        const badge = document.createElement('span');
        badge.className = 'overdue-badge';
        badge.textContent = '期限切れ';
        due.appendChild(badge);
      }
    }
    el.appendChild(due);
  }

  el.addEventListener('click', () => {
    if (!isDragging) {
      openEditDialog(card.id);
    }
  });

  return el;
}

// チェックを付けると次のリストへ、完了でチェックを外すと作業中へ戻す
const CHECK_MOVES = {
  todo: { to: 'doing', label: '作業中にする' },
  doing: { to: 'done', label: '完了にする' },
  done: { to: 'doing', label: '作業中に戻す' },
};

function createCheckbox(card) {
  const move = CHECK_MOVES[card.listId];
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'card-check';
  check.checked = card.listId === 'done';
  check.title = move.label;
  check.setAttribute('aria-label', move.label);

  // チェックの操作で編集ウィンドウが開かないようにする
  check.addEventListener('click', (event) => event.stopPropagation());
  check.addEventListener('change', () => moveCard(card.id, move.to));
  return check;
}

// カードを別のリストの一番下へ移す
function moveCard(cardId, listId) {
  const card = cards.find((c) => c.id === cardId);
  cards = cards.filter((c) => c.id !== cardId);
  card.listId = listId;
  cards.push(card);
  saveCards();
  render();
}

function setPriorityLabel(el, priority) {
  el.className = `priority priority-${priority}`;
  el.textContent = PRIORITY_LABELS[priority];
}

// ===== SC-02 カード編集ウィンドウ =====

const editDialog = document.getElementById('edit-dialog');
const editForm = document.getElementById('edit-form');
const editHeading = document.getElementById('edit-heading');
const inputTitle = document.getElementById('input-title');
const inputDescription = document.getElementById('input-description');
const inputDue = document.getElementById('input-due');
const inputStrict = document.getElementById('input-strict');
const priorityPreview = document.getElementById('priority-preview');
const titleError = document.getElementById('title-error');
const deleteButton = document.getElementById('delete-button');

function openAddDialog(listId) {
  editingCardId = null;
  addingListId = listId;

  editHeading.textContent = 'タスクの追加';
  inputTitle.value = '';
  inputDescription.value = '';
  inputDue.value = '';
  inputStrict.checked = false;
  deleteButton.hidden = true;

  showEditDialog();
}

function openEditDialog(cardId) {
  const card = cards.find((c) => c.id === cardId);
  editingCardId = cardId;
  addingListId = null;

  editHeading.textContent = 'タスクの編集';
  inputTitle.value = card.title;
  inputDescription.value = card.description;
  inputDue.value = card.dueDate;
  inputStrict.checked = card.strict;
  deleteButton.hidden = false;

  showEditDialog();
}

function showEditDialog() {
  clearTitleError();
  updatePriorityPreview();
  editDialog.showModal();
  inputTitle.focus();
}

// 入力中の期限と時間厳守から、決まる優先度を表示する
function updatePriorityPreview() {
  setPriorityLabel(priorityPreview, getPriority({ dueDate: inputDue.value, strict: inputStrict.checked }));
}

inputDue.addEventListener('input', updatePriorityPreview);
inputStrict.addEventListener('change', updatePriorityPreview);

function validateTitle(title) {
  if (title.trim() === '') {
    return 'タイトルを入力してください';
  }
  if (title.length > TITLE_MAX_LENGTH) {
    return `タイトルは${TITLE_MAX_LENGTH}文字以内で入力してください`;
  }
  return '';
}

function showTitleError(message) {
  titleError.textContent = message;
  inputTitle.classList.add('input-error');
}

function clearTitleError() {
  titleError.textContent = '';
  inputTitle.classList.remove('input-error');
}

function saveFromDialog() {
  const title = inputTitle.value;
  const error = validateTitle(title);
  if (error !== '') {
    showTitleError(error);
    inputTitle.focus();
    return;
  }

  const values = {
    title: title.trim(),
    description: inputDescription.value,
    dueDate: inputDue.value,
    strict: inputStrict.checked,
  };

  if (editingCardId === null) {
    // 追加したカードは、そのリストの一番下に入る
    cards.push({ id: createId(), ...values, listId: addingListId, notified: false });
  } else {
    const card = cards.find((c) => c.id === editingCardId);
    // 期限を変更した場合は、もう一度通知する
    if (card.dueDate !== values.dueDate) {
      card.notified = false;
    }
    Object.assign(card, values);
  }

  saveCards();
  editDialog.close();
  render();
}

editForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveFromDialog();
});

document.getElementById('cancel-button').addEventListener('click', () => {
  editDialog.close();
});

document.querySelectorAll('.list').forEach((section) => {
  section.querySelector('.add-button').addEventListener('click', () => {
    openAddDialog(section.dataset.listId);
  });
});

// ===== SC-03 削除確認ダイアログ =====

const confirmDialog = document.getElementById('confirm-dialog');

function deleteEditingCard() {
  cards = cards.filter((c) => c.id !== editingCardId);
  saveCards();
  editDialog.close();
  render();
}

deleteButton.addEventListener('click', () => {
  if (getProtoSettings().deleteDialog === 'browser') {
    // ブラウザ標準の確認。キャンセルなら編集ウィンドウに戻る
    if (confirm('このタスクを削除しますか？')) {
      deleteEditingCard();
    }
  } else {
    // アプリ独自の確認。編集ウィンドウの上に重ねて表示する
    confirmDialog.showModal();
  }
});

document.getElementById('confirm-ok').addEventListener('click', () => {
  confirmDialog.close();
  deleteEditingCard();
});

document.getElementById('confirm-cancel').addEventListener('click', () => {
  confirmDialog.close();
});

// ===== カードの移動・並び替え（SortableJS） =====

// 画面の並びをもとに、カードの配列と所属リストを作り直す
function syncCardsFromBoard() {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const newCards = [];

  LISTS.forEach((list) => {
    const area = document.querySelector(`.list[data-list-id="${list.id}"] .card-area`);
    area.querySelectorAll('.card').forEach((el) => {
      const card = cardById.get(el.dataset.id);
      card.listId = list.id;
      newCards.push(card);
    });
  });

  cards = newCards;
}

document.querySelectorAll('.card-area').forEach((area) => {
  new Sortable(area, {
    group: 'board',
    animation: 150,
    ghostClass: 'card-ghost',
    onStart() {
      isDragging = true;
    },
    onEnd() {
      syncCardsFromBoard();
      saveCards();
      render();
      // ドロップ直後に発生するクリックを無視してから、元に戻す
      setTimeout(() => {
        isDragging = false;
      }, 0);
    },
  });
});

// ===== リマインド通知 =====

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function checkReminders() {
  const canNotify = 'Notification' in window && Notification.permission === 'granted';
  let changed = false;

  cards.forEach((card) => {
    if (canNotify && shouldNotify(card)) {
      const notification = new Notification('タスクの期限です', { body: card.title });
      notification.addEventListener('click', () => {
        window.focus();
        notification.close();
      });
      card.notified = true;
      changed = true;
    }
  });

  if (changed) {
    saveCards();
  }
  // 時間の経過で期限切れになったカードを赤くする
  render();
}

// ===== プロトタイプ用：比較パネルとサンプルデータ（本番では削除する） =====

const PROTO_SETTINGS_KEY = 'taskmanagement.protoSettings';
const protoOverdueText = document.getElementById('proto-overdue-text');
const protoDeleteDialog = document.getElementById('proto-delete-dialog');

function getProtoSettings() {
  return {
    overdueText: protoOverdueText.value,
    deleteDialog: protoDeleteDialog.value,
  };
}

function loadProtoSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROTO_SETTINGS_KEY));
    if (saved) {
      protoOverdueText.value = saved.overdueText;
      protoDeleteDialog.value = saved.deleteDialog;
    }
  } catch {
    // 読み込めないときは初期値のまま
  }
}

function saveProtoSettings() {
  localStorage.setItem(PROTO_SETTINGS_KEY, JSON.stringify(getProtoSettings()));
}

// 今の日時からずらした「YYYY-MM-DDTHH:mm」を作る
function relativeDate(days, hour) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function createSampleCards() {
  return [
    // 期限切れ → 高
    { title: '課題A を提出する', description: 'スクールの課題。提出フォームから送る', dueDate: relativeDate(-1, 20), strict: false, listId: 'todo' },
    // 1週間以内 → 中
    { title: '歯医者の予約を取る', description: '', dueDate: relativeDate(5, 12), strict: false, listId: 'todo' },
    // 1週間より先だが時間厳守 → 低から1段階上げて中
    { title: '資格試験に申し込む', description: '締め切りを過ぎると受けられない', dueDate: relativeDate(14, 23), strict: true, listId: 'todo' },
    // 期限なし → 低
    { title: '英単語を50個覚える', description: '', dueDate: '', strict: false, listId: 'todo' },
    // 1週間以内で時間厳守 → 中から1段階上げて高
    { title: '会議の資料を作る', description: '先週の進捗をまとめる', dueDate: relativeDate(2, 18), strict: true, listId: 'doing' },
    { title: '図書館に本を返す', description: '', dueDate: relativeDate(-3, 17), strict: false, listId: 'done' },
  ].map((card, i) => ({ id: `sample${i + 1}`, ...card, notified: false }));
}

protoOverdueText.addEventListener('change', () => {
  saveProtoSettings();
  render();
});

protoDeleteDialog.addEventListener('change', saveProtoSettings);

document.getElementById('proto-reset').addEventListener('click', () => {
  if (confirm('サンプルデータに戻しますか？今のタスクはすべて消えます。')) {
    cards = createSampleCards();
    saveCards();
    render();
  }
});

// ===== 起動 =====

loadProtoSettings();
// 保存データがない初回は、プロトタイプ用のサンプルデータを入れる
cards = loadCards() ?? createSampleCards();
saveCards();
render();
requestNotificationPermission();
checkReminders();
setInterval(checkReminders, CHECK_INTERVAL_MS);

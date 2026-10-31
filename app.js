function bindDeckActions(wrapper, flash) {
  wrapper.onclick = function(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const topCard = wrapper.querySelector('.top-card');
    if (!topCard || !topCard.contains(target)) return;

    const button = target.closest('button');

    if (button && topCard.contains(button)) {
      event.stopPropagation();
      if (button.disabled) return;

      const id = button.dataset.id;

      if (button.classList.contains('star-btn')) {
        toggleStar(id, flash ? 'flashcard' : 'quote');
      } else if (
        button.classList.contains(
          flash ? 'edit-flashcard-btn' : 'edit-card-btn'
        )
      ) {
        if (flash) openEditFlashcard(id);
        else openEditCard(id);
      } else if (
        button.classList.contains(
          flash ? 'delete-flashcard-btn' : 'delete-card-btn'
        )
      ) {
        if (flash) deleteFlashcardById(id);
        else deleteCardById(id);
      }

      return;
    }

    if (flash) flipCurrentCard();
  };
}


function getDeckOrder(category, previous) {
  const eligible = category.cards
    .map((_, index) => index)
    .filter(index =>
      !showStarredOnly || category.cards[index].starred
    );

  const allowed = new Set(eligible);

  const order = [
    ...new Set(previous.filter(index => allowed.has(index)))
  ];

  eligible.forEach(index => {
    if (!order.includes(index)) order.push(index);
  });

  return order;
}


// CONSOLIDATED AL-IN-BUM

// Source: app-dialogs.js
(() => {
  'use strict';

  const style = document.createElement('style');

  style.textContent = `
    dialog.app-dialog {
      position: fixed !important;
      inset: 0 !important;
      margin: auto !important;
      transform: none !important;

      width: min(420px, calc(100vw - 32px));
      height: fit-content;
      max-height: calc(100dvh - 32px);
      overflow: auto;
      box-sizing: border-box;

      border: 1px solid #dedbd2;
      border-radius: 22px;
      padding: 26px;
      background: #fffdf8;
      color: #253c32;
      box-shadow: 0 24px 80px #0003;
      font-family: inherit;
    }

    dialog.app-dialog::backdrop {
      background: #17282066;
      backdrop-filter: blur(4px);
    }

    .app-dialog h2 {
      margin: 0 0 12px;
      font-size: 21px;
      line-height: 1.5;
    }

    .app-dialog p {
      margin: 0;
      line-height: 1.8;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    .app-dialog-actions {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 24px;
    }

    .app-dialog button {
      font: inherit;
      border-radius: 12px;
      padding: 10px 18px;
      cursor: pointer;
      border: 1px solid #dedbd2;
      background: #f4f1e9;
      color: #253c32;
    }

    .app-dialog .dialog-confirm {
      background: #294b3d;
      color: white;
      border-color: #294b3d;
    }

    .app-dialog .dialog-delete {
      background: #a43b35;
      border-color: #a43b35;
    }

    .app-dialog button:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 3px;
    }

    @media (max-width: 480px) {
      dialog.app-dialog {
        padding: 22px;
        border-radius: 18px;
      }
    }
  `;

  document.head.append(style);

  let queue = Promise.resolve();

  function openDialog(message, confirmation) {
    const result = queue.then(() => new Promise(resolve => {
      const previousFocus = document.activeElement;

      const dialog = document.createElement('dialog');
      dialog.className = 'app-dialog';

      const title = document.createElement('h2');
      title.id = 'app-dialog-title';
      title.textContent = confirmation
        ? 'Please confirm'
        : 'Notice';

      const text = document.createElement('p');
      text.id = 'app-dialog-message';
      text.textContent = String(message);

      dialog.setAttribute('aria-labelledby', title.id);
      dialog.setAttribute('aria-describedby', text.id);

      const actions = document.createElement('div');
      actions.className = 'app-dialog-actions';

      let finished = false;

      function finish(value) {
        if (finished) return;
        finished = true;

        dialog.close();
        dialog.remove();

        if (previousFocus?.isConnected) {
          previousFocus.focus({ preventScroll: true });
        }

        resolve(value);
      }

      if (confirmation) {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Cancel';
        cancel.autofocus = true;
        cancel.onclick = () => finish(false);

        actions.append(cancel);
      }

      const accept = document.createElement('button');
      accept.type = 'button';

      const deleting =
        confirmation && /delete/i.test(String(message));

      accept.textContent = confirmation
        ? deleting
          ? 'Delete'
          : 'Confirm'
        : 'OK';

      accept.className =
        'dialog-confirm' +
        (deleting ? ' dialog-delete' : '');

      accept.autofocus = !confirmation;
      accept.onclick = () => finish(true);

      actions.append(accept);
      dialog.append(title, text, actions);

      dialog.addEventListener('cancel', event => {
        event.preventDefault();
        finish(false);
      });

      document.body.append(dialog);
      dialog.showModal();
    }));

    queue = result.catch(() => {});
    return result;
  }

  window.appConfirm = message => openDialog(message, true);

  window.alert = message => {
    void openDialog(message, false);
  };
})();
;

// Source: app.js
const API_URL = 'http://localhost:3000/api';

let categories = [];
let selectedCategoryId = null;
let currentCardIdx = 0;
let currentOrder = [];

// Flashcard variables
let flashcardCategory = null;
let currentFlashcardIdx = 0;
let flashcardOrder = [];
let isFlipped = false;
let isAutoPlaying = false;
let isLoopEnabled = false;
let autoPlayStage = 'front';

// Quote Card Auto-Play variables
let isQuoteAutoPlaying = false;
let isQuoteLoopEnabled = false;

// Star filter mode
let showStarredOnly = false;

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function showToast(msg) {
  var t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<i class="fas fa-check-circle"></i> ' + msg;
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 2500);
}

function hideModal(id) {
  var modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
}

function showModal(id) {
  var modal = document.getElementById(id);
  if (modal) modal.style.display = 'flex';
}

function migrateCategories() {
  var changed = false;
  for (var i = 0; i < categories.length; i++) {
    if (!categories[i].fontSize) {
      categories[i].fontSize = 20;
      changed = true;
    }
    for (var j = 0; j < categories[i].cards.length; j++) {
      if (categories[i].cards[j].starred === undefined) {
        categories[i].cards[j].starred = false;
        changed = true;
      }
    }
  }
  if (changed) {
    saveCategories();
  }
}

async function loadCategories() {
  try {
    var response = await fetch(API_URL + '/categories');
    if (response.ok) {
      categories = await response.json();
      migrateCategories();
      renderAllUI();
    } else {
      throw new Error('Failed to load');
    }
  } catch (error) {
    console.error('Error loading categories:', error);
    showToast('Cannot connect to server');
  }
}

let saveCategories;

function shuffleArray(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

function toggleStar(cardId, type) {
  // Search only the album currently being viewed.
  const category = categories.find(
    item => item.id === selectedCategoryId
  );

  if (!category) return;

  const card = category.cards.find(
    item => String(item.id) === String(cardId)
  );

  if (!card) return;

  card.starred = !card.starred;

  // Return to all cards when the last starred card is unstarred.
  if (
    showStarredOnly &&
    !category.cards.some(item => item.starred)
  ) {
    showStarredOnly = false;
  }

  updateStarFilterButtons();

  if (type === 'flashcard') {
    flashcardCategory = category;
    renderFlashcardStack();
  } else {
    renderStackedDeck();
  }

  saveCategories();

  showToast(
    card.starred
      ? '★ Starred card'
      : '☆ Unstarred card'
  );
}

function updateStarFilterButtons() {
  const category = categories.find(
    item => item.id === selectedCategoryId
  );

  const count = category?.cards.filter(
    card => card.starred
  ).length || 0;

  if (count === 0) {
    showStarredOnly = false;
  }

  ['starFilterBtn', 'starFilterBtnFlash'].forEach(id => {
    const button = document.getElementById(id);
    if (!button) return;

    button.hidden = count === 0;
    button.style.display = count > 0
      ? 'inline-flex'
      : 'none';

    button.disabled = count === 0;

    button.textContent = showStarredOnly
      ? 'View All Cards'
      : '★ View Starred (' + count + ')';

    button.setAttribute(
      'aria-pressed',
      String(showStarredOnly)
    );

    button.style.background = showStarredOnly
      ? '#FFD966'
      : '';

    button.style.color = showStarredOnly
      ? '#253c32'
      : '';
  });
}

function toggleShowStarred() {
  const category = categories.find(
    item => item.id === selectedCategoryId
  );

  if (!category) return;

  const flash = category.type === 'flashcard';

  if (
    !showStarredOnly &&
    !category.cards.some(card => card.starred)
  ) {
    showToast('No starred cards in this album');
    updateStarFilterButtons();
    return;
  }

  showStarredOnly = !showStarredOnly;

  const previous = flash
    ? flashcardOrder
    : currentOrder;

  const eligible = category.cards
    .map((_, index) => index)
    .filter(index =>
      !showStarredOnly || category.cards[index].starred
    );

  const allowed = new Set(eligible);

  const order = [
    ...new Set(
      previous.filter(index => allowed.has(index))
    )
  ];

  eligible.forEach(index => {
    if (!order.includes(index)) {
      order.push(index);
    }
  });

  if (flash) {
    flashcardCategory = category;
    flashcardOrder = order;
    currentFlashcardIdx = 0;
    isFlipped = false;
    autoPlayStage = 'front';

    renderFlashcardStack();
  } else {
    currentOrder = order;
    currentCardIdx = 0;

    renderStackedDeck();
  }

  updateStarFilterButtons();

  showToast(
    showStarredOnly
      ? 'Showing starred cards only'
      : 'Showing all cards'
  );
}

function updateLivePreview() {
  var name = document.getElementById('catName').value.trim();
  if (name === "") name = "Album Name";
  var color = document.getElementById('themeColor').value;
  var fontColor = document.getElementById('fontColor').value;
  var fontSelect = document.getElementById('categoryFont');
  var font = fontSelect ? fontSelect.value : 'Inter, sans-serif';
  var fontSizeSlider = document.getElementById('fontSize');
  var fontSize = fontSizeSlider ? fontSizeSlider.value + 'px' : '20px';
  
  var previewFolder = document.getElementById('previewFolder');
  var previewFolderName = document.getElementById('previewFolderName');
  
  if (previewFolder) {
    previewFolder.style.background = 'linear-gradient(135deg, ' + color + 'dd, ' + color + '99)';
  }
  if (previewFolderName) {
    previewFolderName.style.fontFamily = font;
    previewFolderName.style.color = fontColor;
    previewFolderName.innerText = name;
  }
  
  var previewQuoteCard = document.getElementById('previewQuoteCard');
  var previewQuoteText = document.getElementById('previewQuoteText');
  
  if (previewQuoteCard) {
    previewQuoteCard.style.backgroundColor = color;
    previewQuoteCard.style.color = fontColor;
  }
  if (previewQuoteText) {
    previewQuoteText.style.fontFamily = font;
    previewQuoteText.style.color = fontColor;
    previewQuoteText.style.fontSize = fontSize;
  }
  
  var fontSizeValue = document.getElementById('fontSizeValue');
  if (fontSizeValue && fontSizeSlider) {
    fontSizeValue.innerText = fontSizeSlider.value + 'px';
  }
}

let getCardInner;

let getFlashcardInner;

function renderAlbums() {
  var container = document.getElementById('categoriesContainer');
  if (!container) return;
  
  if (categories.length === 0) {
    container.innerHTML = '<div class="empty-message"><i class="fas fa-folder-open"></i> No albums — click "New Album"</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    var typeIcon = cat.type === 'flashcard' ? '<i class="fas fa-layer-group"></i>' : '<i class="fas fa-quote-left"></i>';
    var bgStyle = 'background: linear-gradient(135deg, ' + cat.themeColor + 'dd, ' + cat.themeColor + '99);';
    html += '<div class="album-folder" data-id="' + cat.id + '">' +
      '<div class="folder-preview" style="' + bgStyle + '">' +
        '<div class="folder-name-large" style="font-family: ' + (cat.font || 'Inter, sans-serif') + '; color: ' + (cat.fontColor || '#FFFFFF') + ';">' + escapeHtml(cat.name) + '</div>' +
        '<div class="folder-quote-count">' + typeIcon + ' ' + cat.cards.length + ' cards</div>' +
      '</div>' +
      '<div class="folder-info">' +
        '<div class="folder-actions">' +
          '<button class="folder-action-btn edit-btn" data-id="' + cat.id + '" data-name="' + escapeHtml(cat.name) + '" data-color="' + cat.themeColor + '" data-font="' + (cat.font || 'Inter, sans-serif') + '" data-fontcolor="' + (cat.fontColor || '#FFFFFF') + '" data-type="' + (cat.type || 'quote') + '"><i class="fas fa-edit"></i> Edit</button>' +
          '<button class="folder-action-btn delete-btn" data-id="' + cat.id + '"><i class="fas fa-trash"></i> Delete</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  container.innerHTML = html;

  var folders = document.querySelectorAll('.album-folder');
  for (var j = 0; j < folders.length; j++) {
    var folder = folders[j];
    folder.addEventListener('click', function(e) {
      if (!e.target.classList.contains('edit-btn') && !e.target.classList.contains('delete-btn')) {
        selectCategory(this.dataset.id);
      }
    });
  }

  var editBtns = document.querySelectorAll('.edit-btn');
  for (var k = 0; k < editBtns.length; k++) {
    var btn = editBtns[k];
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      openEditCategory(this.dataset.id, this.dataset.name, this.dataset.color, this.dataset.font, this.dataset.fontcolor, this.dataset.type);
    });
  }

  var deleteBtns = document.querySelectorAll('.delete-btn');
  for (var m = 0; m < deleteBtns.length; m++) {
    var delBtn = deleteBtns[m];
    delBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteCategoryById(this.dataset.id);
    });
  }
}

function selectCategory(id) {
  selectedCategoryId = id;
  var category = null;
  for (var i = 0; i < categories.length; i++) {
    if (categories[i].id === id) {
      category = categories[i];
      break;
    }
  }
  
  showStarredOnly = false;
  
  if (category.type === 'flashcard') {
    openFlashcardView(category);
  } else {
    openQuoteCardView(category);
  }
  
  // Update star filter buttons after view is rendered
  setTimeout(function() {
    updateStarFilterButtons();
  }, 100);
}

function openQuoteCardView(category) {
  stopQuoteAutoPlay();
  
  document.getElementById('albumsView').style.display = 'none';
  document.getElementById('albumDetailView').style.display = 'block';
  document.getElementById('flashcardView').style.display = 'none';
  document.getElementById('currentCategoryTitle').innerHTML = escapeHtml(category.name);
  document.getElementById('albumTypeBadge').innerHTML = '<i class="fas fa-quote-left"></i> Quote Cards';
  
  document.getElementById('quoteAutoPlaySettings').style.display = 'none';
  document.getElementById('quoteAutoPlayActiveControls').style.display = 'none';
  document.getElementById('quoteCardActions').style.display = 'flex';
  isQuoteAutoPlaying = false;
  isQuoteLoopEnabled = false;
  var loopBtn = document.getElementById('quoteLoopToggleBtn');
  if (loopBtn) {
    loopBtn.style.background = '';
    loopBtn.style.color = '';
  }
  
  if (category.cards.length > 0) {
    var indices = [];
    for (var j = 0; j < category.cards.length; j++) {
      indices.push(j);
    }
    currentOrder = shuffleArray(indices);
  } else {
    currentOrder = [];
  }
  currentCardIdx = 0;
  renderStackedDeck();
}

function openFlashcardView(category) {
  flashcardCategory = category;
  document.getElementById('albumsView').style.display = 'none';
  document.getElementById('albumDetailView').style.display = 'none';
  document.getElementById('flashcardView').style.display = 'block';
  document.getElementById('flashcardTitle').innerHTML = escapeHtml(category.name);
  
  flashcardOrder = [];
  for (var i = 0; i < category.cards.length; i++) {
    flashcardOrder.push(i);
  }
  currentFlashcardIdx = 0;
  isFlipped = false;
  autoPlayStage = 'front';
  stopAutoPlay();
  document.getElementById('autoPlaySettings').style.display = 'none';
  document.getElementById('autoPlayActiveControls').style.display = 'none';
  document.getElementById('flashcardControls').style.display = 'flex';
  document.getElementById('cardActionsGroup').style.display = 'flex';
  renderFlashcardStack();
}

function renderFlashcardStackSilent() {
  renderFlashcardStackInternal(true);
}

function renderStackedDeckSilent() {
  renderStackedDeckInternal(true);
}

function renderFlashcardStack() {
  renderFlashcardStackInternal(false);
}

function renderFlashcardStackInternal(silent) {
  const wrapper = document.getElementById(
    'flashcardStackWrapper'
  );
  const counter = document.getElementById('flashcardCounter');

  if (!wrapper || !counter) return;

  bindDeckActions(wrapper, true);

  if (!flashcardCategory) {
    wrapper.innerHTML = '';
    counter.innerText = '0 / 0';
    return;
  }

  flashcardOrder = getDeckOrder(
    flashcardCategory,
    flashcardOrder
  );

  const total = flashcardOrder.length;

  if (!total) {
    wrapper.innerHTML =
      '<div class="flashcard-stack-card top-card">' +
      '<div class="flashcard-inner">' +
      '<div class="flashcard-front study-face">' +
      (showStarredOnly
        ? 'No starred cards in this album.'
        : 'No cards yet. Add your first flashcard!') +
      '</div></div></div>';

    counter.innerText = '0 / 0';
    return;
  }

  currentFlashcardIdx = Math.max(
    0,
    Math.min(currentFlashcardIdx, total - 1)
  );

  const current = currentFlashcardIdx;

  const face = (index, flipped) =>
    getFlashcardInner(
      flashcardCategory.cards[flashcardOrder[index]],
      index + 1,
      total,
      flashcardCategory,
      flipped
    );

  let html = '';

  if (current > 0) {
    html +=
      '<div class="flashcard-stack-card prev-card">' +
      face(current - 1, false) +
      '</div>';
  }

  if (current + 1 < total) {
    html +=
      '<div class="flashcard-stack-card next-card">' +
      face(current + 1, false) +
      '</div>';
  }

  html +=
    '<div class="flashcard-stack-card top-card">' +
    face(current, isFlipped) +
    '</div>';

  wrapper.innerHTML = html;

  if (silent) {
    wrapper.querySelectorAll('.flashcard-stack-card')
      .forEach(card => {
        card.style.animation = 'none';
      });
  }

  counter.innerText = (current + 1) + ' / ' + total;
}


function renderStackedDeck() {
  renderStackedDeckInternal(false);
}

function renderStackedDeckInternal(silent) {
  const wrapper = document.getElementById('stackWrapper');
  const counter = document.getElementById('cardCounter');

  if (!wrapper || !counter) return;

  bindDeckActions(wrapper, false);

  const category = categories.find(
    item => item.id === selectedCategoryId
  );

  if (!category) {
    wrapper.innerHTML = '';
    counter.innerText = '0 / 0';
    return;
  }

  currentOrder = getDeckOrder(category, currentOrder);
  const total = currentOrder.length;

  if (!total) {
    wrapper.innerHTML =
      '<div class="stack-card top-card">' +
      '<div class="card-inner study-face">' +
      (showStarredOnly
        ? 'No starred cards in this album.'
        : 'No cards yet. Add your first quote!') +
      '</div></div>';

    counter.innerText = '0 / 0';
    return;
  }

  currentCardIdx = Math.max(
    0,
    Math.min(currentCardIdx, total - 1)
  );

  const current = currentCardIdx;

  const face = index =>
    getCardInner(
      category.cards[currentOrder[index]],
      index + 1,
      total,
      category
    );

  let html = '';

  if (current > 0) {
    html +=
      '<div class="stack-card prev-card">' +
      face(current - 1) +
      '</div>';
  }

  if (current + 1 < total) {
    html +=
      '<div class="stack-card next-card">' +
      face(current + 1) +
      '</div>';
  }

  html +=
    '<div class="stack-card top-card">' +
    face(current) +
    '</div>';

  wrapper.innerHTML = html;

  if (silent) {
    wrapper.querySelectorAll('.stack-card')
      .forEach(card => {
        card.style.animation = 'none';
      });
  }

  counter.innerText = (current + 1) + ' / ' + total;
}


function startQuoteAutoPlayWithOptions() {
  document.getElementById('quoteCardActions').style.display = 'none';
  document.getElementById('quoteAutoPlaySettings').style.display = 'block';
  document.getElementById('quoteAutoPlayActiveControls').style.display = 'none';
}

function confirmQuoteAutoPlay() {
  var delay = parseFloat(document.getElementById('quoteTimerDelay').value);
  if (isNaN(delay) || delay < 1) delay = 5;
  
  document.getElementById('quoteAutoPlaySettings').style.display = 'none';
  document.getElementById('quoteAutoPlayActiveControls').style.display = 'flex';
  startQuoteAutoPlay();
}

function cancelQuoteAutoPlaySetup() {
  document.getElementById('quoteAutoPlaySettings').style.display = 'none';
  document.getElementById('quoteCardActions').style.display = 'flex';
}

let startQuoteAutoPlay;

let pauseQuoteAutoPlay;

let stopQuoteAutoPlay;

let startQuoteTimer;

let resetQuoteAutoPlayTimer;

function toggleQuoteLoop() {
  isQuoteLoopEnabled = !isQuoteLoopEnabled;
  var loopBtn = document.getElementById('quoteLoopToggleBtn');
  if (isQuoteLoopEnabled) {
    loopBtn.style.background = '#FFD966';
    loopBtn.style.color = '#1e1b2c';
    showToast('Loop mode: ON');
  } else {
    loopBtn.style.background = '';
    loopBtn.style.color = '';
    showToast('Loop mode: OFF');
  }
}

// Flashcard Functions
function flipCurrentCard() {
  isFlipped = !isFlipped;
  
  if (isAutoPlaying) {
    if (isFlipped) {
      autoPlayStage = 'back';
    } else {
      autoPlayStage = 'front';
    }
    resetAutoPlayTimer();
  }
  
  renderFlashcardStack();
}

function nextFlashcard() {
  var displayOrder = flashcardOrder;
  if (showStarredOnly) {
    var starredIndices = [];
    for (var j = 0; j < flashcardCategory.cards.length; j++) {
      if (flashcardCategory.cards[j].starred) {
        starredIndices.push(j);
      }
    }
    displayOrder = shuffleArray(starredIndices);
    if (displayOrder.length === 0) {
      showToast('No starred flashcards');
      return;
    }
  } else {
    if (flashcardOrder.length !== flashcardCategory.cards.length) {
      var indices = [];
      for (var j = 0; j < flashcardCategory.cards.length; j++) {
        indices.push(j);
      }
      flashcardOrder = shuffleArray(indices);
    }
    displayOrder = flashcardOrder;
  }
  
  if (currentFlashcardIdx + 1 < displayOrder.length) {
    currentFlashcardIdx++;
    isFlipped = false;
    autoPlayStage = 'front';
    renderFlashcardStack();
    if (isAutoPlaying) {
      resetAutoPlayTimer();
    }
  } else if (isLoopEnabled && displayOrder.length > 0) {
    currentFlashcardIdx = 0;
    isFlipped = false;
    autoPlayStage = 'front';
    renderFlashcardStack();
    if (isAutoPlaying) {
      resetAutoPlayTimer();
    }
    showToast('Looping: starting from beginning');
  }
}

function prevFlashcard() {
  if (currentFlashcardIdx - 1 >= 0) {
    currentFlashcardIdx--;
    isFlipped = false;
    autoPlayStage = 'front';
    renderFlashcardStack();
    if (isAutoPlaying) {
      resetAutoPlayTimer();
    }
  } else if (isLoopEnabled && flashcardCategory.cards.length > 0) {
    var displayOrder = flashcardOrder;
    if (showStarredOnly) {
      var starredIndices = [];
      for (var j = 0; j < flashcardCategory.cards.length; j++) {
        if (flashcardCategory.cards[j].starred) {
          starredIndices.push(j);
        }
      }
      displayOrder = shuffleArray(starredIndices);
      if (displayOrder.length === 0) {
        showToast('No starred flashcards');
        return;
      }
    }
    currentFlashcardIdx = displayOrder.length - 1;
    isFlipped = false;
    autoPlayStage = 'front';
    renderFlashcardStack();
    if (isAutoPlaying) {
      resetAutoPlayTimer();
    }
  }
}

function flipAllCards() {
  if (!flashcardCategory) return;
  
  for (var i = 0; i < flashcardCategory.cards.length; i++) {
    var card = flashcardCategory.cards[i];
    var tempFront = card.front;
    card.front = card.back;
    card.back = tempFront;
  }
  
  isFlipped = false;
  autoPlayStage = 'front';
  saveCategories();
  renderFlashcardStack();
  showToast('All cards flipped - front and back have been swapped');
}

function shuffleFlashcards() {
  flashcardOrder = shuffleArray([...flashcardOrder]);
  currentFlashcardIdx = 0;
  isFlipped = false;
  autoPlayStage = 'front';
  renderFlashcardStack();
  if (isAutoPlaying) {
    resetAutoPlayTimer();
  }
  showToast('Cards shuffled');
}

function startAutoPlayWithOptions() {
  document.getElementById('flashcardControls').style.display = 'none';
  document.getElementById('cardActionsGroup').style.display = 'none';
  document.getElementById('autoPlaySettings').style.display = 'block';
  document.getElementById('autoPlayActiveControls').style.display = 'none';
}

function confirmAutoPlay() {
  var frontDelay = parseFloat(document.getElementById('frontTimerDelay').value);
  var backDelay = parseFloat(document.getElementById('backTimerDelay').value);
  var shouldFlipAll = document.getElementById('autoFlipAllCheckbox').checked;
  var shouldShuffle = document.getElementById('autoShuffleCheckbox').checked;
  
  if (isNaN(frontDelay) || frontDelay < 0.5) frontDelay = 3;
  if (isNaN(backDelay) || backDelay < 0.5) backDelay = 2;
  
  if (shouldFlipAll) {
    for (var i = 0; i < flashcardCategory.cards.length; i++) {
      var card = flashcardCategory.cards[i];
      var tempFront = card.front;
      card.front = card.back;
      card.back = tempFront;
    }
    saveCategories();
    showToast('All cards flipped before auto-play');
  }
  
  if (shouldShuffle) {
    flashcardOrder = shuffleArray([...flashcardOrder]);
    currentFlashcardIdx = 0;
    showToast('Cards shuffled before auto-play');
  }
  
  isFlipped = false;
  autoPlayStage = 'front';
  renderFlashcardStack();
  
  document.getElementById('autoPlaySettings').style.display = 'none';
  document.getElementById('autoPlayActiveControls').style.display = 'flex';
  startAutoPlay();
}

function cancelAutoPlaySetup() {
  document.getElementById('autoPlaySettings').style.display = 'none';
  document.getElementById('flashcardControls').style.display = 'flex';
  document.getElementById('cardActionsGroup').style.display = 'flex';
}

let startAutoPlay;

let pauseAutoPlay;

let stopAutoPlay;

let startTimer;

let resetAutoPlayTimer;

function toggleLoop() {
  isLoopEnabled = !isLoopEnabled;
  var loopBtn = document.getElementById('loopToggleBtn');
  var loopBtnAuto = document.getElementById('loopToggleBtnAuto');
  if (isLoopEnabled) {
    if (loopBtn) loopBtn.style.background = '#FFD966';
    if (loopBtn) loopBtn.style.color = '#1e1b2c';
    if (loopBtnAuto) loopBtnAuto.style.background = '#FFD966';
    if (loopBtnAuto) loopBtnAuto.style.color = '#1e1b2c';
    showToast('Loop mode: ON');
  } else {
    if (loopBtn) loopBtn.style.background = '';
    if (loopBtn) loopBtn.style.color = '';
    if (loopBtnAuto) loopBtnAuto.style.background = '';
    if (loopBtnAuto) loopBtnAuto.style.color = '';
    showToast('Loop mode: OFF');
  }
}

function nextCard() {
  var category = null;
  for (var i = 0; i < categories.length; i++) {
    if (categories[i].id === selectedCategoryId) {
      category = categories[i];
      break;
    }
  }
  if (category && currentCardIdx + 1 < currentOrder.length) {
    currentCardIdx++;
    renderStackedDeck();
    if (isQuoteAutoPlaying) {
      resetQuoteAutoPlayTimer();
    }
  } else if (isQuoteLoopEnabled && category && category.cards.length > 0) {
    currentCardIdx = 0;
    renderStackedDeck();
    if (isQuoteAutoPlaying) {
      resetQuoteAutoPlayTimer();
    }
    showToast('Looping: starting from beginning');
  }
}

function prevCard() {
  if (currentCardIdx - 1 >= 0) {
    currentCardIdx--;
    renderStackedDeck();
    if (isQuoteAutoPlaying) {
      resetQuoteAutoPlayTimer();
    }
  } else if (isQuoteLoopEnabled) {
    var category = null;
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].id === selectedCategoryId) {
        category = categories[i];
        break;
      }
    }
    if (category && category.cards.length > 0) {
      currentCardIdx = currentOrder.length - 1;
      renderStackedDeck();
      if (isQuoteAutoPlaying) {
        resetQuoteAutoPlayTimer();
      }
    }
  }
}

function showAlbumDetailView() {
  var albumsView = document.getElementById('albumsView');
  var detailView = document.getElementById('albumDetailView');
  var category = null;
  for (var i = 0; i < categories.length; i++) {
    if (categories[i].id === selectedCategoryId) {
      category = categories[i];
      break;
    }
  }

  if (selectedCategoryId && category) {
    if (albumsView) albumsView.style.display = 'none';
    if (detailView) detailView.style.display = 'block';
    var titleEl = document.getElementById('currentCategoryTitle');
    if (titleEl) titleEl.innerHTML = escapeHtml(category.name);
    if (detailView) detailView.style.background = 'linear-gradient(135deg, ' + category.themeColor + '15, rgba(0,0,0,0.4))';
  }
}

function backToAlbums() {
  stopAutoPlay();
  stopQuoteAutoPlay();
  var albumsView = document.getElementById('albumsView');
  var detailView = document.getElementById('albumDetailView');
  var flashcardView = document.getElementById('flashcardView');
  if (albumsView) albumsView.style.display = 'block';
  if (detailView) detailView.style.display = 'none';
  if (flashcardView) flashcardView.style.display = 'none';
  selectedCategoryId = null;
  showStarredOnly = false;
  renderAlbums();
}

let createOrUpdateCategory;

function openEditCategory(id, name, color, font, fontColor, type) {
  var titleEl = document.getElementById('catModalTitle');
  var nameInput = document.getElementById('catName');
  var colorInput = document.getElementById('themeColor');
  var fontColorInput = document.getElementById('fontColor');
  var fontSelect = document.getElementById('categoryFont');
  var editIdInput = document.getElementById('editCatId');
  var typeSelect = document.getElementById('albumType');
  var fontSizeSlider = document.getElementById('fontSize');
  var fontSizeValue = document.getElementById('fontSizeValue');
  
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-edit"></i> Edit Album';
  if (nameInput) nameInput.value = name;
  if (colorInput) colorInput.value = color;
  if (fontColorInput) fontColorInput.value = fontColor || '#FFFFFF';
  if (fontSelect) fontSelect.value = font;
  if (editIdInput) editIdInput.value = id;
  if (typeSelect) typeSelect.value = type || 'quote';
  
  var category = null;
  for (var i = 0; i < categories.length; i++) {
    if (categories[i].id === id) {
      category = categories[i];
      break;
    }
  }
  
  var fontSize = (category && category.fontSize) ? category.fontSize : 20;
  if (fontSizeSlider) fontSizeSlider.value = fontSize;
  if (fontSizeValue) fontSizeValue.innerText = fontSize + 'px';
  
  updateLivePreview();
  showModal('categoryModal');
}

async function deleteCategoryById(id) {
  if (!await appConfirm("Delete entire album and all its cards?")) return;
  var newCategories = [];
  for (var i = 0; i < categories.length; i++) {
    if (categories[i].id !== id) {
      newCategories.push(categories[i]);
    }
  }
  categories = newCategories;
  if (selectedCategoryId === id) {
    selectedCategoryId = null;
    backToAlbums();
  }
  currentCardIdx = 0;
  currentOrder = [];
  await saveCategories();
  renderAlbums();
  showToast("Album deleted");
}

function editCurrentCategory() {
  var category = null;
  for (var i = 0; i < categories.length; i++) {
    if (categories[i].id === selectedCategoryId) {
      category = categories[i];
      break;
    }
  }
  if (category) {
    openEditCategory(category.id, category.name, category.themeColor, category.font, category.fontColor, category.type);
  } else {
    alert("Select an album first");
  }
}

async function deleteCurrentCategory() {
  if (selectedCategoryId) {
    await deleteCategoryById(selectedCategoryId);
  } else {
    alert("No album selected");
  }
}

let addOrUpdateQuoteCard;

let addOrUpdateFlashcard;

function openEditCard(cardId) {
  var category = null;
  for (var i = 0; i < categories.length; i++) {
    if (categories[i].id === selectedCategoryId) {
      category = categories[i];
      break;
    }
  }
  if (!category) return;
  
  var card = null;
  for (var j = 0; j < category.cards.length; j++) {
    if (category.cards[j].id === cardId) {
      card = category.cards[j];
      break;
    }
  }
  if (!card) return;

  var titleEl = document.getElementById('cardModalTitle');
  var quoteTextarea = document.getElementById('quoteText');
  var editCardIdInput = document.getElementById('editCardId');
  
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-edit"></i> Edit Quote';
  if (quoteTextarea) quoteTextarea.value = card.text;
  if (editCardIdInput) editCardIdInput.value = card.id;
  showModal('cardModal');
}

function openEditFlashcard(cardId) {
  if (!flashcardCategory) return;
  
  var card = null;
  for (var j = 0; j < flashcardCategory.cards.length; j++) {
    if (flashcardCategory.cards[j].id === cardId) {
      card = flashcardCategory.cards[j];
      break;
    }
  }
  if (!card) return;

  var titleEl = document.getElementById('flashcardModalTitle');
  var frontTextarea = document.getElementById('flashcardFrontText');
  var backTextarea = document.getElementById('flashcardBackText');
  var editCardIdInput = document.getElementById('editFlashcardId');
  
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-edit"></i> Edit Flashcard';
  if (frontTextarea) frontTextarea.value = card.front;
  if (backTextarea) backTextarea.value = card.back;
  if (editCardIdInput) editCardIdInput.value = card.id;
  showModal('flashcardModal');
}

async function deleteCardById(cardId) {
  var category = null;
  for (var i = 0; i < categories.length; i++) {
    if (categories[i].id === selectedCategoryId) {
      category = categories[i];
      break;
    }
  }
  if (!category) return;

  if (!await appConfirm("Delete this quote card?")) return;

  var cardIndex = -1;
  for (var j = 0; j < category.cards.length; j++) {
    if (category.cards[j].id === cardId) {
      cardIndex = j;
      break;
    }
  }
  if (cardIndex !== -1) {
    category.cards.splice(cardIndex, 1);
    var newOrder = [];
    for (var k = 0; k < currentOrder.length; k++) {
      if (currentOrder[k] !== cardIndex) {
        if (currentOrder[k] > cardIndex) {
          newOrder.push(currentOrder[k] - 1);
        } else {
          newOrder.push(currentOrder[k]);
        }
      }
    }
    currentOrder = newOrder;
    if (currentCardIdx >= currentOrder.length) {
      currentCardIdx = currentOrder.length - 1;
      if (currentCardIdx < 0) currentCardIdx = 0;
    }
    
    await saveCategories();
    renderStackedDeck();
    renderAlbums();
    updateStarFilterButtons();
    showToast("Card deleted");
  }
}

async function deleteFlashcardById(cardId) {
  if (!flashcardCategory) return;
  if (!await appConfirm("Delete this flashcard?")) return;

  var cardIndex = -1;
  for (var j = 0; j < flashcardCategory.cards.length; j++) {
    if (flashcardCategory.cards[j].id === cardId) {
      cardIndex = j;
      break;
    }
  }
  if (cardIndex !== -1) {
    flashcardCategory.cards.splice(cardIndex, 1);
    flashcardOrder = [];
    for (var k = 0; k < flashcardCategory.cards.length; k++) {
      flashcardOrder.push(k);
    }
    if (currentFlashcardIdx >= flashcardOrder.length) {
      currentFlashcardIdx = flashcardOrder.length - 1;
      if (currentFlashcardIdx < 0) currentFlashcardIdx = 0;
    }
    
    await saveCategories();
    renderAlbums();
    if (flashcardCategory) {
      renderFlashcardStack();
    }
    updateStarFilterButtons();
    showToast("Flashcard deleted");
  }
}

// Keyboard shortcuts
function handleKeyPress(event) {
  if (
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  ) return;

  const target = event.target;

  const editing =
    target instanceof Element &&
    target.closest(
      'input, textarea, select, ' +
      '[contenteditable]:not([contenteditable="false"]), ' +
      '[role="textbox"]'
    );

  if (document.querySelector('dialog[open]')) return;

  function visible(id) {
    const element = document.getElementById(id);
    return element &&
      getComputedStyle(element).display !== 'none';
  }

  const modal = [
    'categoryModal',
    'cardModal',
    'flashcardModal'
  ].find(visible);

  if (modal) {
    if (event.key === 'Escape') {
      event.preventDefault();
      hideModal(modal);
    } else if (
      event.key === 'Enter' &&
      !event.repeat &&
      !(target instanceof Element && target.closest(
        'textarea, select, button, ' +
        '[contenteditable]:not([contenteditable="false"])'
      ))
    ) {
      event.preventDefault();

      if (modal === 'categoryModal') createOrUpdateCategory();
      else if (modal === 'cardModal') addOrUpdateQuoteCard();
      else addOrUpdateFlashcard();
    }

    return;
  }

  if (editing) return;

  const flash = visible('flashcardView');
  const quote = visible('albumDetailView');

  if (!flash && !quote) return;

  if (event.key.toLowerCase() === 's') {
    if (event.repeat) return;

    const wrapper = document.getElementById(
      flash ? 'flashcardStackWrapper' : 'stackWrapper'
    );

    const star = wrapper?.querySelector('.top-card .star-btn');

    if (star && !star.disabled) {
      event.preventDefault();
      toggleStar(
        star.dataset.id,
        flash ? 'flashcard' : 'quote'
      );
    }
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    if (flash) prevFlashcard();
    else prevCard();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    if (flash) nextFlashcard();
    else nextCard();
  } else if (
    (event.key === ' ' || event.key === 'Space') &&
    flash &&
    !(target instanceof Element && target.closest('button, a'))
  ) {
    event.preventDefault();
    flipCurrentCard();
  }
}

function createCustomDropdown() {
  var select = document.getElementById('categoryFont');
  if (!select) return;
  
  if (select.parentNode.querySelector('.custom-dropdown')) {
    return;
  }
  
  select.style.display = 'none';
  
  var container = select.parentNode;
  var dropdown = document.createElement('div');
  dropdown.className = 'custom-dropdown';
  
  var trigger = document.createElement('div');
  trigger.className = 'custom-dropdown-trigger';
  var selectedOption = select.options[select.selectedIndex];
  if (selectedOption) {
    trigger.innerHTML = selectedOption.textContent + ' <i class="fas fa-chevron-up"></i>';
    trigger.style.fontFamily = select.value;
  } else {
    trigger.innerHTML = 'Select Font <i class="fas fa-chevron-up"></i>';
  }
  
  var list = document.createElement('div');
  list.className = 'custom-dropdown-list';
  
  for (var i = 0; i < select.options.length; i++) {
    var opt = select.options[i];
    var optDiv = document.createElement('div');
    optDiv.className = 'custom-dropdown-option';
    optDiv.textContent = opt.textContent;
    optDiv.style.fontFamily = opt.value;
    optDiv.setAttribute('data-value', opt.value);
    
    optDiv.addEventListener('click', function(e) {
      var value = this.getAttribute('data-value');
      var text = this.textContent;
      select.value = value;
      trigger.innerHTML = text + ' <i class="fas fa-chevron-up"></i>';
      trigger.style.fontFamily = value;
      list.style.display = 'none';
      var event = new Event('change');
      select.dispatchEvent(event);
      updateLivePreview();
    });
    
    list.appendChild(optDiv);
  }
  
  dropdown.appendChild(trigger);
  dropdown.appendChild(list);
  container.appendChild(dropdown);
  
  trigger.addEventListener('click', function(e) {
    e.stopPropagation();
    var isOpen = list.style.display === 'block';
    document.querySelectorAll('.custom-dropdown-list').forEach(function(el) {
      el.style.display = 'none';
    });
    list.style.display = isOpen ? 'none' : 'block';
  });
  
  document.addEventListener('click', function(e) {
    if (!dropdown.contains(e.target)) {
      list.style.display = 'none';
    }
  });
  
  select.addEventListener('change', function() {
    var selected = select.options[select.selectedIndex];
    if (selected) {
      trigger.innerHTML = selected.textContent + ' <i class="fas fa-chevron-up"></i>';
      trigger.style.fontFamily = select.value;
    }
  });
}

function openNewCategoryModal() {
  var titleEl = document.getElementById('catModalTitle');
  var nameInput = document.getElementById('catName');
  var colorInput = document.getElementById('themeColor');
  var fontColorInput = document.getElementById('fontColor');
  var fontSelect = document.getElementById('categoryFont');
  var editIdInput = document.getElementById('editCatId');
  var typeSelect = document.getElementById('albumType');
  var fontSizeSlider = document.getElementById('fontSize');
  var fontSizeValue = document.getElementById('fontSizeValue');
  
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-folder-plus"></i> New Album';
  if (nameInput) nameInput.value = '';
  if (colorInput) colorInput.value = '#6C5CE7';
  if (fontColorInput) fontColorInput.value = '#FFFFFF';
  if (fontSelect) fontSelect.value = 'Inter, sans-serif';
  if (editIdInput) editIdInput.value = '';
  if (typeSelect) typeSelect.value = 'quote';
  if (fontSizeSlider) fontSizeSlider.value = 20;
  if (fontSizeValue) fontSizeValue.innerText = '20px';
  
  var customTrigger = document.querySelector('.custom-dropdown-trigger');
  if (customTrigger && fontSelect && fontSelect.options) {
    var selectedOption = fontSelect.options[fontSelect.selectedIndex];
    if (selectedOption) {
      customTrigger.innerHTML = selectedOption.textContent + ' <i class="fas fa-chevron-up"></i>';
      customTrigger.style.fontFamily = fontSelect.value;
    }
  }
  
  updateLivePreview();
  showModal('categoryModal');
  setTimeout(function() { if (nameInput) nameInput.focus(); }, 100);
}

function openNewQuoteCardModal() {
  if (!selectedCategoryId) {
    alert("Select an album first");
    return;
  }
  var titleEl = document.getElementById('cardModalTitle');
  var quoteTextarea = document.getElementById('quoteText');
  var editCardIdInput = document.getElementById('editCardId');
  
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-quote-left"></i> New Quote';
  if (quoteTextarea) quoteTextarea.value = '';
  if (editCardIdInput) editCardIdInput.value = '';
  
  showModal('cardModal');
  setTimeout(function() { 
    if (quoteTextarea) {
      quoteTextarea.focus();
      quoteTextarea.select();
    }
  }, 100);
}

function openNewFlashcardModal() {
  if (!flashcardCategory) {
    alert("Select a flashcard album first");
    return;
  }
  var titleEl = document.getElementById('flashcardModalTitle');
  var frontTextarea = document.getElementById('flashcardFrontText');
  var backTextarea = document.getElementById('flashcardBackText');
  var editCardIdInput = document.getElementById('editFlashcardId');
  
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-layer-group"></i> New Flashcard';
  if (frontTextarea) frontTextarea.value = '';
  if (backTextarea) backTextarea.value = '';
  if (editCardIdInput) editCardIdInput.value = '';
  
  showModal('flashcardModal');
  setTimeout(function() { 
    if (frontTextarea) {
      frontTextarea.focus();
    }
  }, 100);
}

function editCurrentFlashcardCategory() {
  if (flashcardCategory) {
    openEditCategory(flashcardCategory.id, flashcardCategory.name, flashcardCategory.themeColor, flashcardCategory.font, flashcardCategory.fontColor, flashcardCategory.type);
  } else {
    alert("No album selected");
  }
}

async function deleteCurrentFlashcardCategory() {
  if (flashcardCategory) {
    await deleteCategoryById(flashcardCategory.id);
  } else {
    alert("No album selected");
  }
}

function renderAllUI() {
  renderAlbums();
}

function setupFontSizeListener() {
  var fontSizeSlider = document.getElementById('fontSize');
  if (fontSizeSlider) {
    fontSizeSlider.addEventListener('input', updateLivePreview);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  var createBtn = document.getElementById('createCategoryBtn');
  if (createBtn) createBtn.onclick = openNewCategoryModal;

  var addCardBtn = document.getElementById('addCardBtn');
  if (addCardBtn) addCardBtn.onclick = openNewQuoteCardModal;

  var editCatBtn = document.getElementById('editCategoryBtn');
  if (editCatBtn) editCatBtn.onclick = editCurrentCategory;

  var deleteCatBtn = document.getElementById('deleteCategoryBtn');
  if (deleteCatBtn) deleteCatBtn.onclick = deleteCurrentCategory;

  var prevBtn = document.getElementById('prevBtn');
  if (prevBtn) prevBtn.onclick = prevCard;

  var nextBtn = document.getElementById('nextBtn');
  if (nextBtn) nextBtn.onclick = nextCard;

  var confirmCatBtn = document.getElementById('confirmCatBtn');
  if (confirmCatBtn) confirmCatBtn.onclick = createOrUpdateCategory;

  var cancelCatBtn = document.getElementById('cancelCatBtn');
  if (cancelCatBtn) cancelCatBtn.onclick = function() { hideModal('categoryModal'); };

  var confirmCardBtn = document.getElementById('confirmCardBtn');
  if (confirmCardBtn) confirmCardBtn.onclick = addOrUpdateQuoteCard;

  var cancelCardBtn = document.getElementById('cancelCardBtn');
  if (cancelCardBtn) cancelCardBtn.onclick = function() { hideModal('cardModal'); };

  var backBtn = document.getElementById('backToAlbumsBtn');
  if (backBtn) backBtn.onclick = backToAlbums;
  
  var backBtnFlash = document.getElementById('backToAlbumsBtnFlash');
  if (backBtnFlash) backBtnFlash.onclick = backToAlbums;
  
  var addFlashcardBtn = document.getElementById('addFlashcardBtn');
  if (addFlashcardBtn) addFlashcardBtn.onclick = openNewFlashcardModal;
  
  var editFlashcardCatBtn = document.getElementById('editFlashcardCatBtn');
  if (editFlashcardCatBtn) editFlashcardCatBtn.onclick = editCurrentFlashcardCategory;
  
  var deleteFlashcardCatBtn = document.getElementById('deleteFlashcardCatBtn');
  if (deleteFlashcardCatBtn) deleteFlashcardCatBtn.onclick = deleteCurrentFlashcardCategory;
  
  var confirmFlashcardBtn = document.getElementById('confirmFlashcardBtn');
  if (confirmFlashcardBtn) confirmFlashcardBtn.onclick = addOrUpdateFlashcard;
  
  var cancelFlashcardBtn = document.getElementById('cancelFlashcardBtn');
  if (cancelFlashcardBtn) cancelFlashcardBtn.onclick = function() { hideModal('flashcardModal'); };
  
  var flashPrevBtn = document.getElementById('flashPrevBtn');
  if (flashPrevBtn) flashPrevBtn.onclick = prevFlashcard;
  
  var flashNextBtn = document.getElementById('flashNextBtn');
  if (flashNextBtn) flashNextBtn.onclick = nextFlashcard;
  
  var shuffleBtn = document.getElementById('shuffleFlashcardsBtn');
  if (shuffleBtn) shuffleBtn.onclick = shuffleFlashcards;
  
  var flipAllBtn = document.getElementById('flipAllBtn');
  if (flipAllBtn) flipAllBtn.onclick = flipAllCards;
  
  var loopBtn = document.getElementById('loopToggleBtn');
  if (loopBtn) loopBtn.onclick = toggleLoop;
  
  var startAutoPlayBtn = document.getElementById('startAutoPlayBtn');
  if (startAutoPlayBtn) startAutoPlayBtn.onclick = startAutoPlayWithOptions;
  
  var confirmAutoPlayBtn = document.getElementById('confirmAutoPlayBtn');
  if (confirmAutoPlayBtn) confirmAutoPlayBtn.onclick = confirmAutoPlay;
  
  var cancelAutoPlayBtn = document.getElementById('cancelAutoPlayBtn');
  if (cancelAutoPlayBtn) cancelAutoPlayBtn.onclick = cancelAutoPlaySetup;
  
  var pauseAutoBtn = document.getElementById('pauseAutoBtn');
  if (pauseAutoBtn) pauseAutoBtn.onclick = pauseAutoPlay;
  
  var stopAutoBtn = document.getElementById('stopAutoBtn');
  if (stopAutoBtn) stopAutoBtn.onclick = stopAutoPlay;
  
  var loopToggleBtnAuto = document.getElementById('loopToggleBtnAuto');
  if (loopToggleBtnAuto) loopToggleBtnAuto.onclick = toggleLoop;
  
  // Quote Card Auto-Play event listeners
  var quoteAutoPlayBtn = document.getElementById('quoteAutoPlayBtn');
  if (quoteAutoPlayBtn) quoteAutoPlayBtn.onclick = startQuoteAutoPlayWithOptions;
  
  var confirmQuoteAutoPlayBtn = document.getElementById('confirmQuoteAutoPlayBtn');
  if (confirmQuoteAutoPlayBtn) confirmQuoteAutoPlayBtn.onclick = confirmQuoteAutoPlay;
  
  var cancelQuoteAutoPlayBtn = document.getElementById('cancelQuoteAutoPlayBtn');
  if (cancelQuoteAutoPlayBtn) cancelQuoteAutoPlayBtn.onclick = cancelQuoteAutoPlaySetup;
  
  var quotePauseAutoBtn = document.getElementById('quotePauseAutoBtn');
  if (quotePauseAutoBtn) quotePauseAutoBtn.onclick = pauseQuoteAutoPlay;
  
  var quoteStopAutoBtn = document.getElementById('quoteStopAutoBtn');
  if (quoteStopAutoBtn) quoteStopAutoBtn.onclick = stopQuoteAutoPlay;
  
  var quoteLoopToggleBtn = document.getElementById('quoteLoopToggleBtn');
  if (quoteLoopToggleBtn) quoteLoopToggleBtn.onclick = toggleQuoteLoop;
  
  // Star filter buttons
  var starFilterBtn = document.getElementById('starFilterBtn');
  if (starFilterBtn) starFilterBtn.onclick = toggleShowStarred;
  
  var starFilterBtnFlash = document.getElementById('starFilterBtnFlash');
  if (starFilterBtnFlash) starFilterBtnFlash.onclick = toggleShowStarred;

  document.addEventListener('keydown', handleKeyPress);

  var nameInput = document.getElementById('catName');
  var colorInput = document.getElementById('themeColor');
  var fontColorInput = document.getElementById('fontColor');
  var fontSelect = document.getElementById('categoryFont');
  var fontSizeSlider = document.getElementById('fontSize');
  
  if (nameInput) nameInput.addEventListener('input', updateLivePreview);
  if (colorInput) colorInput.addEventListener('input', updateLivePreview);
  if (fontColorInput) fontColorInput.addEventListener('input', updateLivePreview);
  if (fontSelect) fontSelect.addEventListener('change', updateLivePreview);
  if (fontSizeSlider) fontSizeSlider.addEventListener('input', updateLivePreview);

  createCustomDropdown();
  setupFontSizeListener();

  loadCategories();
});
;

// Source: ui-refresh.js
(() => {
  'use strict';

  const css = `
    :root {
      --paper: #f4f1e9;
      --ink: #28352f;
      --muted: #737b73;
      --line: #d7dbd0;
      --accent: #2d5847;
    }

    body {
      background: var(--paper);
      color: var(--ink);
      padding: 24px;
    }

    .app {
      max-width: 1240px;
      background: transparent;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      backdrop-filter: none;
      padding: 0;
    }

    .header {
      border-bottom: 1px solid var(--line);
      padding: 8px 0 24px;
      margin-bottom: 28px;
    }

    .logo h1 {
      color: var(--ink);
      background: none;
      font-size: 30px;
      letter-spacing: -1px;
    }

    .logo h1 i {
      color: var(--accent);
      font-size: 24px;
    }

    .logo p {
      color: var(--muted);
      font-size: 12px;
      margin-top: 8px;
    }

    .btn {
      border-radius: 9px;
      min-height: 42px;
      box-shadow: none;
      font-size: 13px;
      padding: 10px 16px;
    }

    .btn-primary {
      background: var(--accent);
      color: #fff;
    }

    .btn-outline,
    .back-btn {
      background: transparent;
      color: var(--ink);
      border: 1px solid var(--line);
      backdrop-filter: none;
    }

    .btn-outline:hover,
    .back-btn:hover {
      background: #e6e9df;
      transform: none;
    }

    .btn-primary:hover {
      background: #244737;
      transform: none;
      box-shadow: none;
    }

    .btn-danger {
      background: #faece8;
      color: #9b4639;
      border: 1px solid #efd5ce;
    }

    .btn-danger:hover {
      background: #f4dcd5;
      color: #803529;
      transform: none;
    }

    button:focus-visible,
    input:focus-visible {
      outline: 3px solid #b98637;
      outline-offset: 3px;
    }

    .section-title {
      color: var(--ink);
      font-size: 19px;
      margin: 0;
    }

    .library-heading {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }

    .album-search {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #fffdf8;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 0 12px;
      width: min(100%, 360px);
      color: var(--muted);
    }

    .album-search input {
      width: 100%;
      min-width: 0;
      border: 0;
      background: transparent;
      padding: 13px 0;
      color: var(--ink);
      font: inherit;
      font-size: 14px;
    }

    .album-search button {
      border: 0;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      padding: 8px;
      font-size: 18px;
    }

    .search-status {
      color: var(--muted);
      font-size: 13px;
      margin: -8px 0 20px;
    }

    .search-empty {
      border: 1px dashed var(--line);
      padding: 35px;
      text-align: center;
      color: var(--muted);
      border-radius: 12px;
    }

    .albums-grid {
      gap: 20px;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    }

    .album-folder {
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: 0 4px 10px #28352f08;
      background: #fffdf8;
      aspect-ratio: 4 / 3;
    }

    .album-folder:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 20px #28352f12;
      border-color: #a2b3a3;
    }

    .folder-preview {
      align-items: flex-start;
      padding: 24px;
      background-image: none !important;
    }

    .folder-name-large {
      text-align: left;
      font-size: 22px;
      text-shadow: none;
      font-weight: 600;
      line-height: 1.35;
    }

    .folder-quote-count {
      border-radius: 5px;
      background: #00000018;
      margin-top: 10px;
    }

    .folder-info {
      background: #fffdf8;
      border-top: 0;
      padding: 10px 16px;
    }

    .folder-action-btn {
      color: var(--muted);
      background: transparent;
      border-radius: 6px;
    }

    .album-detail-container,
    .flashcard-container {
      background: transparent;
      padding: 0;
      border-radius: 0;
    }

    .detail-header {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 16px;
      margin-bottom: 30px;
    }

    .album-detail-title {
      justify-self: start;
      min-width: 0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .current-cat-title {
      color: var(--ink);
      font-size: 28px;
      overflow-wrap: anywhere;
    }

    .album-type-badge {
      background: #e3e7dc;
      color: #51614d;
      border-radius: 5px;
    }

    .card-actions-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0;
      justify-content: flex-end;
    }

    .reading-toolbar {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      border-top: 1px solid var(--line);
      padding-top: 14px;
    }

    .toolbar-label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.6px;
      margin-right: 10px;
    }

    .reading-toolbar .btn {
      min-height: 36px;
      padding: 7px 12px;
    }

    .stack-deck,
    .flashcard-deck {
      margin-top: 0;
    }

    .card-stack-wrapper,
    .flashcard-stack-wrapper {
      max-width: 720px;
      height: 450px;
    }

    .stack-card,
    .flashcard-stack-card,
    .flashcard-inner,
    .flashcard-front,
    .flashcard-back {
      border-radius: 16px;
    }

    .stack-card,
    .flashcard-stack-card {
      box-shadow: 0 18px 35px #28352f20;
    }

    .card-inner,
    .flashcard-front,
    .flashcard-back {
      background-image: none !important;
      background-size: auto;
      background-repeat: no-repeat;
      padding: 72px 48px 84px;
      isolation: isolate;
    }

    .card-inner::before,
    .flashcard-front::before,
    .flashcard-back::before {
      display: none;
    }

    .card-inner::after,
    .flashcard-front::after,
    .flashcard-back::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      pointer-events: none;
    }

    .design-arch::after {
      border: 1px solid currentColor;
      border-radius: 200px 200px 0 0;
      inset: 26px 24px -90px;
      opacity: .18;
    }

    .design-corner::after {
      background: currentColor;
      clip-path: polygon(70% 0, 100% 0, 100% 45%);
      opacity: .1;
    }

    .design-frame::after {
      inset: 20px;
      border: 1px solid currentColor;
      opacity: .24;
    }

    .design-margin::after {
      left: 25px;
      top: 25px;
      bottom: 25px;
      width: 8px;
      background: currentColor;
      opacity: .2;
    }

    .design-orbit::after {
      width: 300px;
      height: 300px;
      border: 50px solid currentColor;
      border-radius: 50%;
      left: auto;
      top: auto;
      right: -160px;
      bottom: -170px;
      opacity: .09;
    }

    .design-corner .quote-text,
    .design-margin .quote-text {
      text-align: left;
      align-self: flex-start;
    }

    .quote-text,
    .flashcard-content {
      text-shadow: none;
      font-weight: 500;
      line-height: 1.6;
      max-width: 100%;
      max-height: 100%;
      overflow-y: auto;
      white-space: pre-wrap;
      margin: 0;
    }

    .card-eyebrow {
      position: absolute;
      top: 28px;
      left: 32px;
      right: 32px;
      font: 11px Inter, sans-serif;
      letter-spacing: 2px;
      text-transform: uppercase;
      opacity: .75;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }

    .card-meta,
    .flashcard-meta {
      position: absolute;
      bottom: 32px;
      left: 32px;
      margin: 0;
      font: 12px Inter, sans-serif;
      opacity: .8;
    }

    .card-edit-overlay,
    .flashcard-edit-overlay {
      bottom: 22px;
      right: 24px;
      background: #00000018;
      padding: 5px;
      border-radius: 9px;
      gap: 3px;
    }

    .float-btn {
      width: 36px;
      height: 36px;
      padding: 0;
      justify-content: center;
      border-radius: 6px;
      background: #00000030;
      backdrop-filter: none;
      font-size: 13px;
    }

    .float-btn:hover {
      background: #00000055;
    }

    .nav-controls,
    .flashcard-nav {
      gap: 18px;
      margin-top: 36px;
    }

    .nav-btn {
      background: #fffdf8;
      color: var(--ink);
      border: 1px solid var(--line);
      box-shadow: none;
      width: 44px;
      height: 44px;
      border-radius: 10px;
    }

    .card-counter,
    .flashcard-counter {
      color: var(--ink);
      background: transparent;
      backdrop-filter: none;
      font-size: 13px;
    }

    .keyboard-hint {
      color: var(--muted);
    }

    .auto-play-settings,
    .auto-play-active {
      background: #e7ebdf;
      color: var(--ink);
      border: 1px solid var(--line);
      border-radius: 12px;
    }

    .timer-status,
    .timer-setting label {
      color: var(--ink);
    }

    .modal-content {
      background: #fffdf8;
      color: var(--ink);
      border: 1px solid var(--line);
      border-radius: 16px;
    }

    .modal-content h3,
    .modal-content h4,
    .color-preview span,
    .font-preview span,
    .font-size-control span,
    .album-type-select span,
    .flashcard-side label {
      color: var(--ink);
    }

    .modal-content input:not([type=color]):not([type=range]):not([type=checkbox]),
    .modal-content textarea,
    .modal-content select {
      background: #f4f1e9;
      color: var(--ink);
      border: 1px solid var(--line);
    }

    .info-note,
    .preview-label {
      color: var(--muted);
    }

    .toast {
      background: var(--ink);
      color: white;
    }

    [hidden] {
      display: none !important;
    }

    @media (max-width: 1000px) {
      .detail-header {
        grid-template-columns: auto 1fr;
      }

      .card-actions-group {
        grid-column: 1 / -1;
        justify-content: flex-start;
      }
    }

    @media (max-width: 600px) {
      body {
        padding: 16px;
      }

      .logo h1 {
        font-size: 24px;
      }

      .logo p {
        max-width: 200px;
        line-height: 1.5;
      }

      .detail-header {
        grid-template-columns: 1fr;
        gap: 14px;
      }

      .current-cat-title {
        font-size: 24px;
      }

      .back-btn {
        justify-self: start;
      }

      .btn {
        padding: 9px 11px;
      }

      .album-search {
        width: 100%;
      }

      .card-stack-wrapper,
      .flashcard-stack-wrapper {
        height: 420px;
      }

      .card-inner,
      .flashcard-front,
      .flashcard-back {
        padding: 68px 28px 84px;
      }

      .card-eyebrow {
        left: 28px;
      }

      .albums-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .album-folder {
        aspect-ratio: auto;
        min-height: 190px;
      }

      .folder-preview {
        padding: 16px;
      }

      .folder-name-large {
        font-size: 18px;
      }

      .folder-info {
        padding: 8px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
      }
    }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);

  function decorateCards(root) {
    root.querySelectorAll(
      '.card-inner,.flashcard-front,.flashcard-back'
    ).forEach(face => {
      if (face.dataset.refreshed) return;

      face.dataset.refreshed = 'true';

      const content = face.querySelector(
        '.quote-text,.flashcard-content'
      );

      // The same content keeps the same design after rendering again.
      let hash = 0;

      for (const char of content?.textContent || '') {
        hash = (hash * 31 + char.codePointAt(0)) >>> 0;
      }

      const designs = [
        'design-arch',
        'design-corner',
        'design-frame',
        'design-margin',
        'design-orbit'
      ];

      face.classList.add(designs[hash % designs.length]);

      const label = document.createElement('div');
      label.className = 'card-eyebrow';

      if (face.classList.contains('flashcard-front')) {
        label.textContent = 'Prompt · tap to reveal';
      } else if (face.classList.contains('flashcard-back')) {
        label.textContent = 'Answer · tap to return';
      } else {
        label.textContent = 'A thought to keep';
      }

      face.append(label);
    });

    root.querySelectorAll('.float-btn').forEach(button => {
      let label;

      if (button.classList.contains('star-btn')) {
        label = 'Star or unstar card';
      } else if (button.className.includes('delete')) {
        label = 'Delete card';
      } else {
        label = 'Edit card';
      }

      button.title = label;
      button.setAttribute('aria-label', label);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.logo p').textContent =
      'A personal collection of thoughts & things to learn.';

    document.querySelector('#cardModal .info-note').textContent =
      'Your album colors and font are used on every card.';

    const albums = document.getElementById('albumsView');

    const heading = document.createElement('div');
    heading.className = 'library-heading';
    heading.append(albums.querySelector('.section-title'));

    const search = document.createElement('label');
    search.className = 'album-search';

    search.innerHTML = `
      <i class="fas fa-search" aria-hidden="true"></i>
      <input
        type="search"
        id="albumSearch"
        placeholder="Search albums by name…"
        aria-label="Search albums by name"
      >
      <button
        type="button"
        aria-label="Clear album search"
        hidden
      >×</button>
    `;

    heading.append(search);
    albums.prepend(heading);

    const status = document.createElement('p');
    status.className = 'search-status';
    status.setAttribute('role', 'status');
    heading.after(status);

    const empty = document.createElement('div');
    empty.className = 'search-empty';
    empty.textContent = 'No matching albums. Try another name.';
    empty.hidden = true;
    albums.append(empty);

    const input = search.querySelector('input');
    const clear = search.querySelector('button');

    function filterAlbums() {
      const query = input.value
        .normalize('NFKC')
        .trim()
        .toLocaleLowerCase();

      const folders = [
        ...document.querySelectorAll(
          '#categoriesContainer .album-folder'
        )
      ];

      let visible = 0;

      folders.forEach(folder => {
        const preview = folder.querySelector('.folder-preview');
        const album = categories.find(
          item => item.id === folder.dataset.id
        );

        if (album) {
          preview.style.backgroundColor = album.themeColor;
        }

        const name = folder
          .querySelector('.folder-name-large')
          .textContent
          .normalize('NFKC')
          .toLocaleLowerCase();

        folder.hidden = !name.includes(query);

        if (!folder.hidden) visible++;
      });

      clear.hidden = !input.value;
      empty.hidden = !query || visible > 0;

      status.textContent = query
        ? visible + ' of ' + folders.length + ' albums'
        : folders.length + ' albums in your collection';
    }

    input.addEventListener('input', filterAlbums);

    clear.addEventListener('click', () => {
      input.value = '';
      filterAlbums();
      input.focus();
    });

    // Reapply search after creating, editing, or deleting an album.
    new MutationObserver(filterAlbums).observe(
      document.getElementById('categoriesContainer'),
      { childList: true }
    );

    filterAlbums();

    function toolbar(header, buttons, existingId) {
      const row = existingId
        ? document.getElementById(existingId)
        : document.createElement('div');

      row.className = 'reading-toolbar';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', 'Reading controls');

      const label = document.createElement('span');
      label.className = 'toolbar-label';
      label.textContent = 'Reading';

      row.append(label);

      // Moving the existing buttons preserves their click handlers.
      buttons.forEach(id => {
        row.append(document.getElementById(id));
      });

      header.append(row);
    }

    toolbar(
      document.querySelector('#albumDetailView .detail-header'),
      ['quoteAutoPlayBtn', 'starFilterBtn']
    );

    toolbar(
      document.querySelector('#flashcardView .detail-header'),
      [
        'shuffleFlashcardsBtn',
        'flipAllBtn',
        'loopToggleBtn',
        'startAutoPlayBtn',
        'starFilterBtnFlash'
      ],
      'flashcardControls'
    );

    ['stackWrapper', 'flashcardStackWrapper'].forEach(id => {
      const root = document.getElementById(id);

      new MutationObserver(() => {
        decorateCards(root);
      }).observe(root, {
        childList: true,
        subtree: true
      });

      decorateCards(root);
    });

    const navigationLabels = [
      ['prevBtn', 'Previous quote'],
      ['nextBtn', 'Next quote'],
      ['flashPrevBtn', 'Previous flashcard'],
      ['flashNextBtn', 'Next flashcard']
    ];

    navigationLabels.forEach(([id, label]) => {
      document.getElementById(id).setAttribute('aria-label', label);
    });
  });
})();
;

// Source: card-studio.js
(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  const safe = value => String(value ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );

  const imageURL = value =>
    typeof value === 'string' &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
      ? value
      : '';

  const color = (value, fallback) =>
    /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;

  const faceStyle = album =>
    '--study-font:' + safe(album.font || 'Inter') +
    ';--study-theme:' + color(album.themeColor, '#2d5847') +
    ';--study-ink:' + color(album.fontColor, '#ffffff');

  const states = {};
  let refreshPreview = () => {};
  let queue = Promise.resolve();

  const originalLivePreview = updateLivePreview;

  updateLivePreview = function () {
    originalLivePreview();
    refreshPreview();
  };

  saveCategories = function () {
    const body = JSON.stringify(categories);

    const task = queue.then(async () => {
      try {
        const response = await fetch('/api/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body
        });

        if (!response.ok) {
          throw new Error('Save rejected: HTTP ' + response.status);
        }

        return true;
      } catch (error) {
        console.error(error);

        showToast(
          'Not saved. Keep this page open. Check the server or reduce image sizes.'
        );

        return false;
      }
    });

    queue = task.then(() => {});
    return task;
  };

  function media(url, text, fontSize) {
    const source = imageURL(url);
    const size = Math.max(
      12,
      Math.min(60, Number(fontSize) || 20)
    );

    return '<div class="study-body' +
      (source ? ' with-image' : '') + '">' +
      (source
        ? '<div class="study-picture"><img src="' +
          source + '" alt="Card illustration"></div>'
        : '') +
      '<div class="study-copy" style="font-size:' +
      size + 'px">' + safe(text) + '</div></div>';
  }

  function actions(card, type) {
    const quote = type === 'quote';
    const starred = Boolean(card.starred);

    const starLabel = starred
      ? 'Unstar this card'
      : 'Star this card';

    const starIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" ' +
      'width="20" height="20" viewBox="0 0 24 24" ' +
      'aria-hidden="true" focusable="false" ' +
      'style="display:block;pointer-events:none">' +
      '<path d="M12 3l2.78 5.63 6.22.9-4.5 4.39 ' +
      '1.06 6.2L12 17.19l-5.56 2.93 1.06-6.2L3 ' +
      '9.53l6.22-.9L12 3z" ' +
      'fill="' + (starred ? '#FFD966' : 'none') + '" ' +
      'stroke="' + (starred ? '#553d08' : 'currentColor') + '" ' +
      'stroke-width="1.7" stroke-linejoin="round"/>' +
      '</svg>';

    return (
      '<div class="' +
      (quote ? 'card' : 'flashcard') +
      '-edit-overlay">' +

      '<button type="button" class="float-btn star-btn" ' +
      'data-id="' + safe(card.id) + '" ' +
      'data-type="' + type + '" ' +
      'aria-pressed="' + starred + '" ' +
      'aria-label="' + starLabel + '" ' +
      'title="' + starLabel + '" ' +
      'style="display:inline-flex;align-items:center;' +
      'justify-content:center;' +
      (starred
        ? 'background:#FFD96626!important;'
        : '') +
      '">' +
      starIcon +
      '</button>' +

      '<button type="button" class="float-btn ' +
      (quote ? 'edit-card-btn' : 'edit-flashcard-btn') +
      '" data-id="' + safe(card.id) + '" ' +
      'aria-label="Edit card">' +
      '<i class="fas fa-edit"></i>' +
      '</button>' +

      '<button type="button" class="float-btn ' +
      (quote ? 'delete-card-btn' : 'delete-flashcard-btn') +
      '" data-id="' + safe(card.id) + '" ' +
      'aria-label="Delete card">' +
      '<i class="fas fa-trash"></i>' +
      '</button>' +

      '</div>'
    );
  }

  getCardInner = function (card, position, total, album) {
    return '<div class="card-inner study-face" style="' +
      faceStyle(album) + '">' +
      '<div class="study-heading">' + safe(album.name) + '</div>' +
      media(card.image, card.text, album.fontSize) +
      '<div class="card-meta">' +
      position + ' / ' + total + '</div>' +
      actions(card, 'quote') + '</div>';
  };

  getFlashcardInner = function (
    card,
    position,
    total,
    album,
    flipped
  ) {
    function face(side, label, text, url) {
      return '<div class="flashcard-' + side +
        ' study-face" style="' + faceStyle(album) + '">' +
        '<div class="study-heading">' + label + '</div>' +
        media(url, text, album.fontSize) +
        '<div class="flashcard-meta">' +
        position + ' / ' + total +
        ' · Tap to flip</div></div>';
    }

    return '<div class="flashcard-stack-card ' +
      (flipped ? 'flipped' : '') +
      '" style="' + faceStyle(album) + '">' +
      '<div class="flashcard-inner">' +
      face('front', 'PROMPT', card.front, card.frontImage) +
      face('back', 'ANSWER', card.back, card.backImage) +
      '</div>' + actions(card, 'flashcard') + '</div>';
  };

  const style = document.createElement('style');

  style.textContent = `
    *, *::before, *::after {
      box-sizing: border-box;
    }

    .btn {
      max-width: 100%;
      white-space: normal;
    }

    .app,
    .detail-header,
    .album-detail-title,
    .modal-controls,
    .flashcard-side {
      min-width: 0;
    }

    .albums-grid {
      grid-template-columns:
        repeat(auto-fill, minmax(min(100%, 205px), 1fr));
      align-items: start;
      gap: 24px;
    }

    .album-folder {
      aspect-ratio: auto !important;
      min-height: 0 !important;
      background: transparent;
      border: 0;
      box-shadow: none;
      overflow: visible;
      display: flex;
      flex-direction: column;
    }

    .album-folder:hover {
      box-shadow: none;
      transform: translateY(-3px);
    }

    .folder-preview {
      width: 100%;
      flex: none;
      min-height: 0;
      aspect-ratio: 1;
      position: relative;
      overflow: hidden;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 6px 14px #28352f18;
      background-image:
        linear-gradient(145deg, #ffffff20, #00000018) !important;
      align-items: center;
      justify-content: center;
    }

    .album-cover-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .album-monogram {
      font: 600 clamp(16px, 2.3vw, 26px)
        Inter, 'Noto Sans Myanmar', sans-serif;
      line-height: 1.5;
      position: relative;
      pointer-events: none;
      text-align: center;
      overflow-wrap: anywhere;
      max-width: 100%;
      max-height: 100%;
      overflow: auto;
    }

    .album-caption {
      padding: 13px 2px 0;
      min-width: 0;
    }

    .folder-name-large {
      font-family:
        Inter, 'Noto Sans Myanmar', sans-serif !important;
      color: var(--ink) !important;
      font-size: 15px !important;
      line-height: 1.55;
      margin: 0;
      overflow-wrap: anywhere;
      white-space: normal;
      text-align: left;
      font-weight: 600;
    }

    .folder-quote-count {
      color: var(--muted);
      background: transparent;
      margin: 5px 0 0;
      padding: 0;
      font-size: 12px;
      display: block;
      position: static;
      line-height: 1.5;
    }

    .folder-info {
      background: transparent;
      padding: 8px 0 0;
      flex: none;
    }

    .folder-actions {
      justify-content: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }

    .folder-action-btn {
      padding: 4px 0;
      font-size: 11px;
    }

    .study-face {
      background: var(--study-theme, #2d5847) !important;
      color: var(--study-ink, #fff) !important;
      font-family:
        var(--study-font, Inter),
        'Noto Sans Myanmar',
        'Noto Sans JP',
        sans-serif !important;
      padding: 64px 24px !important;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      border: 1px solid #d7dbd0;
      text-align: center;
      overflow: hidden;
    }

    .study-face::before,
    .study-face::after,
    .study-face > .card-eyebrow {
      display: none !important;
    }

    .flashcard-back.study-face {
      background: var(--study-theme, #2d5847) !important;
    }

    .study-heading {
      position: absolute;
      top: 22px;
      left: 24px;
      right: 24px;
      font: 11px Inter, sans-serif;
      letter-spacing: 1.6px;
      color: inherit;
      opacity: .75;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: left;
      text-transform: uppercase;
    }

    .study-body {
      width: 100%;
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 18px;
      overflow: hidden;
    }

    .study-picture {
      flex: 1 1 58%;
      min-height: 0;
      background: #f1efe7;
      border-radius: 9px;
      overflow: hidden;
      padding: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .study-picture img {
      display: block;
      max-width: 100%;
      max-height: 100%;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .study-copy {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      overflow: auto;
      max-height: 100%;
      min-height: 0;
      line-height: 1.6;
      font-weight: 500;
      text-align: center;
    }

    .with-image .study-copy {
      flex: 0 1 35%;
      max-height: 40%;
    }

    .study-face .card-meta,
    .study-face .flashcard-meta {
      left: 24px;
      bottom: 29px;
      max-width: calc(100% - 185px);
      overflow: hidden;
      font-size: 11px;
      text-align: left;
    }

    .card-edit-overlay,
    .flashcard-edit-overlay {
      right: 18px;
      bottom: 17px;
      background: #00000018;
    }

    .float-btn {
      color: var(--study-ink, #fff) !important;
      background: transparent;
      width: 34px;
      height: 34px;
    }

    .float-btn:hover {
      background: #00000025;
    }

    .card-stack-wrapper,
    .flashcard-stack-wrapper {
      width: 100%;
      max-width: 650px;
      height: clamp(280px, 65svh, 530px) !important;
    }

    .stack-deck,
    .flashcard-deck {
      padding: 0 8px 20px;
    }

    .auto-play-settings {
      background: #fffdf8;
      border: 1px solid #d7dbd0;
      padding: 18px;
      border-radius: 12px;
      margin: 0 0 24px;
      gap: 14px;
      flex-wrap: wrap;
    }

    .timer-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      max-width: 520px;
    }

    .timer-setting {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 7px;
      margin: 0;
      min-width: 0;
    }

    .timer-setting label {
      color: #52614e;
      font-size: 12px;
      line-height: 1.5;
    }

    .timer-setting input {
      width: 100% !important;
      max-width: none !important;
      background: #f4f1e9;
      color: #28352f;
      border: 1px solid #d7dbd0;
      border-radius: 7px;
      padding: 9px 12px;
      font: 14px Inter, sans-serif;
    }

    .auto-play-options {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      margin: 14px 0;
      color: #52614e;
      font-size: 12px;
    }

    .auto-play-options label {
      color: #52614e;
      display: flex;
      gap: 7px;
      align-items: center;
    }

    .auto-play-actions,
    .auto-play-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 14px;
    }

    .auto-play-active {
      padding: 12px 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }

    .modal {
      padding: 16px !important;
      align-items: center !important;
      overflow: auto;
    }

    .modal-content {
      width: min(100%, 600px) !important;
      max-width: 600px !important;
      max-height: calc(100svh - 32px) !important;
      overflow-y: auto !important;
      padding: 22px !important;
      margin: auto !important;
    }

    .modal-large {
      width: min(100%, 720px) !important;
      max-width: 720px !important;
    }

    .modal-content h3 {
      font-size: 20px;
      margin: 0 0 18px;
    }

    .modal-two-columns {
      display: block !important;
    }

    .modal-preview {
      display: none !important;
    }

    .modal-controls {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    #catName,
    .album-type-select,
    .font-preview,
    .font-size-control,
    .modal-controls > .modal-actions {
      grid-column: 1 / -1;
    }

    .modal-controls > div {
      margin: 0 !important;
      min-width: 0;
    }

    .color-preview,
    .font-preview,
    .album-type-select {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 7px;
    }

    .modal-content input[type=color] {
      width: 100% !important;
      height: 40px !important;
      padding: 4px;
      border: 1px solid #d7dbd0;
      border-radius: 7px;
      background: #f4f1e9;
    }

    .modal-content input[type=text],
    .modal-content textarea,
    .modal-content select {
      width: 100%;
      min-width: 0;
      padding: 10px 12px !important;
      border-radius: 7px;
      font-size: 14px !important;
      margin: 0;
    }

    .modal-content textarea {
      min-height: 88px;
      max-height: 170px;
      resize: vertical;
    }

    .font-size-control {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .font-size-control input {
      flex: 1;
      min-width: 90px;
    }

    .custom-dropdown {
      width: 100%;
      min-width: 0;
    }

    .custom-dropdown-trigger {
      background: #f4f1e9 !important;
      color: #28352f !important;
      padding: 10px 12px !important;
      border-radius: 7px !important;
      border: 1px solid #d7dbd0;
      white-space: normal;
      font-size: 14px;
    }

    .custom-dropdown-list {
      max-height: 180px !important;
      overflow: auto;
      background: #fffdf8 !important;
      color: #28352f !important;
    }

    .custom-dropdown-option {
      color: #28352f !important;
      white-space: normal;
    }

    .modal-actions {
      position: sticky;
      bottom: -22px;
      background: #fffdf8;
      padding: 14px 0 0;
      margin-top: 16px;
      z-index: 5;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
    }

    .flashcard-editor {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .flashcard-side label,
    .upload-title {
      font-size: 12px;
      color: #52614e;
      display: block;
      margin-bottom: 8px;
    }

    .image-upload {
      margin-top: 12px;
      border: 1px dashed #bcc6b5;
      border-radius: 8px;
      padding: 12px;
      background: #f7f6f0;
      min-width: 0;
    }

    .image-upload input {
      font-size: 12px !important;
      width: 100%;
      max-width: 100%;
      padding: 0 !important;
      background: transparent !important;
      border: 0 !important;
    }

    .image-upload img {
      display: block;
      width: 100%;
      height: 110px;
      object-fit: contain;
      margin: 10px 0;
      background: #eeeee5;
      border-radius: 6px;
      pointer-events: none;
    }

    .image-upload button {
      border: 0;
      background: transparent;
      color: #9b4639;
      font: 12px Inter, sans-serif;
      cursor: pointer;
      padding: 6px 0;
    }

    .cover-upload,
    .theme-preview {
      grid-column: 1 / -1;
    }

    .theme-preview {
      position: sticky;
      top: 0;
      z-index: 4;
      background: #fffdf8;
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      padding: 12px;
      border: 1px solid #d7dbd0;
      border-radius: 9px;
    }

    .preview-title {
      display: block;
      font: 11px Inter, sans-serif;
      color: #737b73;
      margin-bottom: 7px;
    }

    .live-cover,
    .live-card {
      height: 110px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow: auto;
      overflow-wrap: anywhere;
      padding: 14px;
      line-height: 1.5;
    }

    .live-cover {
      position: relative;
      font-size: 18px;
      font-weight: 600;
    }

    .live-cover img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .image-upload .studio-file {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      clip-path: inset(50%);
      overflow: hidden;
    }

    .image-upload .drop-zone {
      display: flex;
      width: 100%;
      flex-direction: column;
      align-items: center;
      gap: 7px;
      padding: 16px 10px;
      background: #eeeee5;
      border: 1px dashed #aab8a1;
      border-radius: 8px;
      color: #43553b;
      font-family: Inter, sans-serif;
      text-align: center;
    }

    .drop-zone > span {
      font-size: 24px;
    }

    .drop-zone strong {
      font-size: 13px;
    }

    .drop-zone small {
      font-size: 11px;
      line-height: 1.5;
    }

    .image-upload .drop-zone:hover,
    .image-upload .drop-zone.drag-active {
      background: #e1ead9;
      border-color: #2d5847;
    }

    .drop-zone:focus-visible {
      outline: 3px solid #b98637;
      outline-offset: 2px;
    }

    .upload-note {
      font-size: 11px;
      color: #737b73;
      line-height: 1.5;
      margin: 7px 0 0;
    }

    @media (max-width: 600px) {
      .albums-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px 12px;
      }

      .folder-name-large {
        font-size: 13px !important;
      }

      .album-monogram {
        font-size: 18px;
      }

      .flashcard-editor {
        grid-template-columns: 1fr;
      }

      .modal-content {
        padding: 18px !important;
      }

      .modal-actions {
        bottom: -18px;
      }

      .study-face {
        padding: 64px 18px !important;
      }

      .study-heading {
        left: 18px;
      }

      .study-face .card-meta,
      .study-face .flashcard-meta {
        left: 18px;
      }

      .timer-grid {
        grid-template-columns: 1fr;
      }

      .study-copy {
        line-height: 1.5;
      }
    }

    @media (max-width: 300px) {
      .albums-grid,
      .modal-controls {
        grid-template-columns: 1fr;
      }

      .card-edit-overlay,
      .flashcard-edit-overlay {
        right: 8px;
      }

      .float-btn {
        width: 29px;
      }

      .study-face .card-meta,
      .study-face .flashcard-meta {
        max-width: calc(100% - 130px);
      }
    }
  `;

  document.head.append(style);

  function imageControl(key, parent, title) {
    const box = document.createElement('div');
    box.className = 'image-upload';

    box.innerHTML =
      '<span class="upload-title">' + title + '</span>' +
      '<input id="' + key +
      'File" class="studio-file" type="file" ' +
      'accept="image/png,image/jpeg,image/webp" ' +
      'aria-label="' + title + '">' +
      '<button type="button" class="drop-zone">' +
      '<span aria-hidden="true">＋</span>' +
      '<strong>Drop a picture here</strong>' +
      '<small>or click to browse · PNG, JPEG, WebP</small>' +
      '</button>' +
      '<img hidden alt="Selected image preview">' +
      '<button class="remove-image" type="button" hidden>' +
      'Remove image</button>' +
      '<p class="upload-note" role="status">' +
      'Optional · Images are resized before saving.</p>';

    parent.append(box);

    const state = states[key] = {
      value: '',
      busy: false,
      generation: 0,
      box
    };

    const input = box.querySelector('input');
    const preview = box.querySelector('img');
    const remove = box.querySelector('.remove-image');
    const note = box.querySelector('.upload-note');
    const drop = box.querySelector('.drop-zone');

    state.set = value => {
      state.generation++;
      state.busy = false;
      state.value = imageURL(value);

      input.value = '';
      preview.src = state.value || '';
      preview.hidden = !state.value;
      remove.hidden = !state.value;

      note.textContent =
        'Optional · Images are resized before saving.';

      refreshPreview();
    };

    remove.onclick = () => state.set('');
    drop.onclick = () => input.click();

    ['dragenter', 'dragover'].forEach(event => {
      drop.addEventListener(event, e => {
        e.preventDefault();
        drop.classList.add('drag-active');
      });
    });

    drop.addEventListener('dragleave', () => {
      drop.classList.remove('drag-active');
    });

    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('drag-active');

      if (e.dataTransfer.files.length !== 1) {
        note.textContent = 'Please drop one picture at a time.';
        return;
      }

      upload(e.dataTransfer.files[0]);
    });

    input.onchange = () => upload(input.files[0]);

    async function upload(file) {
      if (!file) return;

      const generation = ++state.generation;
      state.busy = true;
      note.textContent = 'Preparing image…';

      try {
        const allowed = [
          'image/png',
          'image/jpeg',
          'image/webp'
        ];

        if (
          !allowed.includes(file.type) ||
          file.size > 8 * 1024 * 1024
        ) {
          throw new Error(
            'Choose a PNG, JPEG or WebP under 8 MB.'
          );
        }

        const url = URL.createObjectURL(file);
        let img;

        try {
          img = await new Promise((resolve, reject) => {
            const picture = new Image();

            picture.onload = () => resolve(picture);

            picture.onerror = () => reject(
              new Error('This image could not be opened.')
            );

            picture.src = url;
          });
        } finally {
          URL.revokeObjectURL(url);
        }

        const canvas = document.createElement('canvas');

        const ratio = Math.min(
          1,
          1000 / Math.max(img.width, img.height)
        );

        canvas.width = Math.max(
          1,
          Math.round(img.width * ratio)
        );

        canvas.height = Math.max(
          1,
          Math.round(img.height * ratio)
        );

        canvas.getContext('2d').drawImage(
          img,
          0,
          0,
          canvas.width,
          canvas.height
        );

        let data = canvas.toDataURL('image/webp', .78);

        if (data.length > 300000) {
          canvas.width = Math.max(
            1,
            Math.round(img.width * ratio * .65)
          );

          canvas.height = Math.max(
            1,
            Math.round(img.height * ratio * .65)
          );

          canvas.getContext('2d').drawImage(
            img,
            0,
            0,
            canvas.width,
            canvas.height
          );

          data = canvas.toDataURL('image/webp', .65);
        }

        if (data.length > 400000) {
          throw new Error(
            'Image is too detailed. Choose a smaller image.'
          );
        }

        if (generation !== state.generation) return;

        state.set(data);
        note.textContent = 'Image ready to save.';
      } catch (error) {
        if (generation === state.generation) {
          state.busy = false;
          input.value = '';
          note.textContent = error.message;
        }
      }
    }
  }

  const originalShow = showModal;

  showModal = function (id) {
    if (id === 'cardModal' && states.quote) {
      const album = categories.find(
        item => item.id === selectedCategoryId
      );

      const card = album?.cards.find(
        item => item.id === $('editCardId').value
      );

      states.quote.set(card?.image);
    }

    if (id === 'flashcardModal' && states.front) {
      const card = flashcardCategory?.cards.find(
        item => item.id === $('editFlashcardId').value
      );

      states.front.set(card?.frontImage);
      states.back.set(card?.backImage);
    }

    if (id === 'categoryModal' && states.cover) {
      const album = categories.find(
        item => item.id === $('editCatId').value
      );

      states.cover.set(album?.coverImage);
      refreshPreview();
    }

    originalShow(id);
  };

  async function saveCard(type) {
    const flash = type === 'flashcard';
    const keys = flash ? ['front', 'back'] : ['quote'];

    if (keys.some(key => states[key].busy)) {
      showToast(
        'Please wait for the image to finish preparing.'
      );
      return;
    }

    const album = flash
      ? flashcardCategory
      : categories.find(item => item.id === selectedCategoryId);

    if (!album) return;

    const edit = flash
      ? $('editFlashcardId')
      : $('editCardId');

    const front = flash
      ? $('flashcardFrontText').value.trim()
      : $('quoteText').value.trim();

    const back = flash
      ? $('flashcardBackText').value.trim()
      : '';

    if (!front && !states[keys[0]].value) {
      showToast(
        'Add text or an image' +
        (flash ? ' on the front.' : '.')
      );
      return;
    }

    if (flash && !back && !states.back.value) {
      showToast('Add text or an image on the back.');
      return;
    }

    const button = $(
      flash ? 'confirmFlashcardBtn' : 'confirmCardBtn'
    );

    if (button.disabled) return;
    button.disabled = true;

    const before = JSON.parse(JSON.stringify(album.cards));

    try {
      let card = album.cards.find(
        item => item.id === edit.value
      );

      if (!card) {
        card = {
          id: 'card_' + Date.now() + '_' +
            Math.random().toString(36).slice(2, 8),
          starred: false
        };

        album.cards.push(card);
      }

      if (flash) {
        Object.assign(card, {
          front,
          back,
          frontImage: states.front.value,
          backImage: states.back.value
        });
      } else {
        Object.assign(card, {
          text: front,
          image: states.quote.value
        });
      }

      if (!await saveCategories()) {
        album.cards = before;
        return;
      }

      const index = album.cards.findIndex(
        item => item.id === card.id
      );

      if (flash) {
        flashcardOrder = album.cards.map((_, i) => i);
        currentFlashcardIdx = index;
        isFlipped = false;
        renderFlashcardStack();
      } else {
        currentOrder = album.cards.map((_, i) => i);
        currentCardIdx = index;
        renderStackedDeck();
      }

      hideModal(flash ? 'flashcardModal' : 'cardModal');
      renderAlbums();
      updateStarFilterButtons();
      showToast('Card saved');
    } finally {
      button.disabled = false;
    }
  }

  addOrUpdateQuoteCard = () => saveCard('quote');
  addOrUpdateFlashcard = () => saveCard('flashcard');

  createOrUpdateCategory = async function () {
    if (states.cover.busy) {
      showToast('Please wait for the cover image.');
      return;
    }

    const button = $('confirmCatBtn');

    if (button.disabled) return;
    button.disabled = true;

    const id = $('editCatId').value;
    let album = categories.find(item => item.id === id);

    const previous = album
      ? JSON.parse(JSON.stringify(album))
      : null;

    try {
      if (!album) {
        album = {
          id: 'cat_' + Date.now() + '_' +
            Math.random().toString(36).slice(2, 7),
          cards: []
        };

        categories.push(album);
      }

      Object.assign(album, {
        name: $('catName').value.trim() || 'Untitled',
        themeColor: $('themeColor').value,
        fontColor: $('fontColor').value,
        font: $('categoryFont').value,
        type: $('albumType').value,
        fontSize: Number($('fontSize').value) || 20,
        coverImage: states.cover.value
      });

      if (!await saveCategories()) {
        if (previous) {
          Object.assign(album, previous);
        } else {
          categories.splice(categories.indexOf(album), 1);
        }

        return;
      }

      hideModal('categoryModal');
      renderAlbums();

      if (
        selectedCategoryId === album.id ||
        flashcardCategory?.id === album.id
      ) {
        selectCategory(album.id);
      }

      showToast('Album saved');
    } finally {
      button.disabled = false;
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const controls = $('categoryModal')
      .querySelector('.modal-controls');

    imageControl(
      'cover',
      controls,
      'Album cover (optional)'
    );

    states.cover.box.classList.add('cover-upload');

    controls.querySelector('.modal-actions')
      .before(states.cover.box);

    const preview = document.createElement('section');
    preview.className = 'theme-preview';

    preview.setAttribute(
      'aria-label',
      'Live album and card preview'
    );

    preview.innerHTML =
      '<div><span class="preview-title">Album cover</span>' +
      '<div class="live-cover"></div></div>' +
      '<div><span class="preview-title">Card preview</span>' +
      '<div class="live-card">' +
      'A thought to keep.<br>学ぶ · သင်ယူပါ' +
      '</div></div>';

    controls.before(preview);

    refreshPreview = () => {
      const name = $('catName').value.trim() || 'Album name';
      const theme = $('themeColor').value;
      const ink = $('fontColor').value;

      const cover = preview.querySelector('.live-cover');
      const card = preview.querySelector('.live-card');

      cover.replaceChildren();

      if (states.cover.value) {
        const img = document.createElement('img');
        img.src = states.cover.value;
        img.alt = 'Album cover preview';
        cover.append(img);
      } else {
        const label = document.createElement('span');
        label.textContent = name;
        cover.append(label);
      }

      [cover, card].forEach(node => {
        node.style.backgroundColor = theme;
        node.style.color = ink;
        node.style.fontFamily = $('categoryFont').value;
      });

      card.style.fontSize =
        (Number($('fontSize').value) || 20) + 'px';
    };

    [
      'catName',
      'themeColor',
      'fontColor',
      'categoryFont',
      'fontSize'
    ].forEach(id => {
      ['input', 'change'].forEach(event => {
        $(id).addEventListener(event, refreshPreview);
      });
    });

    $('confirmCatBtn').onclick = createOrUpdateCategory;
    refreshPreview();

    imageControl(
      'quote',
      $('quoteText').parentElement,
      'Picture (optional)'
    );

    $('quoteText').after(states.quote.box);

    imageControl(
      'front',
      $('flashcardFrontText').parentElement,
      'Front picture (optional)'
    );

    imageControl(
      'back',
      $('flashcardBackText').parentElement,
      'Back picture (optional)'
    );

    $('confirmCardBtn').onclick = addOrUpdateQuoteCard;
    $('confirmFlashcardBtn').onclick = addOrUpdateFlashcard;

    [
      'autoPlaySettings',
      'quoteAutoPlaySettings'
    ].forEach(id => {
      const panel = $(id);
      const grid = document.createElement('div');
      grid.className = 'timer-grid';

      panel.querySelectorAll('.timer-setting').forEach(item => {
        grid.append(item);
      });

      panel.prepend(grid);
    });

    function covers() {
      document.querySelectorAll('.album-folder').forEach(folder => {
        if (folder.dataset.studio) return;
        folder.dataset.studio = 'true';

        const album = categories.find(
          item => item.id === folder.dataset.id
        );

        if (!album) return;

        const cover = folder.querySelector('.folder-preview');
        const name = folder.querySelector('.folder-name-large');
        const count = folder.querySelector('.folder-quote-count');

        const caption = document.createElement('div');
        caption.className = 'album-caption';
        caption.append(name, count);
        cover.after(caption);

        const picture = imageURL(album.coverImage);

        if (picture) {
          const img = document.createElement('img');
          img.className = 'album-cover-image';
          img.src = picture;
          img.alt = '';
          cover.append(img);
        } else {
          const label = document.createElement('span');
          label.className = 'album-monogram';
          label.textContent = album.name;
          label.style.color = color(album.fontColor, '#fff');
          cover.append(label);
        }
      });
    }

    new MutationObserver(covers).observe(
      $('categoriesContainer'),
      { childList: true }
    );

    covers();
  });
})();
;

// Source: card-finish.js
(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  const patterns = [
    'repeating-linear-gradient(135deg,transparent 0 28px,rgba(255,255,255,.07) 28px 29px,transparent 29px 56px)',
    'radial-gradient(ellipse at 110% -20%,transparent 0 38%,rgba(255,255,255,.12) 38% 39%,transparent 39% 48%,rgba(255,255,255,.08) 48% 49%,transparent 49%)',
    'radial-gradient(circle at 12% 18%,rgba(255,255,255,.08) 0 3px,transparent 4px),radial-gradient(circle at 87% 78%,transparent 0 75px,rgba(255,255,255,.1) 76px 78px,transparent 79px)',
    'linear-gradient(155deg,rgba(255,255,255,.09) 0 23%,transparent 23% 77%,rgba(0,0,0,.05) 77%)',
    'repeating-linear-gradient(0deg,transparent 0 44px,rgba(255,255,255,.05) 44px 45px,transparent 45px 88px)'
  ];

  function patternFor(id) {
    let hash = 0;

    for (const character of String(id || '')) {
      hash = (hash * 31 + character.codePointAt(0)) >>> 0;
    }

    return hash % patterns.length;
  }

  function decorate(html, card, flash) {
    let side = 0;

    return html
      .replace(
        /study-face/g,
        'study-face finish-pattern-' + patternFor(card.id)
      )
      .replace(/class="study-body([^"]*)"/g, (match, classes) => {
        const text = flash
          ? (side++ === 0 ? card.front : card.back)
          : card.text;

        const imageOnly =
          classes.includes('with-image') &&
          !String(text || '').trim();

        return 'class="study-body' + classes +
          (imageOnly ? ' image-only' : '') + '"';
      });
  }

  const quoteRenderer = getCardInner;
  getCardInner = (...args) =>
    decorate(quoteRenderer(...args), args[0], false);

  const flashRenderer = getFlashcardInner;
  getFlashcardInner = (...args) =>
    decorate(flashRenderer(...args), args[0], true);

  const style = document.createElement('style');

  style.textContent = `
    .album-search input:focus,
    .album-search input:focus-visible {
      outline:none!important;
      box-shadow:none!important;
      border:0!important;
    }

    .album-search:focus-within {
      border-color:#a5ada2;
      box-shadow:0 0 0 1px #a5ada230;
    }

    .study-face {
      background-image:var(--finish-pattern)!important;
      background-size:100% 100%!important;
      background-repeat:no-repeat!important;
    }

    .study-picture {
      background:transparent!important;
      padding:0!important;
      border-radius:0;
      overflow:hidden;
    }

    .study-picture img {
      width:auto!important;
      height:auto!important;
      max-width:100%;
      max-height:100%;
      object-fit:contain;
      border-radius:10px;
      box-shadow:0 8px 22px #00000018;
    }

    .study-body.with-image {
      gap:20px;
    }

    .study-copy {
      color:inherit!important;
      text-align:center!important;
      line-height:1.95!important;
      padding:.3em .12em .45em;
      box-sizing:border-box;
    }

    .folder-name-large,
    .album-monogram {
      line-height:1.8!important;
      padding-bottom:.2em;
    }

    .live-card,
    .live-cover {
      line-height:1.9;
      padding:12px 10px 18px;
    }

    .card-meta,
    .flashcard-meta {
      line-height:1.8;
    }

    .image-only {
      gap:0!important;
      align-items:center;
      justify-content:center;
    }

    .image-only .study-copy {
      display:none!important;
    }

    .image-only .study-picture {
      flex:1 1 100%;
      width:100%;
      height:100%;
      min-height:0;
      align-items:center;
      justify-content:center;
    }

    .image-only .study-picture img {
      width:100%!important;
      height:100%!important;
      object-fit:contain;
      box-shadow:none;
    }

    .live-card {
      background-image:var(--finish-pattern);
      background-size:100% 100%;
      color:var(--preview-ink)!important;
    }

    .live-cover {
      color:var(--preview-ink)!important;
    }

    .color-preview>input[type=color] {
      display:block!important;
      width:100%!important;
      height:40px!important;
      cursor:pointer;
    }

    .color-preview>input[type=color]:focus-visible {
      outline:2px solid #a5ada2;
      outline-offset:2px;
    }

    .stack-card,
    .flashcard-stack-card {
      animation:none!important;
      transition:transform 520ms ease,opacity 520ms ease;
      will-change:auto;
    }

    .stack-card.top-card,
    .flashcard-stack-card.top-card {
      transform:none;
    }

    .stack-card.next-card,
    .flashcard-stack-card.next-card {
      transform:translateY(9px) scale(.985);
      opacity:.75;
      filter:none;
      pointer-events:none;
    }

    .stack-card.prev-card,
    .flashcard-stack-card.prev-card {
      transform:translateY(18px) scale(.97);
      opacity:.5;
      filter:none;
      pointer-events:none;
    }

    .next-card .study-face>*,
    .prev-card .study-face>*,
    .next-card>.flashcard-edit-overlay,
    .prev-card>.flashcard-edit-overlay {
      visibility:hidden;
    }

    .flashcard-inner {
      transition:transform 520ms ease-in-out!important;
    }

    @media(prefers-reduced-motion:reduce) {
      .stack-card,
      .flashcard-stack-card,
      .flashcard-inner {
        animation:none!important;
        transition:none!important;
      }
    }
  ` + patterns.map((pattern, index) =>
    '.finish-pattern-' + index +
    '{--finish-pattern:' + pattern + '}'
  ).join('\n');

  document.head.append(style);

  function syncPreview() {
    const preview = document.querySelector('.theme-preview');
    if (!preview) return;

    const ink = $('fontColor').value;

    preview.querySelectorAll('.live-card,.live-cover')
      .forEach(node => {
        node.style.setProperty('--preview-ink', ink);
        node.style.color = ink;
        node.style.backgroundColor = $('themeColor').value;
      });

    const card = preview.querySelector('.live-card');
    card.textContent = 'Every day is a chance to learn.';

    card.style.setProperty(
      '--finish-pattern',
      patterns[patternFor($('editCatId').value || 'preview')]
    );
  }

  const livePreview = updateLivePreview;

  updateLivePreview = function () {
    livePreview();
    syncPreview();
  };

  let previewFrame = null;
  let previousValues = '';

  function watchPreview() {
    if ($('categoryModal').style.display !== 'flex') {
      previewFrame = null;
      return;
    }

    const values = [
      $('themeColor').value,
      $('fontColor').value
    ].join('|');

    if (values !== previousValues) {
      previousValues = values;
      updateLivePreview();
    }

    previewFrame = requestAnimationFrame(watchPreview);
  }

  const openModal = showModal;

  showModal = function (id) {
    openModal(id);

    if (id === 'categoryModal') {
      syncPreview();
      previousValues = '';

      if (previewFrame === null) {
        previewFrame = requestAnimationFrame(watchPreview);
      }
    }
  };

  const transitions = new Map();
  let navigationDirection = 0;

  function navigation(action, direction, wrapperId) {
    return function (...args) {
      transitions.get(wrapperId)?.finish();

      navigationDirection = direction;

      try {
        return action.apply(this, args);
      } finally {
        navigationDirection = 0;
      }
    };
  }

  nextCard = navigation(nextCard, 1, 'stackWrapper');
  prevCard = navigation(prevCard, -1, 'stackWrapper');

  nextFlashcard = navigation(
    nextFlashcard,
    1,
    'flashcardStackWrapper'
  );

  prevFlashcard = navigation(
    prevFlashcard,
    -1,
    'flashcardStackWrapper'
  );

  function smoothRender(renderer, wrapperId) {
    return function (...args) {
      const wrapper = $(wrapperId);

      if (!wrapper) {
        return renderer.apply(this, args);
      }

      transitions.get(wrapperId)?.finish();

      const old = wrapper.querySelector('.top-card');
      const oldId = old?.querySelector('.star-btn')?.dataset.id;
      const wasFlipped = !!old?.querySelector('.flipped');
      const clone = old?.cloneNode(true);

      const result = renderer.apply(this, args);

      const current = wrapper.querySelector('.top-card');
      const currentId =
        current?.querySelector('.star-btn')?.dataset.id;

      if (
        !old ||
        !current ||
        args[0] ||
        matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return result;
      }

      if (oldId === currentId) {
        const flipped = !!current.querySelector('.flipped');
        const inner = current.querySelector('.flashcard-inner');

        if (inner && flipped !== wasFlipped) {
          inner.animate([
            {
              transform:
                'rotateY(' + (wasFlipped ? 180 : 0) + 'deg)'
            },
            {
              transform:
                'rotateY(' + (flipped ? 180 : 0) + 'deg)'
            }
          ], {
            duration: 600,
            easing: 'cubic-bezier(.25,.1,.25,1)'
          });
        }

        return result;
      }

      if (!navigationDirection) return result;

      const distance = Math.min(
        150,
        Math.max(75, wrapper.clientHeight * .28)
      );

      clone.classList.remove('top-card');
      clone.setAttribute('aria-hidden', 'true');
      clone.inert = true;

      Object.assign(clone.style, {
        zIndex: '30',
        pointerEvents: 'none',
        animation: 'none',
        transition: 'none',
        transform: 'none',
        opacity: '1'
      });

      current.style.zIndex = '21';
      wrapper.append(clone);

      const options = {
        duration: 780,
        easing: 'cubic-bezier(.4,0,.2,1)',
        fill: 'both'
      };

      let animations;

      if (navigationDirection > 0) {
        animations = [
          clone.animate([
            {
              offset: 0,
              transform: 'translateY(0) rotate(0deg)',
              zIndex: 30
            },
            {
              offset: .5,
              transform:
                'translateY(' + distance + 'px) rotate(2deg)',
              zIndex: 30
            },
            {
              offset: .501,
              transform:
                'translateY(' + distance + 'px) rotate(2deg)',
              zIndex: 1
            },
            {
              offset: 1,
              transform:
                'translateY(18px) scale(.97) rotate(0deg)',
              zIndex: 1
            }
          ], options),

          current.animate([
            {
              transform: 'translateY(9px) scale(.985)'
            },
            {
              transform: 'translateY(0) scale(1)'
            }
          ], options)
        ];
      } else {
        clone.style.zIndex = '20';

        animations = [
          current.animate([
            {
              offset: 0,
              transform:
                'translateY(' + distance +
                'px) scale(.98) rotate(-2deg)'
            },
            {
              offset: .65,
              transform:
                'translateY(-7px) scale(1) rotate(.4deg)'
            },
            {
              offset: 1,
              transform:
                'translateY(0) scale(1) rotate(0deg)'
            }
          ], options)
        ];
      }

      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;

        animations.forEach(animation => animation.cancel());
        clone.remove();
        current.style.zIndex = '';
        transitions.delete(wrapperId);
      };

      transitions.set(wrapperId, { finish });

      Promise.all(
        animations.map(animation => animation.finished)
      ).then(finish, () => {});

      return result;
    };
  }

  renderStackedDeckInternal = smoothRender(
    renderStackedDeckInternal,
    'stackWrapper'
  );

  renderFlashcardStackInternal = smoothRender(
    renderFlashcardStackInternal,
    'flashcardStackWrapper'
  );

  document.addEventListener('DOMContentLoaded', () => {
    $('nextBtn').onclick = nextCard;
    $('prevBtn').onclick = prevCard;
    $('flashNextBtn').onclick = nextFlashcard;
    $('flashPrevBtn').onclick = prevFlashcard;

    [
      'catName',
      'themeColor',
      'fontColor',
      'categoryFont',
      'fontSize'
    ].forEach(id => {
      ['input', 'change'].forEach(event => {
        $(id).addEventListener(event, updateLivePreview);
      });
    });

    syncPreview();
  });
})();
;

// Source: frame-layout.js
(() => {
  'use strict';

  const style = document.createElement('style');

  style.textContent = `
    body.study-frame {
      padding: 12px !important;
      overflow: hidden;
    }

    .study-frame .app {
      height: calc(var(--frame-height, 100dvh) - 24px);
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .study-frame .header {
      flex: none;
      padding: 0 0 10px;
      margin: 0 0 12px;
    }

    .study-frame .logo h1 {
      font-size: 24px;
    }

    .study-frame .logo p {
      font-size: 11px;
      margin-top: 4px;
    }

    .study-frame .frame-active {
      display: flex !important;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      padding: 0 !important;
    }

    .study-frame .detail-header {
      flex: none;
      gap: 10px;
      margin: 0 0 10px;
    }

    .study-frame .current-cat-title {
      font-size: 23px;
    }

    .study-frame .btn {
      min-height: 34px;
      padding: 7px 11px;
      font-size: 12px;
    }

    .study-frame .reading-toolbar {
      padding-top: 9px;
      gap: 7px;
    }

    .study-frame .stack-deck,
    .study-frame .flashcard-deck {
      flex: 1;
      min-height: 0;
      margin: 0;
      padding: 12px 14px 24px;
      overflow: hidden;
      display: flex;
      justify-content: center;
    }

    .study-frame .card-stack-wrapper,
    .study-frame .flashcard-stack-wrapper {
      height: 100% !important;
      min-height: 0;
      max-height: 100%;
      width: min(100%, 650px);
      margin: 0 auto;
    }

    .study-frame .nav-controls,
    .study-frame .flashcard-nav {
      flex: none;
      margin: 8px 0 0;
      gap: 18px;
    }

    .study-frame .nav-btn {
      width: 38px;
      height: 38px;
    }

    .study-frame .keyboard-hint {
      flex: none;
      margin: 6px 0 0;
      padding: 0;
      font-size: 10px;
      line-height: 1.4;
    }

    .study-frame .study-face {
      padding: 44px 20px 58px !important;
    }

    .study-frame .study-heading {
      top: 16px;
      left: 20px;
    }

    .study-frame .study-copy {
      max-height: 100%;
      overflow: auto;
    }

    .study-frame .auto-play-settings {
      flex: none;
      margin: 0 0 8px;
      padding: 12px;
      max-height: 28dvh;
      overflow: auto;
    }

    .study-frame .auto-play-active {
      flex: none;
      margin: 0 0 8px;
      padding: 8px 12px;
    }

    .study-frame .auto-play-actions,
    .study-frame .auto-play-buttons {
      margin-top: 7px;
    }

    @media (max-width: 600px) {
      .study-frame .header {
        margin-bottom: 8px;
        padding-bottom: 8px;
      }

      .study-frame .logo p {
        display: none;
      }

      .study-frame .logo h1 {
        font-size: 20px;
      }

      .study-frame .detail-header {
        grid-template-columns: auto 1fr;
        gap: 7px;
        margin-bottom: 5px;
      }

      .study-frame .album-detail-title {
        justify-self: end;
        gap: 5px;
      }

      .study-frame .current-cat-title {
        font-size: 18px;
      }

      .study-frame .album-type-badge {
        font-size: 10px;
      }

      .study-frame .card-actions-group {
        grid-column: 1 / -1;
        gap: 6px;
      }

      .study-frame .reading-toolbar {
        padding-top: 7px;
        gap: 5px;
      }

      .study-frame .toolbar-label {
        display: none;
      }

      .study-frame .btn {
        font-size: 11px;
        padding: 6px 8px;
        min-height: 30px;
      }

      .study-frame .stack-deck,
      .study-frame .flashcard-deck {
        padding: 8px 5px 22px;
      }

      .study-frame .keyboard-hint {
        display: none;
      }
    }

    @media (max-height: 560px) {
      .study-frame .logo p,
      .study-frame .keyboard-hint {
        display: none;
      }

      .study-frame .header {
        margin-bottom: 6px;
        padding-bottom: 6px;
      }

      .study-frame .detail-header {
        gap: 6px;
        margin-bottom: 4px;
      }

      .study-frame .btn {
        min-height: 28px;
        padding: 5px 8px;
      }

      .study-frame .reading-toolbar {
        padding-top: 5px;
      }

      .study-frame .study-face {
        padding: 32px 16px 48px !important;
      }

      .study-frame .study-heading {
        top: 10px;
        font-size: 10px;
      }

      .study-frame .nav-btn {
        width: 30px;
        height: 30px;
      }

      .study-frame .nav-controls,
      .study-frame .flashcard-nav {
        margin-top: 3px;
      }
    }
  `;

  document.head.append(style);

  document.addEventListener('DOMContentLoaded', () => {
    const views = [
      document.getElementById('albumDetailView'),
      document.getElementById('flashcardView')
    ].filter(Boolean);

    function fit() {
      let active = false;

      views.forEach(view => {
        const visible = view.style.display !== 'none';

        view.classList.toggle('frame-active', visible);
        active ||= visible;
      });

      const entering =
        active && !document.body.classList.contains('study-frame');

      document.body.classList.toggle('study-frame', active);

      const height =
        window.visualViewport?.height || window.innerHeight;

      document.documentElement.style.setProperty(
        '--frame-height',
        `${height}px`
      );

      if (entering) {
        window.scrollTo(0, 0);
      }
    }

    const observer = new MutationObserver(fit);

    views.forEach(view => {
      observer.observe(view, {
        attributes: true,
        attributeFilter: ['style']
      });
    });

    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);

    fit();
  });
})();
;

// Source: playback-fix.js
(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  const album = flash =>
    flash
      ? flashcardCategory
      : categories.find(category => category.id === selectedCategoryId);

  function order(flash) {
    const cards = album(flash)?.cards || [];
    const oldOrder = flash ? flashcardOrder : currentOrder;

    const eligible = cards
      .map((_, index) => index)
      .filter(index => !showStarredOnly || cards[index].starred);

    const allowed = new Set(eligible);

    const stable = [
      ...new Set(oldOrder.filter(index => allowed.has(index)))
    ];

    eligible.forEach(index => {
      if (!stable.includes(index)) {
        stable.push(index);
      }
    });

    if (flash) {
      flashcardOrder = stable;
      currentFlashcardIdx = Math.max(
        0,
        Math.min(currentFlashcardIdx, stable.length - 1)
      );
    } else {
      currentOrder = stable;
      currentCardIdx = Math.max(
        0,
        Math.min(currentCardIdx, stable.length - 1)
      );
    }

    return stable;
  }

  function stableRenderer(original, flash) {
    return function (...args) {
      const stable = order(flash);
      const originalShuffle = shuffleArray;

      // Keep the selected starred order stable while rendering.
      if (showStarredOnly) {
        shuffleArray = () => [...stable];
      }

      try {
        return original.apply(this, args);
      } finally {
        shuffleArray = originalShuffle;
      }
    };
  }

  renderStackedDeck = stableRenderer(renderStackedDeck, false);
  renderFlashcardStack = stableRenderer(renderFlashcardStack, true);

  const players = [false, true].map(flash => {
    let timer = null;
    let interval = null;
    let deadline = 0;
    let remaining = 0;
    let paused = false;

    const status = () =>
      $(flash ? 'timerStatus' : 'quoteTimerStatus');

    const button = () =>
      $(flash ? 'pauseAutoBtn' : 'quotePauseAutoBtn');

    const playing = () =>
      flash ? isAutoPlaying : isQuoteAutoPlaying;

    function setPlaying(value) {
      if (flash) {
        isAutoPlaying = value;
      } else {
        isQuoteAutoPlaying = value;
      }
    }

    function clear() {
      clearTimeout(timer);
      clearInterval(interval);
      timer = null;
      interval = null;
    }

    function label(text) {
      if (button()) {
        button().textContent = text;
      }
    }

    function delay() {
      const id = flash
        ? isFlipped
          ? 'backTimerDelay'
          : 'frontTimerDelay'
        : 'quoteTimerDelay';

      const value = Number($(id)?.value);

      return (
        Number.isFinite(value) && value >= 0.5
          ? value
          : 3
      ) * 1000;
    }

    function display() {
      if (!status()) return;

      const seconds = Math.ceil(
        Math.max(0, deadline - performance.now()) / 1000
      );

      const title = flash
        ? isFlipped
          ? 'Answer'
          : 'Prompt'
        : 'Next card';

      status().textContent = `${title} · ${seconds}s`;
    }

    function schedule(milliseconds = delay()) {
      clear();

      if (!playing()) return;

      deadline = performance.now() + milliseconds;

      display();
      interval = setInterval(display, 100);
      timer = setTimeout(step, milliseconds);
    }

    function stop() {
      clear();

      paused = false;
      remaining = 0;

      setPlaying(false);
      label('Pause');

      const controls = $(
        flash
          ? 'autoPlayActiveControls'
          : 'quoteAutoPlayActiveControls'
      );

      if (controls) {
        controls.style.display = 'none';
      }

      const actionIds = flash
        ? ['flashcardControls', 'cardActionsGroup']
        : ['quoteCardActions'];

      actionIds.forEach(id => {
        if ($(id)) {
          $(id).style.display = 'flex';
        }
      });

      if (status()) {
        status().textContent = 'Ready';
      }
    }

    function step() {
      clear();

      if (!playing()) return;

      const list = order(flash);

      if (!list.length) {
        stop();
        return;
      }

      // Flashcards show both sides before advancing.
      if (flash && !isFlipped) {
        isFlipped = true;
        autoPlayStage = 'back';

        renderFlashcardStack();
        schedule();
        return;
      }

      const index = flash
        ? currentFlashcardIdx
        : currentCardIdx;

      const looping = flash
        ? isLoopEnabled
        : isQuoteLoopEnabled;

      if (index === list.length - 1 && !looping) {
        stop();
        showToast('All selected cards completed');
        return;
      }

      // These functions already include the card transitions.
      if (flash) {
        nextFlashcard();
      } else {
        nextCard();
      }

      schedule();
    }

    function start() {
      if (playing()) return;

      if (!order(flash).length) {
        stop();
        showToast('No cards to auto-play');
        return;
      }

      setPlaying(true);
      label('Pause');

      if (flash) {
        autoPlayStage = isFlipped ? 'back' : 'front';
      }

      schedule(paused ? remaining : delay());
      paused = false;
    }

    function pause() {
      if (!playing()) {
        if (paused) {
          start();
        }

        return;
      }

      remaining = Math.max(
        0,
        deadline - performance.now()
      );

      clear();
      setPlaying(false);

      paused = true;
      label('Resume');

      if (status()) {
        status().textContent = 'Paused';
      }
    }

    function fresh() {
      clear();

      paused = false;
      remaining = 0;

      setPlaying(false);
      label('Pause');

      order(flash);

      if (flash) {
        currentFlashcardIdx = 0;
        isFlipped = false;
        autoPlayStage = 'front';
      } else {
        currentCardIdx = 0;
      }
    }

    function reset() {
      remaining = delay();

      if (playing()) {
        schedule();
      }
    }

    return {
      start,
      pause,
      stop,
      fresh,
      reset
    };
  });

  startQuoteAutoPlay = players[0].start;
  pauseQuoteAutoPlay = players[0].pause;
  stopQuoteAutoPlay = players[0].stop;
  startQuoteTimer = players[0].reset;
  resetQuoteAutoPlayTimer = players[0].reset;

  startAutoPlay = players[1].start;
  pauseAutoPlay = players[1].pause;
  stopAutoPlay = players[1].stop;
  startTimer = players[1].reset;
  resetAutoPlayTimer = players[1].reset;

  const oldQuoteConfirm = confirmQuoteAutoPlay;

  confirmQuoteAutoPlay = function () {
    players[0].fresh();
    renderStackedDeck();
    oldQuoteConfirm();
  };

  const oldFlashConfirm = confirmAutoPlay;

  confirmAutoPlay = function () {
    players[1].fresh();

    // Keep pictures with their corresponding text when swapping sides.
    if ($('autoFlipAllCheckbox')?.checked) {
      flashcardCategory?.cards.forEach(card => {
        [card.frontImage, card.backImage] = [
          card.backImage,
          card.frontImage
        ];
      });
    }

    oldFlashConfirm();
  };

  const oldFilter = toggleShowStarred;

  toggleShowStarred = function () {
    oldFilter();

    players[0].reset();
    players[1].reset();
  };

  const oldStar = toggleStar;

  toggleStar = function (...args) {
    const flash = args[1] === 'flashcard';

    const before = order(flash);
    const index = flash
      ? currentFlashcardIdx
      : currentCardIdx;

    const cardId = album(flash)?.cards[before[index]]?.id;

    const result = oldStar.apply(this, args);
    const after = order(flash);

    const preserved = after.findIndex(
      position => album(flash)?.cards[position].id === cardId
    );

    if (preserved >= 0) {
      if (flash) {
        currentFlashcardIdx = preserved;
      } else {
        currentCardIdx = preserved;
      }
    }

    if (flash) {
      renderFlashcardStack(true);
    } else {
      renderStackedDeck(true);
    }

    players[flash ? 1 : 0].reset();

    return result;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const handlers = {
      confirmAutoPlayBtn: confirmAutoPlay,
      pauseAutoBtn: pauseAutoPlay,
      stopAutoBtn: stopAutoPlay,

      confirmQuoteAutoPlayBtn: confirmQuoteAutoPlay,
      quotePauseAutoBtn: pauseQuoteAutoPlay,
      quoteStopAutoBtn: stopQuoteAutoPlay,

      starFilterBtn: toggleShowStarred,
      starFilterBtnFlash: toggleShowStarred
    };

    Object.entries(handlers).forEach(([id, handler]) => {
      if ($(id)) {
        $(id).onclick = handler;
      }
    });
  });
})();
;

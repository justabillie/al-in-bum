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
let autoPlayTimer = null;
let countdownInterval = null;
let isAutoPlaying = false;
let isLoopEnabled = false;
let autoPlayStage = 'front';
let currentCountdown = 0;

// Quote Card Auto-Play variables
let quoteAutoPlayTimer = null;
let quoteCountdownInterval = null;
let isQuoteAutoPlaying = false;
let isQuoteLoopEnabled = false;
let quoteCurrentCountdown = 0;

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

async function saveCategories() {
  try {
    var response = await fetch(API_URL + '/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categories)
    });
    if (response.ok) {
      // Silent save - no toast
    }
  } catch (error) {
    console.error('Error saving:', error);
    showToast('Failed to save');
  }
}

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
  var category = null;
  var card = null;
  var cardIndex = -1;
  
  for (var i = 0; i < categories.length; i++) {
    for (var j = 0; j < categories[i].cards.length; j++) {
      if (categories[i].cards[j].id === cardId) {
        category = categories[i];
        card = categories[i].cards[j];
        cardIndex = j;
        break;
      }
    }
    if (card) break;
  }
  
  if (!card) return;
  
  // Toggle star
  card.starred = !card.starred;
  saveCategories();
  
  // Show appropriate toast
  if (card.starred) {
    showToast('⭐ Starred card');
  } else {
    showToast('☆ Unstarred card');
  }
  
  // If we're in starred-only mode and just unstarred the last card, switch to all cards
  if (showStarredOnly) {
    var starredCount = 0;
    var currentCategory = category;
    for (var i = 0; i < currentCategory.cards.length; i++) {
      if (currentCategory.cards[i].starred) starredCount++;
    }
    if (starredCount === 0) {
      showStarredOnly = false;
    }
  }
  
  // Update the star filter buttons immediately
  updateStarFilterButtons();
  
  // Re-render without animation
  if (type === 'quote') {
    renderStackedDeckSilent();
  } else if (type === 'flashcard') {
    renderFlashcardStackSilent();
  }
}

function updateStarFilterButtons() {
  var category = null;
  var detailView = document.getElementById('albumDetailView');
  var flashcardView = document.getElementById('flashcardView');
  
  if (detailView && detailView.style.display === 'block') {
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].id === selectedCategoryId) {
        category = categories[i];
        break;
      }
    }
  } else if (flashcardView && flashcardView.style.display === 'block') {
    category = flashcardCategory;
  }
  
  var starFilterBtn = document.getElementById('starFilterBtn');
  var starFilterBtnFlash = document.getElementById('starFilterBtnFlash');
  
  var hasStarred = false;
  if (category) {
    for (var i = 0; i < category.cards.length; i++) {
      if (category.cards[i].starred) {
        hasStarred = true;
        break;
      }
    }
  }
  
  // If no starred cards, hide the button
  if (!hasStarred) {
    if (starFilterBtn) starFilterBtn.style.display = 'none';
    if (starFilterBtnFlash) starFilterBtnFlash.style.display = 'none';
    // Reset showStarredOnly if no starred cards
    if (showStarredOnly) {
      showStarredOnly = false;
    }
    return;
  }
  
  // Show the button
  if (starFilterBtn) starFilterBtn.style.display = 'inline-flex';
  if (starFilterBtnFlash) starFilterBtnFlash.style.display = 'inline-flex';
  
  var btnText = showStarredOnly ? '<i class="fas fa-star"></i> View All' : '<i class="fas fa-star"></i> View Starred';
  if (starFilterBtn) {
    starFilterBtn.innerHTML = btnText;
    starFilterBtn.style.background = showStarredOnly ? '#FFD966' : '';
    starFilterBtn.style.color = showStarredOnly ? '#1e1b2c' : '';
  }
  if (starFilterBtnFlash) {
    starFilterBtnFlash.innerHTML = btnText;
    starFilterBtnFlash.style.background = showStarredOnly ? '#FFD966' : '';
    starFilterBtnFlash.style.color = showStarredOnly ? '#1e1b2c' : '';
  }
}

function toggleShowStarred() {
  var category = null;
  var detailView = document.getElementById('albumDetailView');
  var flashcardView = document.getElementById('flashcardView');
  
  if (detailView && detailView.style.display === 'block') {
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].id === selectedCategoryId) {
        category = categories[i];
        break;
      }
    }
  } else if (flashcardView && flashcardView.style.display === 'block') {
    category = flashcardCategory;
  }
  
  if (!category) return;
  
  showStarredOnly = !showStarredOnly;
  
  if (showStarredOnly) {
    var hasStarred = false;
    for (var i = 0; i < category.cards.length; i++) {
      if (category.cards[i].starred) {
        hasStarred = true;
        break;
      }
    }
    if (!hasStarred) {
      showStarredOnly = false;
      showToast('No starred cards in this album');
      updateStarFilterButtons();
      return;
    }
  }
  
  updateStarFilterButtons();
  
  if (detailView && detailView.style.display === 'block') {
    var indices = [];
    if (showStarredOnly) {
      for (var j = 0; j < category.cards.length; j++) {
        if (category.cards[j].starred) {
          indices.push(j);
        }
      }
    } else {
      for (var j = 0; j < category.cards.length; j++) {
        indices.push(j);
      }
    }
    currentOrder = shuffleArray(indices);
    currentCardIdx = 0;
    renderStackedDeckSilent();
  } else if (flashcardView && flashcardView.style.display === 'block') {
    var indices = [];
    if (showStarredOnly) {
      for (var j = 0; j < category.cards.length; j++) {
        if (category.cards[j].starred) {
          indices.push(j);
        }
      }
    } else {
      for (var j = 0; j < category.cards.length; j++) {
        indices.push(j);
      }
    }
    flashcardOrder = shuffleArray(indices);
    currentFlashcardIdx = 0;
    isFlipped = false;
    renderFlashcardStackSilent();
  }
  
  showToast(showStarredOnly ? '⭐ Showing starred cards only' : '📚 Showing all cards');
}

function getPatternClass() {
  var patterns = [
    'pattern-floral', 'pattern-waves', 'pattern-stars', 'pattern-mountains',
    'pattern-bubbles', 'pattern-grid', 'pattern-diagonal', 'pattern-polka',
    'pattern-zigzag', 'pattern-leaf', 'pattern-hearts', 'pattern-snow', 'pattern-confetti'
  ];
  return patterns[Math.floor(Math.random() * patterns.length)];
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

function getCardInner(card, displayIndex, total, category) {
  var patternClass = getPatternClass();
  var fontSizeNum = category.fontSize || 20;
  var fontSize = fontSizeNum + 'px';
  var style = 'font-family: ' + (category.font || 'Inter, sans-serif') + '; color: ' + (category.fontColor || '#FFFFFF') + '; background-color: ' + category.themeColor + '; font-size: ' + fontSize + ';';
  var starIcon = card.starred ? 'fas fa-star' : 'far fa-star';
  var starColor = card.starred ? 'color: #FFD700;' : 'color: rgba(255,255,255,0.5);';
  
  return '<div class="card-inner ' + patternClass + '" style="' + style + '">' +
    '<div class="quote-text">' + escapeHtml(card.text) + '</div>' +
    '<div class="card-meta">' + displayIndex + ' of ' + total + '</div>' +
    '<div class="card-edit-overlay">' +
      '<button class="float-btn star-btn" data-id="' + card.id + '" data-type="quote" style="' + starColor + '"><i class="' + starIcon + '"></i></button>' +
      '<button class="float-btn edit-card-btn" data-id="' + card.id + '"><i class="fas fa-edit"></i></button>' +
      '<button class="float-btn delete-card-btn" data-id="' + card.id + '"><i class="fas fa-trash"></i></button>' +
    '</div>' +
  '</div>';
}

function getFlashcardInner(card, position, total, category, isFlippedState) {
  var patternClass = getPatternClass();
  var frontContent = escapeHtml(card.front);
  var backContent = escapeHtml(card.back);
  var fontSizeNum = category.fontSize || 20;
  var fontSize = fontSizeNum + 'px';
  var style = 'font-family: ' + (category.font || 'Inter, sans-serif') + '; color: ' + (category.fontColor || '#FFFFFF') + '; background-color: ' + category.themeColor + '; font-size: ' + fontSize + ';';
  var starIcon = card.starred ? 'fas fa-star' : 'far fa-star';
  var starColor = card.starred ? 'color: #FFD700;' : 'color: rgba(255,255,255,0.5);';
  
  return '<div class="flashcard-stack-card ' + (isFlippedState ? 'flipped' : '') + '">' +
    '<div class="flashcard-inner">' +
      '<div class="flashcard-front ' + patternClass + '" style="' + style + '">' +
        '<div class="flashcard-content">' + frontContent + '</div>' +
        '<div class="flashcard-meta">' + position + ' of ' + total + '</div>' +
      '</div>' +
      '<div class="flashcard-back ' + patternClass + '" style="' + style + '">' +
        '<div class="flashcard-content">' + backContent + '</div>' +
        '<div class="flashcard-meta">' + position + ' of ' + total + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="flashcard-edit-overlay">' +
      '<button class="float-btn star-btn" data-id="' + card.id + '" data-type="flashcard" style="' + starColor + '"><i class="' + starIcon + '"></i></button>' +
      '<button class="float-btn edit-flashcard-btn" data-id="' + card.id + '"><i class="fas fa-edit"></i></button>' +
      '<button class="float-btn delete-flashcard-btn" data-id="' + card.id + '"><i class="fas fa-trash"></i></button>' +
    '</div>' +
  '</div>';
}

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
  var wrapper = document.getElementById('flashcardStackWrapper');
  var counterSpan = document.getElementById('flashcardCounter');
  
  if (!wrapper || !counterSpan) return;
  
  if (!flashcardCategory || flashcardCategory.cards.length === 0) {
    wrapper.innerHTML = '<div class="flashcard-stack-card top-card"><div class="flashcard-inner"><div class="flashcard-front" style="background-color: ' + (flashcardCategory ? flashcardCategory.themeColor : '#6C5CE7') + '; color: #FFFFFF;"><div class="flashcard-content"><i class="fas fa-plus-circle"></i><br>No cards yet.<br>Add your first flashcard!</div></div></div></div>';
    counterSpan.innerText = '0 / 0';
    return;
  }
  
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
      wrapper.innerHTML = '<div class="flashcard-stack-card top-card"><div class="flashcard-inner"><div class="flashcard-front" style="background-color: ' + flashcardCategory.themeColor + '; color: ' + (flashcardCategory.fontColor || '#FFFFFF') + ';"><div class="flashcard-content"><i class="fas fa-star"></i><br>No starred flashcards in this album</div></div></div></div>';
      counterSpan.innerText = '0 / 0';
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
  
  if (currentFlashcardIdx >= displayOrder.length) currentFlashcardIdx = displayOrder.length - 1;
  if (currentFlashcardIdx < 0) currentFlashcardIdx = 0;
  
  var total = displayOrder.length;
  var currCard = flashcardCategory.cards[displayOrder[currentFlashcardIdx]];
  var nextCard = (currentFlashcardIdx + 1 < total) ? flashcardCategory.cards[displayOrder[currentFlashcardIdx + 1]] : null;
  var prevCard = (currentFlashcardIdx - 1 >= 0) ? flashcardCategory.cards[displayOrder[currentFlashcardIdx - 1]] : null;
  
  var html = '';
  if (prevCard) {
    html += '<div class="flashcard-stack-card prev-card">' + getFlashcardInner(prevCard, currentFlashcardIdx, total, flashcardCategory, false) + '</div>';
  }
  if (nextCard) {
    html += '<div class="flashcard-stack-card next-card">' + getFlashcardInner(nextCard, currentFlashcardIdx + 2, total, flashcardCategory, false) + '</div>';
  }
  html += '<div class="flashcard-stack-card top-card">' + getFlashcardInner(currCard, currentFlashcardIdx + 1, total, flashcardCategory, isFlipped) + '</div>';
  
  if (silent) {
    wrapper.innerHTML = html;
    var cards = wrapper.querySelectorAll('.flashcard-stack-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.animation = 'none';
    }
  } else {
    wrapper.innerHTML = html;
  }
  
  counterSpan.innerText = (currentFlashcardIdx + 1) + ' / ' + total;
  
  var starBtns = document.querySelectorAll('.star-btn');
  for (var k = 0; k < starBtns.length; k++) {
    var btn = starBtns[k];
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleStar(this.dataset.id, this.dataset.type);
    });
  }
  
  var editBtns = document.querySelectorAll('.edit-flashcard-btn');
  for (var k = 0; k < editBtns.length; k++) {
    var btn = editBtns[k];
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      openEditFlashcard(this.dataset.id);
    });
  }
  
  var deleteBtns = document.querySelectorAll('.delete-flashcard-btn');
  for (var m = 0; m < deleteBtns.length; m++) {
    var delBtn = deleteBtns[m];
    delBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteFlashcardById(this.dataset.id);
    });
  }
  
  var topCard = wrapper.querySelector('.top-card');
  if (topCard) {
    topCard.addEventListener('click', function(e) {
      if (!e.target.classList.contains('star-btn') && !e.target.classList.contains('edit-flashcard-btn') && !e.target.classList.contains('delete-flashcard-btn')) {
        flipCurrentCard();
      }
    });
  }
}

function renderStackedDeck() {
  renderStackedDeckInternal(false);
}

function renderStackedDeckInternal(silent) {
  var wrapper = document.getElementById('stackWrapper');
  var counterSpan = document.getElementById('cardCounter');
  
  var category = null;
  for (var i = 0; i < categories.length; i++) {
    if (categories[i].id === selectedCategoryId) {
      category = categories[i];
      break;
    }
  }

  if (!wrapper || !counterSpan) return;

  if (!category || category.cards.length === 0) {
    wrapper.innerHTML = '<div class="stack-card top-card"><div class="card-inner" style="background-color: ' + (category ? category.themeColor : '#6C5CE7') + '; color: ' + (category ? (category.fontColor || '#FFFFFF') : '#FFFFFF') + ';"><i class="fas fa-quote-left" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.7;"></i><br>No cards yet.<br>Add your first quote!</div></div>';
    counterSpan.innerText = '0 / 0';
    return;
  }

  var displayOrder = currentOrder;
  if (showStarredOnly) {
    var starredIndices = [];
    for (var j = 0; j < category.cards.length; j++) {
      if (category.cards[j].starred) {
        starredIndices.push(j);
      }
    }
    displayOrder = shuffleArray(starredIndices);
    if (displayOrder.length === 0) {
      wrapper.innerHTML = '<div class="stack-card top-card"><div class="card-inner" style="background-color: ' + category.themeColor + '; color: ' + (category.fontColor || '#FFFFFF') + ';"><i class="fas fa-star"></i><br>No starred cards in this album</div></div>';
      counterSpan.innerText = '0 / 0';
      return;
    }
  } else {
    if (currentOrder.length !== category.cards.length) {
      var indices = [];
      for (var j = 0; j < category.cards.length; j++) {
        indices.push(j);
      }
      currentOrder = shuffleArray(indices);
    }
    displayOrder = currentOrder;
  }

  if (currentCardIdx >= displayOrder.length) currentCardIdx = displayOrder.length - 1;
  if (currentCardIdx < 0) currentCardIdx = 0;

  var total = displayOrder.length;
  var currCard = category.cards[displayOrder[currentCardIdx]];
  var nextCard = (currentCardIdx + 1 < total) ? category.cards[displayOrder[currentCardIdx + 1]] : null;
  var prevCard = (currentCardIdx - 1 >= 0) ? category.cards[displayOrder[currentCardIdx - 1]] : null;

  var html = '';
  if (prevCard) {
    html += '<div class="stack-card prev-card">' + getCardInner(prevCard, currentCardIdx, total, category) + '</div>';
  }
  if (nextCard) {
    html += '<div class="stack-card next-card">' + getCardInner(nextCard, currentCardIdx + 2, total, category) + '</div>';
  }
  html += '<div class="stack-card top-card">' + getCardInner(currCard, currentCardIdx + 1, total, category) + '</div>';

  if (silent) {
    wrapper.innerHTML = html;
    var cards = wrapper.querySelectorAll('.stack-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.animation = 'none';
    }
  } else {
    wrapper.innerHTML = html;
  }
  
  counterSpan.innerText = (currentCardIdx + 1) + ' / ' + total;

  var starBtns = document.querySelectorAll('.star-btn');
  for (var k = 0; k < starBtns.length; k++) {
    var btn = starBtns[k];
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleStar(this.dataset.id, this.dataset.type);
    });
  }

  var editBtns = document.querySelectorAll('.edit-card-btn');
  for (var k = 0; k < editBtns.length; k++) {
    var btn = editBtns[k];
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      openEditCard(this.dataset.id);
    });
  }

  var deleteBtns = document.querySelectorAll('.delete-card-btn');
  for (var m = 0; m < deleteBtns.length; m++) {
    var delBtn = deleteBtns[m];
    delBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteCardById(this.dataset.id);
    });
  }
}

// Quote Card Auto-Play Functions
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

function startQuoteAutoPlay() {
  if (isQuoteAutoPlaying) return;
  
  var category = null;
  for (var i = 0; i < categories.length; i++) {
    if (categories[i].id === selectedCategoryId) {
      category = categories[i];
      break;
    }
  }
  if (!category || category.cards.length === 0) {
    showToast('No cards to auto-play');
    return;
  }
  
  isQuoteAutoPlaying = true;
  startQuoteTimer();
}

function pauseQuoteAutoPlay() {
  isQuoteAutoPlaying = false;
  if (quoteAutoPlayTimer) {
    clearTimeout(quoteAutoPlayTimer);
    quoteAutoPlayTimer = null;
  }
  if (quoteCountdownInterval) {
    clearInterval(quoteCountdownInterval);
    quoteCountdownInterval = null;
  }
  var timerStatus = document.getElementById('quoteTimerStatus');
  if (timerStatus) timerStatus.innerHTML = '<i class="fas fa-pause"></i> Paused';
}

function stopQuoteAutoPlay() {
  isQuoteAutoPlaying = false;
  if (quoteAutoPlayTimer) {
    clearTimeout(quoteAutoPlayTimer);
    quoteAutoPlayTimer = null;
  }
  if (quoteCountdownInterval) {
    clearInterval(quoteCountdownInterval);
    quoteCountdownInterval = null;
  }
  
  document.getElementById('quoteAutoPlayActiveControls').style.display = 'none';
  document.getElementById('quoteCardActions').style.display = 'flex';
  
  var timerStatus = document.getElementById('quoteTimerStatus');
  if (timerStatus) timerStatus.innerHTML = '<i class="fas fa-clock"></i> Ready';
}

function startQuoteCountdown(delay, onComplete) {
  if (quoteCountdownInterval) {
    clearInterval(quoteCountdownInterval);
  }
  
  quoteCurrentCountdown = Math.ceil(delay);
  updateQuoteTimerDisplay(quoteCurrentCountdown);
  
  quoteCountdownInterval = setInterval(function() {
    quoteCurrentCountdown--;
    updateQuoteTimerDisplay(quoteCurrentCountdown);
    
    if (quoteCurrentCountdown <= 0) {
      clearInterval(quoteCountdownInterval);
      quoteCountdownInterval = null;
      if (onComplete) onComplete();
    }
  }, 1000);
}

function updateQuoteTimerDisplay(seconds) {
  var timerStatus = document.getElementById('quoteTimerStatus');
  if (timerStatus) {
    timerStatus.innerHTML = '<i class="fas fa-hourglass-half"></i> Next card in: ' + seconds + 's';
  }
}

function startQuoteTimer() {
  if (!isQuoteAutoPlaying) return;
  
  var delay = parseFloat(document.getElementById('quoteTimerDelay').value);
  if (isNaN(delay) || delay < 1) delay = 5;
  
  startQuoteCountdown(delay, function() {
    var category = null;
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].id === selectedCategoryId) {
        category = categories[i];
        break;
      }
    }
    
    var displayOrder = currentOrder;
    if (showStarredOnly) {
      var starredIndices = [];
      for (var j = 0; j < category.cards.length; j++) {
        if (category.cards[j].starred) {
          starredIndices.push(j);
        }
      }
      displayOrder = shuffleArray(starredIndices);
      if (displayOrder.length === 0) {
        stopQuoteAutoPlay();
        showToast('No starred cards to auto-play');
        return;
      }
    }
    
    var nextIndex = currentCardIdx + 1;
    if (nextIndex < displayOrder.length) {
      currentCardIdx = nextIndex;
      renderStackedDeck();
      startQuoteTimer();
    } else if (isQuoteLoopEnabled && displayOrder.length > 0) {
      currentCardIdx = 0;
      renderStackedDeck();
      startQuoteTimer();
      showToast('Looping: starting from beginning');
    } else {
      stopQuoteAutoPlay();
      showToast('End of cards reached');
    }
  });
}

function resetQuoteAutoPlayTimer() {
  if (isQuoteAutoPlaying) {
    if (quoteAutoPlayTimer) {
      clearTimeout(quoteAutoPlayTimer);
      quoteAutoPlayTimer = null;
    }
    if (quoteCountdownInterval) {
      clearInterval(quoteCountdownInterval);
      quoteCountdownInterval = null;
    }
    startQuoteTimer();
  }
}

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

function startAutoPlay() {
  if (isAutoPlaying) return;
  if (!flashcardCategory || flashcardCategory.cards.length === 0) {
    showToast('No cards to auto-play');
    return;
  }
  
  isAutoPlaying = true;
  autoPlayStage = isFlipped ? 'back' : 'front';
  renderFlashcardStack();
  startTimer();
}

function pauseAutoPlay() {
  isAutoPlaying = false;
  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer);
    autoPlayTimer = null;
  }
  stopCountdown();
  var timerStatus = document.getElementById('timerStatus');
  if (timerStatus) timerStatus.innerHTML = '<i class="fas fa-pause"></i> Paused';
}

function stopAutoPlay() {
  isAutoPlaying = false;
  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer);
    autoPlayTimer = null;
  }
  stopCountdown();
  
  document.getElementById('autoPlayActiveControls').style.display = 'none';
  document.getElementById('flashcardControls').style.display = 'flex';
  document.getElementById('cardActionsGroup').style.display = 'flex';
  
  var timerStatus = document.getElementById('timerStatus');
  if (timerStatus) timerStatus.innerHTML = '<i class="fas fa-clock"></i> Ready';
}

function startCountdown(delay, onComplete) {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  currentCountdown = Math.ceil(delay);
  updateTimerDisplay(currentCountdown);
  
  countdownInterval = setInterval(function() {
    currentCountdown--;
    updateTimerDisplay(currentCountdown);
    
    if (currentCountdown <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      if (onComplete) onComplete();
    }
  }, 1000);
}

function updateTimerDisplay(seconds) {
  var timerStatus = document.getElementById('timerStatus');
  if (timerStatus) {
    var stageText = autoPlayStage === 'front' ? 'Showing front' : 'Showing back';
    timerStatus.innerHTML = '<i class="fas fa-hourglass-half"></i> ' + stageText + ': ' + seconds + 's';
  }
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function startTimer() {
  if (!isAutoPlaying) return;
  
  var frontDelay = parseFloat(document.getElementById('frontTimerDelay').value);
  var backDelay = parseFloat(document.getElementById('backTimerDelay').value);
  if (isNaN(frontDelay) || frontDelay < 0.5) frontDelay = 3;
  if (isNaN(backDelay) || backDelay < 0.5) backDelay = 2;
  
  var currentDelay = autoPlayStage === 'front' ? frontDelay : backDelay;
  
  startCountdown(currentDelay, function() {
    if (autoPlayStage === 'front') {
      isFlipped = true;
      autoPlayStage = 'back';
      renderFlashcardStack();
      startTimer();
    } else if (autoPlayStage === 'back') {
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
          stopAutoPlay();
          showToast('No starred flashcards to auto-play');
          return;
        }
      }
      
      if (currentFlashcardIdx + 1 < displayOrder.length) {
        currentFlashcardIdx++;
        isFlipped = false;
        autoPlayStage = 'front';
        renderFlashcardStack();
        startTimer();
      } else if (isLoopEnabled && displayOrder.length > 0) {
        currentFlashcardIdx = 0;
        isFlipped = false;
        autoPlayStage = 'front';
        renderFlashcardStack();
        startTimer();
        showToast('Looping: starting from beginning');
      } else {
        stopAutoPlay();
        showToast('End of flashcards reached');
      }
    }
  });
}

function resetAutoPlayTimer() {
  if (isAutoPlaying) {
    if (autoPlayTimer) {
      clearTimeout(autoPlayTimer);
      autoPlayTimer = null;
    }
    stopCountdown();
    startTimer();
  }
}

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

async function createOrUpdateCategory() {
  var nameInput = document.getElementById('catName');
  var colorInput = document.getElementById('themeColor');
  var fontColorInput = document.getElementById('fontColor');
  var fontSelect = document.getElementById('categoryFont');
  var editIdInput = document.getElementById('editCatId');
  var typeSelect = document.getElementById('albumType');
  var fontSizeInput = document.getElementById('fontSize');
  
  if (!nameInput || !colorInput || !fontSelect || !editIdInput) return;
  
  var name = nameInput.value.trim();
  if (name === "") name = "Untitled";
  var color = colorInput.value;
  var fontColor = fontColorInput.value;
  var font = fontSelect.value;
  var type = typeSelect ? typeSelect.value : 'quote';
  var editId = editIdInput.value;
  var fontSize = fontSizeInput ? parseInt(fontSizeInput.value) : 20;

  if (editId) {
    var idx = -1;
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].id === editId) {
        idx = i;
        break;
      }
    }
    if (idx !== -1) {
      categories[idx].name = name;
      categories[idx].themeColor = color;
      categories[idx].fontColor = fontColor;
      categories[idx].font = font;
      categories[idx].type = type;
      categories[idx].fontSize = fontSize;
      showToast("Album updated");
      
      if (selectedCategoryId === editId) {
        var category = categories[idx];
        if (category.type === 'flashcard') {
          flashcardCategory = category;
          renderFlashcardStack();
        } else {
          renderStackedDeck();
        }
      }
    }
  } else {
    var newId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    categories.push({
      id: newId,
      name: name,
      themeColor: color,
      fontColor: fontColor,
      font: font,
      type: type,
      fontSize: fontSize,
      cards: []
    });
    showToast("Album created");
  }

  await saveCategories();
  hideModal('categoryModal');
  renderAlbums();

  if (selectedCategoryId) {
    var exists = false;
    for (var j = 0; j < categories.length; j++) {
      if (categories[j].id === selectedCategoryId) {
        exists = true;
        break;
      }
    }
    if (!exists) selectedCategoryId = null;
  }

  editIdInput.value = '';
}

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
  if (!confirm("Delete entire album and all its cards?")) return;
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

async function addOrUpdateQuoteCard() {
  var quoteTextarea = document.getElementById('quoteText');
  var editCardIdInput = document.getElementById('editCardId');
  
  if (!quoteTextarea || !editCardIdInput) return;
  
  var quote = quoteTextarea.value.trim();
  if (quote === "") {
    alert("Please enter a quote");
    return;
  }

  var editCardId = editCardIdInput.value;
  var category = null;
  for (var i = 0; i < categories.length; i++) {
    if (categories[i].id === selectedCategoryId) {
      category = categories[i];
      break;
    }
  }

  if (!category) {
    alert("No category selected");
    return;
  }

  if (editCardId) {
    var idx = -1;
    for (var j = 0; j < category.cards.length; j++) {
      if (category.cards[j].id === editCardId) {
        idx = j;
        break;
      }
    }
    if (idx !== -1) {
      category.cards[idx].text = quote;
      showToast("Card updated");
      for (var k = 0; k < currentOrder.length; k++) {
        if (currentOrder[k] === idx) {
          currentCardIdx = k;
          break;
        }
      }
    }
  } else {
    var newId = 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    category.cards.push({
      id: newId,
      text: quote,
      starred: false
    });
    
    var indices = [];
    for (var k = 0; k < category.cards.length; k++) {
      indices.push(k);
    }
    currentOrder = shuffleArray(indices);
    var newCardIndex = category.cards.length - 1;
    for (var m = 0; m < currentOrder.length; m++) {
      if (currentOrder[m] === newCardIndex) {
        currentCardIdx = m;
        break;
      }
    }
    showToast("Card added");
  }

  await saveCategories();
  hideModal('cardModal');
  renderAlbums();
  renderStackedDeck();
  updateStarFilterButtons();

  editCardIdInput.value = '';
  quoteTextarea.value = '';
}

async function addOrUpdateFlashcard() {
  var frontTextarea = document.getElementById('flashcardFrontText');
  var backTextarea = document.getElementById('flashcardBackText');
  var editCardIdInput = document.getElementById('editFlashcardId');
  
  if (!frontTextarea || !backTextarea || !editCardIdInput) return;
  
  var front = frontTextarea.value.trim();
  var back = backTextarea.value.trim();
  if (front === "" || back === "") {
    alert("Please enter both front and back content");
    return;
  }

  var editCardId = editCardIdInput.value;
  var category = flashcardCategory;

  if (!category) {
    alert("No category selected");
    return;
  }

  if (editCardId) {
    var idx = -1;
    for (var j = 0; j < category.cards.length; j++) {
      if (category.cards[j].id === editCardId) {
        idx = j;
        break;
      }
    }
    if (idx !== -1) {
      category.cards[idx] = { ...category.cards[idx], front: front, back: back };
      showToast("Card updated");
    }
  } else {
    var newId = 'flash_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    category.cards.push({
      id: newId,
      front: front,
      back: back,
      starred: false
    });
    flashcardOrder = [];
    for (var k = 0; k < category.cards.length; k++) {
      flashcardOrder.push(k);
    }
    currentFlashcardIdx = category.cards.length - 1;
    showToast("Flashcard added");
  }

  await saveCategories();
  hideModal('flashcardModal');
  renderAlbums();
  if (flashcardCategory) {
    renderFlashcardStack();
  }
  updateStarFilterButtons();

  editCardIdInput.value = '';
  frontTextarea.value = '';
  backTextarea.value = '';
}

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

  if (!confirm("Delete this quote card?")) return;

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
  if (!confirm("Delete this flashcard?")) return;

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
function handleKeyPress(e) {
  var detailView = document.getElementById('albumDetailView');
  var flashcardView = document.getElementById('flashcardView');
  var isInQuoteAlbum = detailView && detailView.style.display === 'block';
  var isInFlashcard = flashcardView && flashcardView.style.display === 'block';
  
  if (isInQuoteAlbum) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevCard();
    }
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextCard();
    }
  }
  
  if (isInFlashcard) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevFlashcard();
    }
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextFlashcard();
    }
    else if (e.key === ' ' || e.key === 'Space') {
      e.preventDefault();
      flipCurrentCard();
    }
  }
  
  if (e.key === 'Enter') {
    var categoryModal = document.getElementById('categoryModal');
    var cardModal = document.getElementById('cardModal');
    var flashcardModal = document.getElementById('flashcardModal');
    
    if (categoryModal && categoryModal.style.display === 'flex') {
      e.preventDefault();
      createOrUpdateCategory();
    }
    else if (cardModal && cardModal.style.display === 'flex') {
      e.preventDefault();
      addOrUpdateQuoteCard();
    }
    else if (flashcardModal && flashcardModal.style.display === 'flex') {
      e.preventDefault();
      addOrUpdateFlashcard();
    }
  }
  else if (e.key === 'Escape') {
    hideModal('categoryModal');
    hideModal('cardModal');
    hideModal('flashcardModal');
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
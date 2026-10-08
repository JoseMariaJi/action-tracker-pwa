/**
 * Aplicación Principal - Registro de Acciones PWA
 * Versión 2: Soporte completo de Categorías (Genérica protegida, reasignación, desduplicación de nombres, PDF).
 */

import {
  openDatabase,
  getCategories,
  saveCategory,
  deleteCategory,
  getActionTypes,
  saveActionType,
  deleteActionType,
  logAction,
  getActionLogs,
  updateActionLog,
  deleteActionLog,
  exportAllData,
  importAllData,
  DEFAULT_ACTION_TYPES,
  DEFAULT_CATEGORIES,
  GENERIC_CATEGORY_ID
} from './db.js';

import { generateActionsPDF } from './pdf-export.js';

// ================= ESTADO GLOBAL =================
const state = {
  categories: [],
  categoriesMap: {},
  selectedRegisterCategory: 'all',
  actionTypes: [],
  actionTypesMap: {},
  currentView: 'view-register',
  installPrompt: null,
  activeTheme: 'light',
  editingActionId: null,
  editingCategoryId: null
};

// Iconos populares de Lucide para los selectores
const POPULAR_LUCIDE_ICONS = [
  'check-circle', 'activity', 'droplet', 'pill', 'dumbbell', 'coffee', 
  'book-open', 'heart', 'apple', 'sun', 'moon', 'briefcase', 
  'utensils', 'clock', 'calendar', 'phone', 'mail', 'music', 
  'camera', 'car', 'bike', 'flag', 'star', 'alert-circle', 
  'zap', 'smile', 'glasses', 'key', 'shopping-cart', 'target', 
  'gift', 'tag', 'thumbs-up', 'award', 'sparkles', 'file-text',
  'folder', 'film', 'graduation-cap', 'laptop', 'home', 'smile'
];

// Paleta de colores predefinidos
const PRESET_COLORS = [
  '#4f46e5', // Indigo
  '#0ea5e9', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#3b82f6', // Blue
  '#64748b'  // Slate
];

// ================= INICIALIZACIÓN =================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initPWA();
  initNavigation();
  initModals();
  initExportViews();

  try {
    await openDatabase();
    await refreshAllData();
    await refreshCurrentView();
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    showToast('Error al conectar con la base de datos local');
  }

  refreshLucideIcons();
});

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// ================= TEMA CLARO / OSCURO =================
function initTheme() {
  const savedTheme = localStorage.getItem('action_tracker_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  state.activeTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  applyTheme(state.activeTheme);

  const themeBtn = document.getElementById('btnThemeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      state.activeTheme = state.activeTheme === 'dark' ? 'light' : 'dark';
      applyTheme(state.activeTheme);
      localStorage.setItem('action_tracker_theme', state.activeTheme);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon) {
    themeIcon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    refreshLucideIcons();
  }
}

// ================= PWA & SERVICE WORKER =================
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  showToast('Nueva versión disponible', {
                    actionText: 'Actualizar',
                    onAction: () => window.location.reload()
                  });
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('Error al registrar Service Worker:', err);
        });
    });
  }

  const offlineBadge = document.getElementById('offlineBadge');
  function updateOnlineStatus() {
    if (offlineBadge) {
      if (navigator.onLine) {
        offlineBadge.classList.remove('active');
      } else {
        offlineBadge.classList.add('active');
      }
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  const btnInstall = document.getElementById('btnInstall');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.installPrompt = e;
    if (btnInstall) btnInstall.classList.add('visible');
  });

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!state.installPrompt) return;
      state.installPrompt.prompt();
      const { outcome } = await state.installPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('¡Gracias por instalar la app!');
      }
      state.installPrompt = null;
      btnInstall.classList.remove('visible');
    });
  }

  window.addEventListener('appinstalled', () => {
    if (btnInstall) btnInstall.classList.remove('visible');
    state.installPrompt = null;
    showToast('App instalada en tu dispositivo');
  });
}

// ================= INICIALIZACIÓN DE MODALES =================
function initModals() {
  // Modal de Acción
  document.getElementById('btnCloseActionModal')?.addEventListener('click', closeActionTypeModal);
  document.getElementById('btnCancelActionModal')?.addEventListener('click', closeActionTypeModal);

  // Modal de Categoría
  document.getElementById('btnCloseCategoryModal')?.addEventListener('click', closeCategoryModal);
  document.getElementById('btnCancelCategoryModal')?.addEventListener('click', closeCategoryModal);

  // Modal de Notas
  document.getElementById('btnCloseNoteModal')?.addEventListener('click', closeNoteModal);
  document.getElementById('btnCancelNoteModal')?.addEventListener('click', closeNoteModal);
  document.getElementById('btnSaveNoteModal')?.addEventListener('click', saveNoteFromModal);

  // Cerrar al hacer clic en fondo
  document.getElementById('modalActionType')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalActionType') closeActionTypeModal();
  });
  document.getElementById('modalCategory')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalCategory') closeCategoryModal();
  });
  document.getElementById('modalNote')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalNote') closeNoteModal();
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeActionTypeModal();
      closeCategoryModal();
      closeNoteModal();
    }
  });
}

// ================= NAVEGACIÓN ENTRE VISTAS =================
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      switchView(targetView);
    });
  });
}

async function switchView(viewId) {
  state.currentView = viewId;

  document.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.getAttribute('data-view') === viewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('.view-section').forEach(section => {
    if (section.id === viewId) {
      section.classList.add('active');
    } else {
      section.classList.remove('active');
    }
  });

  await refreshCurrentView();
  refreshLucideIcons();
}

async function refreshCurrentView() {
  if (state.currentView === 'view-register') {
    await renderRegisterView();
  } else if (state.currentView === 'view-history') {
    await renderHistoryView();
  } else if (state.currentView === 'view-actions') {
    await renderActionsConfigView();
  } else if (state.currentView === 'view-export') {
    await updateExportFilters();
  }
}

// ================= RECARGA DE DATOS =================
async function refreshAllData() {
  await Promise.all([
    refreshCategories(),
    refreshActionTypes()
  ]);
}

async function refreshCategories() {
  state.categories = await getCategories();
  state.categoriesMap = {};
  state.categories.forEach(cat => {
    state.categoriesMap[cat.id] = cat;
  });

  // Actualizar select de categorías en formulario de acción
  const actionCatSelect = document.getElementById('actionCategorySelect');
  if (actionCatSelect) {
    const curVal = actionCatSelect.value;
    actionCatSelect.innerHTML = '';
    state.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name + (cat.id === GENERIC_CATEGORY_ID ? ' (Por defecto)' : '');
      actionCatSelect.appendChild(opt);
    });
    if (curVal && state.categoriesMap[curVal]) {
      actionCatSelect.value = curVal;
    }
  }

  // Actualizar selects de filtro en Historial y Exportar
  updateCategoryFilterSelects();
  renderCategoryChips();
}

async function refreshActionTypes() {
  state.actionTypes = await getActionTypes();
  state.actionTypesMap = {};

  // Fallbacks para que nunca aparezca como eliminada si es una acción por defecto
  DEFAULT_ACTION_TYPES.forEach(item => {
    state.actionTypesMap[item.id] = item;
  });

  state.actionTypes.forEach(act => {
    state.actionTypesMap[act.id] = act;
  });

  updateActionFilterSelects();
}

function updateCategoryFilterSelects() {
  const selects = ['historyFilterCategory', 'pdfCategorySelect'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    const currentVal = el.value;
    el.innerHTML = '<option value="all">Todas las categorías</option>';

    state.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      el.appendChild(opt);
    });

    if (currentVal && Array.from(el.options).some(o => o.value === currentVal)) {
      el.value = currentVal;
    }
  });
}

function updateActionFilterSelects(selectedCategoryId = 'all') {
  const selects = [
    { id: 'historyFilterAction', defaultText: 'Todas las acciones' },
    { id: 'pdfActionSelect', defaultText: 'Todas las acciones de la categoría' }
  ];

  selects.forEach(({ id, defaultText }) => {
    const el = document.getElementById(id);
    if (!el) return;

    const currentVal = el.value;
    el.innerHTML = `<option value="all">${defaultText}</option>`;

    let actions = state.actionTypes;
    if (selectedCategoryId && selectedCategoryId !== 'all') {
      actions = actions.filter(a => (a.categoryId || GENERIC_CATEGORY_ID) === selectedCategoryId);
    }

    actions.forEach(act => {
      const opt = document.createElement('option');
      opt.value = act.id;
      opt.textContent = act.name;
      el.appendChild(opt);
    });

    if (currentVal && Array.from(el.options).some(o => o.value === currentVal)) {
      el.value = currentVal;
    }
  });
}

// ================= VISTA 1: REGISTRAR (ACCIONES RÁPIDAS) =================
function renderCategoryChips() {
  const container = document.getElementById('categoryChipsContainer');
  if (!container) return;

  container.innerHTML = '';

  // Botón "Todas"
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = `chip-btn ${state.selectedRegisterCategory === 'all' ? 'active' : ''}`;
  allBtn.innerHTML = `<i data-lucide="layers" style="width: 14px; height: 14px;"></i> Todas`;
  allBtn.addEventListener('click', () => {
    state.selectedRegisterCategory = 'all';
    renderCategoryChips();
    renderRegisterView();
  });
  container.appendChild(allBtn);

  // Chips para cada categoría
  state.categories.forEach(cat => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `chip-btn ${state.selectedRegisterCategory === cat.id ? 'active' : ''}`;
    chip.innerHTML = `<i data-lucide="${cat.icon || 'folder'}" style="width: 14px; height: 14px;"></i> ${escapeHTML(cat.name)}`;
    chip.addEventListener('click', () => {
      state.selectedRegisterCategory = cat.id;
      renderCategoryChips();
      renderRegisterView();
    });
    container.appendChild(chip);
  });

  refreshLucideIcons();
}

async function renderRegisterView() {
  const grid = document.getElementById('quickActionsGrid');
  if (!grid) return;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayTimestamp = startOfToday.getTime();

  const allLogs = await getActionLogs();
  const todayLogs = allLogs.filter(l => l.timestamp >= todayTimestamp);

  const statTodayEl = document.getElementById('statTodayCount');
  const statTotalEl = document.getElementById('statTotalCount');
  if (statTodayEl) statTodayEl.textContent = String(todayLogs.length);
  if (statTotalEl) statTotalEl.textContent = String(allLogs.length);

  const todayCountMap = {};
  todayLogs.forEach(l => {
    todayCountMap[l.actionTypeId] = (todayCountMap[l.actionTypeId] || 0) + 1;
  });

  grid.innerHTML = '';

  // Filtrar acciones por la categoría activa en los chips
  let visibleActions = state.actionTypes;
  if (state.selectedRegisterCategory !== 'all') {
    visibleActions = visibleActions.filter(act => (act.categoryId || GENERIC_CATEGORY_ID) === state.selectedRegisterCategory);
  }

  if (visibleActions.length === 0) {
    const isFiltered = state.selectedRegisterCategory !== 'all';
    const catName = state.categoriesMap[state.selectedRegisterCategory]?.name || 'esta categoría';

    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i data-lucide="layers" style="width: 48px; height: 48px;"></i>
        <h3>${isFiltered ? `Sin acciones en "${catName}"` : 'No tienes acciones configuradas'}</h3>
        <p>${isFiltered ? 'Crea una acción asociada a esta categoría o selecciona otra categoría.' : 'Ve a la pestaña "Acciones" para crear tu primera acción personalizada.'}</p>
        <button id="btnGoToActions" class="btn-primary" style="margin-top: 14px; width: auto; display: inline-flex;">
          <i data-lucide="plus"></i> Crear Acción
        </button>
      </div>
    `;
    const btnGo = document.getElementById('btnGoToActions');
    if (btnGo) {
      btnGo.addEventListener('click', () => {
        switchView('view-actions');
        openActionTypeModal(null, state.selectedRegisterCategory !== 'all' ? state.selectedRegisterCategory : GENERIC_CATEGORY_ID);
      });
    }
    refreshLucideIcons();
    return;
  }

  visibleActions.forEach(act => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'action-btn-card';
    card.style.setProperty('--card-color', act.color || '#4f46e5');
    
    const lightColor = hexToRgba(act.color || '#4f46e5', 0.14);
    card.style.setProperty('--card-light', lightColor);

    const countToday = todayCountMap[act.id] || 0;
    const badgeClass = countToday > 0 ? 'count-badge has-count' : 'count-badge';

    const catObj = state.categoriesMap[act.categoryId || GENERIC_CATEGORY_ID];
    const catName = catObj ? catObj.name : 'Genérica';

    card.innerHTML = `
      <span class="${badgeClass}">${countToday > 0 ? `${countToday} hoy` : '0 hoy'}</span>
      <div class="icon-container">
        <i data-lucide="${act.icon || 'check-circle'}" style="width: 28px; height: 28px;"></i>
      </div>
      <span class="action-title">${escapeHTML(act.name)}</span>
      <span class="badge-category" style="margin-top: 6px; font-size: 0.65rem;">
        ${escapeHTML(catName)}
      </span>
    `;

    card.addEventListener('click', async () => {
      await handleTriggerAction(act);
    });

    grid.appendChild(card);
  });

  refreshLucideIcons();
}

async function handleTriggerAction(act) {
  if (navigator.vibrate) {
    try { navigator.vibrate(25); } catch (_) {}
  }

  try {
    const log = await logAction(act.id);
    const now = new Date(log.timestamp);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    await renderRegisterView();

    showToast(`✓ ${act.name} registrado (${timeStr})`, {
      actionText: 'Nota',
      onAction: () => openNoteModal(log.id, act.name)
    });
  } catch (err) {
    console.error('Error al registrar acción:', err);
    showToast('Error al registrar la acción');
  }
}

// ================= VISTA 2: HISTORIAL =================
async function renderHistoryView() {
  const container = document.getElementById('historyTimeline');
  const catFilterEl = document.getElementById('historyFilterCategory');
  const actionFilterEl = document.getElementById('historyFilterAction');
  const periodFilterEl = document.getElementById('historyFilterPeriod');
  if (!container) return;

  const selectedCategory = catFilterEl ? catFilterEl.value : 'all';
  const selectedAction = actionFilterEl ? actionFilterEl.value : 'all';
  const selectedPeriod = periodFilterEl ? periodFilterEl.value : 'all';

  let startDate = null;
  const now = new Date();

  if (selectedPeriod === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate = today.getTime();
  } else if (selectedPeriod === '7days') {
    startDate = now.getTime() - (7 * 24 * 60 * 60 * 1000);
  } else if (selectedPeriod === '30days') {
    startDate = now.getTime() - (30 * 24 * 60 * 60 * 1000);
  }

  const logs = await getActionLogs({
    actionTypeId: selectedAction,
    categoryId: selectedCategory,
    startDate: startDate,
    actionTypesMap: state.actionTypesMap
  });

  container.innerHTML = '';

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="clock" style="width: 44px; height: 44px;"></i>
        <h3>Sin registros</h3>
        <p>No se encontraron acciones registradas con los filtros seleccionados.</p>
      </div>
    `;
    refreshLucideIcons();
    return;
  }

  const groups = {};
  logs.forEach(log => {
    const d = new Date(log.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(log);
  });

  Object.keys(groups).forEach(dateKey => {
    const groupLogs = groups[dateKey];
    const groupHeaderTitle = getHumanDateTitle(dateKey);

    const groupDiv = document.createElement('div');
    groupDiv.className = 'timeline-group';

    groupDiv.innerHTML = `
      <div class="timeline-group-header">
        <span>${groupHeaderTitle}</span>
        <span>${groupLogs.length} ${groupLogs.length === 1 ? 'registro' : 'registros'}</span>
      </div>
      <div class="timeline-items" id="group_${dateKey}"></div>
    `;

    const itemsContainer = groupDiv.querySelector(`#group_${dateKey}`);

    groupLogs.forEach(log => {
      const act = state.actionTypesMap[log.actionTypeId] || {
        name: 'Acción previa',
        icon: 'check-circle',
        color: '#6366f1',
        categoryId: GENERIC_CATEGORY_ID
      };

      const catObj = state.categoriesMap[act.categoryId || GENERIC_CATEGORY_ID];
      const catName = catObj ? catObj.name : 'Genérica';

      const d = new Date(log.timestamp);
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

      const card = document.createElement('div');
      card.className = 'log-item-card';

      const lightBg = hexToRgba(act.color || '#4f46e5', 0.15);

      card.innerHTML = `
        <div class="log-item-left">
          <div class="log-icon-pill" style="background: ${lightBg}; color: ${act.color};">
            <i data-lucide="${act.icon || 'check-circle'}" style="width: 20px; height: 20px;"></i>
          </div>
          <div class="log-details">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="log-name">${escapeHTML(act.name)}</span>
              <span class="badge-category">${escapeHTML(catName)}</span>
            </div>
            <div class="log-meta">
              <i data-lucide="clock" style="width: 12px; height: 12px;"></i>
              <span>${timeStr}</span>
            </div>
            ${log.notes ? `<div class="log-notes-text">“${escapeHTML(log.notes)}”</div>` : ''}
          </div>
        </div>
        <div class="log-actions">
          <button class="btn-tiny" title="${log.notes ? 'Editar nota' : 'Añadir nota'}" data-action="note" data-id="${log.id}">
            <i data-lucide="${log.notes ? 'file-edit' : 'plus-circle'}" style="width: 16px; height: 16px;"></i>
          </button>
          <button class="btn-tiny danger" title="Eliminar registro" data-action="delete" data-id="${log.id}">
            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
          </button>
        </div>
      `;

      const btnNote = card.querySelector('[data-action="note"]');
      if (btnNote) {
        btnNote.addEventListener('click', () => openNoteModal(log.id, act.name, log.notes));
      }

      const btnDelete = card.querySelector('[data-action="delete"]');
      if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
          if (confirm(`¿Eliminar este registro de "${act.name}" a las ${timeStr}?`)) {
            await deleteActionLog(log.id);
            showToast('Registro eliminado');
            await renderHistoryView();
          }
        });
      }

      itemsContainer.appendChild(card);
    });

    container.appendChild(groupDiv);
  });

  refreshLucideIcons();
}

// Filtros de historial reactivos
document.getElementById('historyFilterCategory')?.addEventListener('change', (e) => {
  updateActionFilterSelects(e.target.value);
  renderHistoryView();
});
document.getElementById('historyFilterAction')?.addEventListener('change', renderHistoryView);
document.getElementById('historyFilterPeriod')?.addEventListener('change', renderHistoryView);

// ================= VISTA 3: CONFIGURACIÓN DE ACCIONES Y CATEGORÍAS =================
async function renderActionsConfigView() {
  renderCategoriesList();
  renderActionTypesList();
  refreshLucideIcons();
}

function renderCategoriesList() {
  const container = document.getElementById('categoriesList');
  if (!container) return;

  container.innerHTML = '';

  state.categories.forEach(cat => {
    const isGeneric = cat.id === GENERIC_CATEGORY_ID;
    const actionsInCat = state.actionTypes.filter(a => (a.categoryId || GENERIC_CATEGORY_ID) === cat.id);

    const row = document.createElement('div');
    row.className = 'action-type-row';

    row.innerHTML = `
      <div class="action-type-info">
        <div class="color-dot" style="background: ${cat.color || '#6366f1'};">
          <i data-lucide="${cat.icon || 'folder'}" style="width: 18px; height: 18px;"></i>
        </div>
        <div>
          <span class="action-type-name">${escapeHTML(cat.name)}</span>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            ${actionsInCat.length} ${actionsInCat.length === 1 ? 'acción' : 'acciones'}
            ${isGeneric ? ' • <strong style="color: var(--primary);">Genérica (Obligatoria)</strong>' : ''}
          </div>
        </div>
      </div>
      <div class="log-actions">
        ${!isGeneric ? `
          <button class="btn-tiny" title="Editar categoría" data-cat-action="edit">
            <i data-lucide="pencil" style="width: 16px; height: 16px;"></i>
          </button>
          <button class="btn-tiny danger" title="Eliminar categoría" data-cat-action="delete">
            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
          </button>
        ` : `
          <button class="btn-tiny" title="Editar categoría" data-cat-action="edit">
            <i data-lucide="pencil" style="width: 16px; height: 16px;"></i>
          </button>
          <span title="La categoría Genérica no puede eliminarse" style="font-size: 0.75rem; color: var(--text-light); padding: 4px;">
            <i data-lucide="lock" style="width: 15px; height: 15px;"></i>
          </span>
        `}
      </div>
    `;

    const btnEdit = row.querySelector('[data-cat-action="edit"]');
    if (btnEdit) {
      btnEdit.addEventListener('click', () => openCategoryModal(cat));
    }

    const btnDelete = row.querySelector('[data-cat-action="delete"]');
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        if (confirm(`¿Eliminar la categoría "${cat.name}"?\nTodas las acciones asociadas (${actionsInCat.length}) pasarán automáticamente a la categoría "Genérica".`)) {
          try {
            await deleteCategory(cat.id);
            await refreshAllData();
            await renderActionsConfigView();
            showToast(`Categoría "${cat.name}" eliminada. Acciones reasignadas a Genérica.`);
          } catch (err) {
            console.error('Error al eliminar categoría:', err);
            showToast(err.message || 'Error al eliminar categoría');
          }
        }
      });
    }

    container.appendChild(row);
  });
}

function renderActionTypesList() {
  const container = document.getElementById('actionTypesList');
  if (!container) return;

  container.innerHTML = '';

  if (state.actionTypes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="check-circle" style="width: 44px; height: 44px;"></i>
        <h3>Sin acciones</h3>
        <p>No tienes ninguna acción creada todavía. Haz clic en "Nueva Acción" para crear una.</p>
      </div>
    `;
    return;
  }

  state.actionTypes.forEach(act => {
    const catObj = state.categoriesMap[act.categoryId || GENERIC_CATEGORY_ID];
    const catName = catObj ? catObj.name : 'Genérica';

    const row = document.createElement('div');
    row.className = 'action-type-row';

    row.innerHTML = `
      <div class="action-type-info">
        <div class="color-dot" style="background: ${act.color || '#4f46e5'};">
          <i data-lucide="${act.icon || 'check-circle'}" style="width: 18px; height: 18px;"></i>
        </div>
        <div>
          <span class="action-type-name">${escapeHTML(act.name)}</span>
          <div style="margin-top: 2px;">
            <span class="badge-category">${escapeHTML(catName)}</span>
          </div>
        </div>
      </div>
      <div class="log-actions">
        <button class="btn-tiny" title="Editar acción" data-action="edit">
          <i data-lucide="pencil" style="width: 16px; height: 16px;"></i>
        </button>
        <button class="btn-tiny danger" title="Eliminar acción" data-action="delete">
          <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
        </button>
      </div>
    `;

    const btnEdit = row.querySelector('[data-action="edit"]');
    if (btnEdit) {
      btnEdit.addEventListener('click', () => openActionTypeModal(act));
    }

    const btnDelete = row.querySelector('[data-action="delete"]');
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        if (confirm(`¿Eliminar la acción "${act.name}"? Los registros del historial se conservarán.`)) {
          await deleteActionType(act.id);
          await refreshActionTypes();
          await renderActionsConfigView();
          showToast(`Acción "${act.name}" eliminada`);
        }
      });
    }

    container.appendChild(row);
  });
}

// Botones de creación
document.getElementById('btnNewCategory')?.addEventListener('click', () => openCategoryModal());
document.getElementById('btnNewAction')?.addEventListener('click', () => openActionTypeModal());

// ================= MODAL: CREAR / EDITAR CATEGORÍA =================
function openCategoryModal(cat = null) {
  const modal = document.getElementById('modalCategory');
  const title = document.getElementById('modalCategoryTitle');
  const idInput = document.getElementById('categoryIdInput');
  const nameInput = document.getElementById('categoryNameInput');
  const iconInput = document.getElementById('categoryIconInput');
  const colorInput = document.getElementById('categoryColorInput');
  const previewIcon = document.getElementById('categoryPreviewIconEl');

  if (!modal) return;

  state.editingCategoryId = cat ? cat.id : null;
  idInput.value = cat ? cat.id : '';
  nameInput.value = cat ? cat.name : '';
  iconInput.value = cat ? (cat.icon || 'folder') : 'folder';
  colorInput.value = cat ? (cat.color || '#6366f1') : '#6366f1';

  title.textContent = cat ? (cat.id === GENERIC_CATEGORY_ID ? 'Editar Categoría Genérica' : 'Editar Categoría') : 'Nueva Categoría';

  if (previewIcon) {
    previewIcon.setAttribute('data-lucide', iconInput.value);
  }

  renderCategoryIconPicker(iconInput.value);
  renderCategoryColorPicker(colorInput.value);

  modal.classList.add('active');
  refreshLucideIcons();

  setTimeout(() => nameInput.focus(), 100);
}

function closeCategoryModal() {
  const modal = document.getElementById('modalCategory');
  if (modal) modal.classList.remove('active');
}

function renderCategoryIconPicker(selectedIcon) {
  const grid = document.getElementById('categoryIconPickerGrid');
  const searchInput = document.getElementById('categoryIconSearch');
  const iconInput = document.getElementById('categoryIconInput');
  const previewIcon = document.getElementById('categoryPreviewIconEl');
  if (!grid) return;

  function updateGrid(filter = '') {
    grid.innerHTML = '';
    const filtered = POPULAR_LUCIDE_ICONS.filter(icon => icon.toLowerCase().includes(filter.toLowerCase()));

    filtered.forEach(iconName => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `icon-picker-item ${iconName === iconInput.value ? 'selected' : ''}`;
      item.innerHTML = `<i data-lucide="${iconName}" style="width: 20px; height: 20px;"></i>`;

      item.addEventListener('click', () => {
        iconInput.value = iconName;
        if (previewIcon) previewIcon.setAttribute('data-lucide', iconName);
        updateGrid(searchInput ? searchInput.value : '');
        refreshLucideIcons();
      });

      grid.appendChild(item);
    });
    refreshLucideIcons();
  }

  if (searchInput) {
    searchInput.value = '';
    searchInput.oninput = (e) => updateGrid(e.target.value);
  }

  updateGrid();
}

function renderCategoryColorPicker(selectedColor) {
  const palette = document.getElementById('categoryColorPickerPalette');
  const colorInput = document.getElementById('categoryColorInput');
  if (!palette) return;

  palette.innerHTML = '';

  PRESET_COLORS.forEach(hex => {
    const opt = document.createElement('div');
    opt.className = `color-option ${hex.toLowerCase() === selectedColor.toLowerCase() ? 'selected' : ''}`;
    opt.style.backgroundColor = hex;

    opt.addEventListener('click', () => {
      colorInput.value = hex;
      renderCategoryColorPicker(hex);
    });

    palette.appendChild(opt);
  });
}

// Guardar categoría desde el formulario
document.getElementById('formCategory')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('categoryIdInput').value;
  const name = document.getElementById('categoryNameInput').value.trim();
  const icon = document.getElementById('categoryIconInput').value;
  const color = document.getElementById('categoryColorInput').value;

  if (!name) {
    showToast('El nombre de la categoría es obligatorio');
    return;
  }

  try {
    const saved = await saveCategory({
      id: id || undefined,
      name,
      icon,
      color
    });

    closeCategoryModal();
    await refreshAllData();
    await refreshCurrentView();
    showToast(id ? `Categoría "${saved.name}" actualizada` : `Categoría "${saved.name}" creada con éxito`);
  } catch (err) {
    console.error('Error al guardar categoría:', err);
    showToast('Error al guardar categoría');
  }
});

// ================= MODAL: CREAR / EDITAR TIPO DE ACCIÓN =================
function openActionTypeModal(action = null, defaultCategoryId = null) {
  const modal = document.getElementById('modalActionType');
  const title = document.getElementById('modalActionTitle');
  const idInput = document.getElementById('actionTypeId');
  const catSelect = document.getElementById('actionCategorySelect');
  const nameInput = document.getElementById('actionNameInput');
  const iconInput = document.getElementById('actionIconInput');
  const colorInput = document.getElementById('actionColorInput');
  const previewIcon = document.getElementById('previewLucideIcon');

  if (!modal) return;

  state.editingActionId = action ? action.id : null;
  idInput.value = action ? action.id : '';
  nameInput.value = action ? action.name : '';
  iconInput.value = action ? action.icon : 'check-circle';
  colorInput.value = action ? action.color : '#4f46e5';

  if (catSelect) {
    catSelect.value = action 
      ? (action.categoryId || GENERIC_CATEGORY_ID) 
      : (defaultCategoryId || state.selectedRegisterCategory !== 'all' ? state.selectedRegisterCategory : GENERIC_CATEGORY_ID);
  }

  title.textContent = action ? 'Editar Acción' : 'Nueva Acción';

  if (previewIcon) {
    previewIcon.setAttribute('data-lucide', iconInput.value);
  }

  renderActionIconPicker(iconInput.value);
  renderActionColorPicker(colorInput.value);

  modal.classList.add('active');
  refreshLucideIcons();

  setTimeout(() => nameInput.focus(), 100);
}

function closeActionTypeModal() {
  const modal = document.getElementById('modalActionType');
  if (modal) modal.classList.remove('active');
}

function renderActionIconPicker(selectedIcon) {
  const grid = document.getElementById('iconPickerGrid');
  const searchInput = document.getElementById('iconSearchInput');
  const iconInput = document.getElementById('actionIconInput');
  const previewIcon = document.getElementById('previewLucideIcon');
  if (!grid) return;

  function updateGrid(filter = '') {
    grid.innerHTML = '';
    const filtered = POPULAR_LUCIDE_ICONS.filter(icon => icon.toLowerCase().includes(filter.toLowerCase()));

    filtered.forEach(iconName => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `icon-picker-item ${iconName === iconInput.value ? 'selected' : ''}`;
      item.innerHTML = `<i data-lucide="${iconName}" style="width: 20px; height: 20px;"></i>`;

      item.addEventListener('click', () => {
        iconInput.value = iconName;
        if (previewIcon) previewIcon.setAttribute('data-lucide', iconName);
        updateGrid(searchInput ? searchInput.value : '');
        refreshLucideIcons();
      });

      grid.appendChild(item);
    });
    refreshLucideIcons();
  }

  if (searchInput) {
    searchInput.value = '';
    searchInput.oninput = (e) => updateGrid(e.target.value);
  }

  updateGrid();
}

function renderActionColorPicker(selectedColor) {
  const palette = document.getElementById('colorPickerPalette');
  const colorInput = document.getElementById('actionColorInput');
  if (!palette) return;

  palette.innerHTML = '';

  PRESET_COLORS.forEach(hex => {
    const opt = document.createElement('div');
    opt.className = `color-option ${hex.toLowerCase() === selectedColor.toLowerCase() ? 'selected' : ''}`;
    opt.style.backgroundColor = hex;

    opt.addEventListener('click', () => {
      colorInput.value = hex;
      renderActionColorPicker(hex);
    });

    palette.appendChild(opt);
  });
}

// Guardar acción desde el formulario
document.getElementById('formActionType')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('actionTypeId').value;
  const categoryId = document.getElementById('actionCategorySelect').value || GENERIC_CATEGORY_ID;
  const rawName = document.getElementById('actionNameInput').value.trim();
  const icon = document.getElementById('actionIconInput').value;
  const color = document.getElementById('actionColorInput').value;

  if (!rawName) {
    showToast('El nombre de la acción es obligatorio');
    return;
  }

  try {
    const saved = await saveActionType({
      id: id || undefined,
      categoryId,
      name: rawName,
      icon,
      color
    });

    closeActionTypeModal();
    await refreshActionTypes();
    await refreshCurrentView();

    const wasRenamed = saved.name !== rawName;
    if (wasRenamed) {
      showToast(`Acción guardada como "${saved.name}" (nombre ya existía)`);
    } else {
      showToast(id ? `Acción "${saved.name}" actualizada` : `Acción "${saved.name}" creada con éxito`);
    }
  } catch (err) {
    console.error('Error al guardar acción:', err);
    showToast('Error al guardar la acción');
  }
});

// ================= MODAL: AÑADIR/EDITAR NOTA =================
function openNoteModal(logId, actionName, existingNote = '') {
  const modal = document.getElementById('modalNote');
  const idInput = document.getElementById('noteLogId');
  const textInput = document.getElementById('noteTextInput');
  const subtitle = document.getElementById('noteModalSubtitle');

  if (!modal) return;

  idInput.value = logId;
  textInput.value = existingNote || '';
  if (subtitle) {
    subtitle.textContent = `Detalles para "${actionName}":`;
  }

  modal.classList.add('active');
  setTimeout(() => textInput.focus(), 100);
}

function closeNoteModal() {
  const modal = document.getElementById('modalNote');
  if (modal) modal.classList.remove('active');
}

async function saveNoteFromModal() {
  const logId = document.getElementById('noteLogId').value;
  const notes = document.getElementById('noteTextInput').value;

  if (!logId) return;

  try {
    await updateActionLog(logId, { notes });
    closeNoteModal();
    showToast('Nota guardada');
    await refreshCurrentView();
  } catch (err) {
    console.error('Error al guardar nota:', err);
    showToast('Error al guardar la nota');
  }
}

// ================= VISTA 4: EXPORTAR Y GENERAR PDF =================
function initExportViews() {
  const periodSelect = document.getElementById('pdfPeriodSelect');
  const customRange = document.getElementById('pdfCustomDateRange');
  const catSelect = document.getElementById('pdfCategorySelect');

  if (periodSelect && customRange) {
    periodSelect.addEventListener('change', () => {
      customRange.style.display = periodSelect.value === 'custom' ? 'grid' : 'none';
    });
  }

  // Al cambiar categoría en el informe, filtrar selector de acción correspondiente
  if (catSelect) {
    catSelect.addEventListener('change', (e) => {
      updateActionFilterSelects(e.target.value);
    });
  }

  const btnPDF = document.getElementById('btnGeneratePDF');
  if (btnPDF) btnPDF.onclick = handleGeneratePDF;

  const btnExportJSON = document.getElementById('btnExportJSON');
  if (btnExportJSON) btnExportJSON.onclick = handleExportJSON;

  const inputImport = document.getElementById('inputImportJSON');
  if (inputImport) inputImport.onchange = handleImportJSON;
}

async function updateExportFilters() {
  updateCategoryFilterSelects();
  const catSelect = document.getElementById('pdfCategorySelect');
  updateActionFilterSelects(catSelect ? catSelect.value : 'all');
}

async function handleGeneratePDF() {
  const periodSelect = document.getElementById('pdfPeriodSelect');
  const catSelect = document.getElementById('pdfCategorySelect');
  const actionSelect = document.getElementById('pdfActionSelect');
  const customStart = document.getElementById('pdfCustomStart');
  const customEnd = document.getElementById('pdfCustomEnd');

  const periodValue = periodSelect ? periodSelect.value : 'all';
  const categoryValue = catSelect ? catSelect.value : 'all';
  const actionValue = actionSelect ? actionSelect.value : 'all';

  let startDate = null;
  let endDate = null;
  let periodTitle = 'Todo el historial';
  const now = new Date();

  if (periodValue === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate = today.getTime();
    periodTitle = `Hoy (${formatShortDate(today.getTime())})`;
  } else if (periodValue === '7days') {
    startDate = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    periodTitle = 'Últimos 7 días';
  } else if (periodValue === 'this_month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate = firstDay.getTime();
    periodTitle = `Este mes (${now.toLocaleString('es', { month: 'long', year: 'numeric' })})`;
  } else if (periodValue === 'custom') {
    if (customStart && customStart.value) {
      const d1 = new Date(customStart.value);
      d1.setHours(0, 0, 0, 0);
      startDate = d1.getTime();
    }
    if (customEnd && customEnd.value) {
      const d2 = new Date(customEnd.value);
      d2.setHours(23, 59, 59, 999);
      endDate = d2.getTime();
    }
    periodTitle = `Desde ${customStart?.value || 'inicio'} hasta ${customEnd?.value || 'hoy'}`;
  }

  const logs = await getActionLogs({
    actionTypeId: actionValue,
    categoryId: categoryValue,
    startDate,
    endDate,
    actionTypesMap: state.actionTypesMap
  });

  const selectedCatObj = state.categoriesMap[categoryValue];
  const categoryTitle = selectedCatObj ? selectedCatObj.name : 'Todas las categorías';

  const selectedActionObj = state.actionTypesMap[actionValue];
  const filterLabel = selectedActionObj ? selectedActionObj.name : 'Todas las acciones';

  try {
    const success = generateActionsPDF(logs, state.actionTypesMap, state.categoriesMap, {
      periodTitle,
      categoryTitle,
      filterLabel,
      filenamePrefix: 'registro_acciones'
    });
    if (success) {
      showToast('✓ Informe PDF generado con éxito');
    }
  } catch (err) {
    console.error('Error al generar PDF:', err);
    showToast('Error al generar el documento PDF');
  }
}

async function handleExportJSON() {
  try {
    const data = await exportAllData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_acciones_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);

    showToast('✓ Copia de seguridad descargada (JSON)');
  } catch (err) {
    console.error('Error al exportar copia de seguridad:', err);
    showToast('Error al crear copia de seguridad');
  }
}

async function handleImportJSON(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (confirm('¿Restaurar esta copia de seguridad? Se reemplazarán las categorías, acciones y registros actuales.')) {
        const result = await importAllData(parsed);
        await refreshAllData();
        await refreshCurrentView();
        showToast(`✓ Restaurado: ${result.categoriesCount || 0} categorías, ${result.typesCount} acciones y ${result.logsCount} registros`);
      }
    } catch (err) {
      console.error('Error al importar:', err);
      alert('El archivo no es una copia de seguridad válida de Registro de Acciones.');
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
}

// ================= COMPONENTE TOAST NOTIFICATION =================
function showToast(message, options = {}) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const { duration = 3200, actionText, onAction } = options;

  const toast = document.createElement('div');
  toast.className = 'toast';

  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  if (actionText && typeof onAction === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-btn';
    btn.textContent = actionText;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onAction();
      dismissToast(toast);
    });
    toast.appendChild(btn);
  }

  container.appendChild(toast);

  const timer = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  toast.addEventListener('click', () => {
    clearTimeout(timer);
    dismissToast(toast);
  });
}

function dismissToast(toast) {
  if (!toast || toast.classList.contains('dismissing')) return;
  toast.classList.add('dismissing');
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 250);
}

// ================= UTILIDADES =================
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hexToRgba(hex, alpha = 1) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getHumanDateTitle(isoDateStr) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (isoDateStr === todayKey) return 'Hoy';
  if (isoDateStr === yesterdayKey) return 'Ayer';

  const parts = isoDateStr.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatShortDate(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

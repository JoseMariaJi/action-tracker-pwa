/**
 * Capa de abstracción IndexedDB para Registro de Acciones
 * Versión 2: Soporte completo de Categorías y asignaciones.
 * 100% local, basada en Promesas estándar.
 */

const DB_NAME = 'ActionTrackerDB';
const DB_VERSION = 2; // Actualizado para soportar categories

let dbInstance = null;
let dbPromise = null;

// Categoría Genérica protegida que nunca puede ser eliminada
export const GENERIC_CATEGORY_ID = 'cat_generic';

export const DEFAULT_CATEGORIES = [
  { id: GENERIC_CATEGORY_ID, name: 'Genérica', icon: 'folder', color: '#64748b', isDefault: true, isPreferred: true, order: 0, createdAt: 1700000000000 },
  { id: 'cat_health', name: 'Salud y Bienestar', icon: 'heart', color: '#0ea5e9', isDefault: false, isPreferred: false, order: 1, createdAt: 1700000001000 },
  { id: 'cat_habits', name: 'Hábitos y Estudio', icon: 'sparkles', color: '#8b5cf6', isDefault: false, isPreferred: false, order: 2, createdAt: 1700000002000 }
];

// Acciones iniciales vinculadas a categorías
export const DEFAULT_ACTION_TYPES = [
  { id: 'act_water', name: 'Beber Agua', icon: 'droplet', color: '#0ea5e9', categoryId: 'cat_health', order: 1, createdAt: 1700000000000 },
  { id: 'act_meds', name: 'Medicamento', icon: 'pill', color: '#ec4899', categoryId: 'cat_health', order: 2, createdAt: 1700000001000 },
  { id: 'act_exercise', name: 'Ejercicio', icon: 'dumbbell', color: '#f59e0b', categoryId: 'cat_health', order: 3, createdAt: 1700000002000 },
  { id: 'act_break', name: 'Pausa Activa', icon: 'coffee', color: '#8b5cf6', categoryId: 'cat_habits', order: 4, createdAt: 1700000003000 },
  { id: 'act_study', name: 'Estudio / Trabajo', icon: 'book-open', color: '#10b981', categoryId: 'cat_habits', order: 5, createdAt: 1700000004000 }
];

export function generateId(prefix = 'item') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function openDatabase() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // 1. Store para Categorías
      let catStore;
      if (!db.objectStoreNames.contains('categories')) {
        catStore = db.createObjectStore('categories', { keyPath: 'id' });
        catStore.createIndex('name', 'name', { unique: false });
        catStore.createIndex('order', 'order', { unique: false });
        catStore.createIndex('createdAt', 'createdAt', { unique: false });

        DEFAULT_CATEGORIES.forEach(item => catStore.put(item));
      } else {
        catStore = event.target.transaction.objectStore('categories');
      }

      // Asegurar siempre la categoría genérica
      catStore.put(DEFAULT_CATEGORIES[0]);

      // 2. Store para Tipos de Acción
      let typesStore;
      if (!db.objectStoreNames.contains('action_types')) {
        typesStore = db.createObjectStore('action_types', { keyPath: 'id' });
        typesStore.createIndex('name', 'name', { unique: false });
        typesStore.createIndex('categoryId', 'categoryId', { unique: false });
        typesStore.createIndex('order', 'order', { unique: false });
        typesStore.createIndex('createdAt', 'createdAt', { unique: false });

        DEFAULT_ACTION_TYPES.forEach(item => typesStore.put(item));
      } else {
        typesStore = event.target.transaction.objectStore('action_types');
        if (!typesStore.indexNames.contains('categoryId')) {
          typesStore.createIndex('categoryId', 'categoryId', { unique: false });
        }

        // Migración de v1 a v2: si hay acciones sin categoryId, asociarlas a Genérica
        if (oldVersion < 2) {
          const getAllReq = typesStore.getAll();
          getAllReq.onsuccess = () => {
            const actions = getAllReq.result || [];
            actions.forEach(action => {
              if (!action.categoryId) {
                action.categoryId = GENERIC_CATEGORY_ID;
                typesStore.put(action);
              }
            });
          };
        }
      }

      // 3. Store para Registros de Acciones
      if (!db.objectStoreNames.contains('action_logs')) {
        const logsStore = db.createObjectStore('action_logs', { keyPath: 'id' });
        logsStore.createIndex('actionTypeId', 'actionTypeId', { unique: false });
        logsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = async (event) => {
      dbInstance = event.target.result;

      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
        dbPromise = null;
      };

      try {
        await verifyAndSeedIfEmpty(dbInstance);
      } catch (err) {
        console.warn('Verificación inicial de IndexedDB v2:', err);
      }

      resolve(dbInstance);
    };

    request.onerror = (event) => {
      dbPromise = null;
      console.error('Error al abrir IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });

  return dbPromise;
}

function verifyAndSeedIfEmpty(db) {
  return new Promise((resolve) => {
    const tx = db.transaction(['categories', 'action_types'], 'readwrite');
    const catStore = tx.objectStore('categories');
    const actionStore = tx.objectStore('action_types');

    // Garantizar que la categoría Genérica existe siempre
    catStore.put(DEFAULT_CATEGORIES[0]);

    const countCatReq = catStore.count();
    countCatReq.onsuccess = () => {
      if (countCatReq.result <= 1) {
        DEFAULT_CATEGORIES.forEach(item => catStore.put(item));
      }
    };

    const countActReq = actionStore.count();
    countActReq.onsuccess = () => {
      if (countActReq.result === 0) {
        DEFAULT_ACTION_TYPES.forEach(item => actionStore.put(item));
      } else {
        // Asegurar que ninguna acción quede huérfana de categoría
        const allReq = actionStore.getAll();
        allReq.onsuccess = () => {
          (allReq.result || []).forEach(act => {
            if (!act.categoryId) {
              act.categoryId = GENERIC_CATEGORY_ID;
              actionStore.put(act);
            }
          });
        };
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

// ================= GESTIÓN DE CATEGORÍAS =================

export async function getCategories() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readonly');
    const store = tx.objectStore('categories');
    const request = store.getAll();

    request.onsuccess = () => {
      const list = request.result || [];
      // Asegurar que la categoría Genérica esté presente si no estuviera
      const hasGeneric = list.some(c => c.id === GENERIC_CATEGORY_ID);
      if (!hasGeneric) {
        list.unshift(DEFAULT_CATEGORIES[0]);
      }
      // Orden: 1) preferida, 2) resto, 3) Genérica al final
      list.sort((a, b) => {
        // 1) Colocar Genérica al final
        if (a.id === GENERIC_CATEGORY_ID) return 1;
        if (b.id === GENERIC_CATEGORY_ID) return -1;
        // 2) Preferida primero
        if (a.isPreferred && !b.isPreferred) return -1;
        if (!a.isPreferred && b.isPreferred) return 1;
        // 3) Orden por campo order o alfabético como fallback
        return (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name);
      });
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getCategoryById(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readonly');
    const store = tx.objectStore('categories');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCategory(category) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');

    const itemToSave = {
      id: category.id || generateId('cat'),
      name: (category.name || '').trim(),
      icon: category.icon || 'folder',
      color: category.color || '#6366f1',
      isDefault: category.id === GENERIC_CATEGORY_ID,
      isPreferred: !!category.isPreferred,
      order: Number(category.order) || Date.now(),
      createdAt: category.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    const request = store.put(itemToSave);
    request.onsuccess = () => resolve(itemToSave);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Elimina una categoría reasignando automáticamente todas sus acciones a 'Genérica'.
 * La categoría 'Genérica' nunca puede ser eliminada.
 */
export async function setPreferredCategory(catId) {
  if (catId === GENERIC_CATEGORY_ID) {
    // Ensure generic remains preferred if requested
    // No action needed, will set below
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    // First, clear existing preferred flags
    const getAllReq = store.getAll();
    getAllReq.onsuccess = () => {
      const cats = getAllReq.result || [];
      cats.forEach(c => {
        if (c.isPreferred) {
          c.isPreferred = false;
          store.put(c);
        }
      });
      // Then set preferred for target
      const targetReq = store.get(catId);
      targetReq.onsuccess = () => {
        const target = targetReq.result;
        if (target) {
          target.isPreferred = true;
          store.put(target);
          resolve(true);
        } else {
          reject(new Error('Categoría no encontrada'));
        }
      };
      targetReq.onerror = () => reject(targetReq.error);
    };
    getAllReq.onerror = () => reject(getAllReq.error);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Update saveCategory to persist isPreferred flag
export async function deleteCategory(categoryId) {

  if (categoryId === GENERIC_CATEGORY_ID) {
    throw new Error('La categoría Genérica es obligatoria y no puede ser eliminada.');
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['categories', 'action_types'], 'readwrite');
    const catStore = tx.objectStore('categories');
    const actionStore = tx.objectStore('action_types');

    // 1. Reasignar todas las acciones de esta categoría a Genérica
    const getActionsReq = actionStore.getAll();
    getActionsReq.onsuccess = () => {
      const actions = getActionsReq.result || [];
      actions.forEach(action => {
        if (action.categoryId === categoryId) {
          action.categoryId = GENERIC_CATEGORY_ID;
          action.updatedAt = Date.now();
          actionStore.put(action);
        }
      });
      // 2. Eliminar la categoría
      catStore.delete(categoryId);
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// ================= GESTIÓN DE TIPOS DE ACCIÓN =================

/**
 * Comprueba colisiones de nombres y renombra con sufijo (2), (3), etc.
 */
async function resolveUniqueActionName(rawName, currentId = null) {
  const trimmed = (rawName || '').trim();
  const allActions = await getActionTypes();

  // Filtrar la acción actual para permitir guardar con su mismo nombre
  const otherActions = allActions.filter(a => a.id !== currentId);
  const existingNames = new Set(otherActions.map(a => a.name.toLowerCase()));

  if (!existingNames.has(trimmed.toLowerCase())) {
    return trimmed;
  }

  // Extraer base sin sufijo si ya tenía uno
  const match = trimmed.match(/^(.*?)(?:\s*\((\d+)\))?$/);
  const baseName = match && match[1] ? match[1].trim() : trimmed;

  let counter = 2;
  while (existingNames.has(`${baseName} (${counter})`.toLowerCase())) {
    counter++;
  }

  return `${baseName} (${counter})`;
}

export async function getActionTypes(categoryId = null) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('action_types', 'readonly');
    const store = tx.objectStore('action_types');
    const request = store.getAll();

    request.onsuccess = () => {
      let results = request.result || [];
      if (categoryId && categoryId !== 'all') {
        results = results.filter(act => (act.categoryId || GENERIC_CATEGORY_ID) === categoryId);
      }
      results.sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0));
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getActionTypeById(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('action_types', 'readonly');
    const store = tx.objectStore('action_types');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveActionType(action) {
  // Asegurar nombre único con sufijo (2), (3) si ya existiera
  const uniqueName = await resolveUniqueActionName(action.name, action.id);
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('action_types', 'readwrite');
    const store = tx.objectStore('action_types');

    const itemToSave = {
      id: action.id || generateId('act'),
      name: uniqueName,
      icon: action.icon || 'check-circle',
      color: action.color || '#4f46e5',
      categoryId: action.categoryId || GENERIC_CATEGORY_ID,
      order: Number(action.order) || Date.now(),
      createdAt: action.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    const request = store.put(itemToSave);

    request.onsuccess = () => resolve(itemToSave);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteActionType(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('action_types', 'readwrite');
    const store = tx.objectStore('action_types');
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// ================= GESTIÓN DE REGISTROS (LOGS) =================

export async function logAction(actionTypeId, notes = '', customTimestamp = null) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('action_logs', 'readwrite');
    const store = tx.objectStore('action_logs');

    const logEntry = {
      id: generateId('log'),
      actionTypeId,
      timestamp: customTimestamp || Date.now(),
      notes: (notes || '').trim()
    };

    const request = store.add(logEntry);

    request.onsuccess = () => resolve(logEntry);
    request.onerror = () => reject(request.error);
  });
}

export async function getActionLogs(filters = {}) {
  const db = await openDatabase();
  const { actionTypeId, categoryId, startDate, endDate, limit, actionTypesMap } = filters;

  return new Promise((resolve, reject) => {
    const tx = db.transaction('action_logs', 'readonly');
    const store = tx.objectStore('action_logs');
    const request = store.getAll();

    request.onsuccess = () => {
      let results = request.result || [];

      // Filtrar por acción específica
      if (actionTypeId && actionTypeId !== 'all') {
        results = results.filter(log => log.actionTypeId === actionTypeId);
      }

      // Filtrar por categoría si se especificó y tenemos el mapa
      if (categoryId && categoryId !== 'all' && actionTypesMap) {
        results = results.filter(log => {
          const act = actionTypesMap[log.actionTypeId];
          const actCat = act ? (act.categoryId || GENERIC_CATEGORY_ID) : GENERIC_CATEGORY_ID;
          return actCat === categoryId;
        });
      }

      // Filtrar por rango de fechas
      if (startDate) {
        results = results.filter(log => log.timestamp >= startDate);
      }
      if (endDate) {
        results = results.filter(log => log.timestamp <= endDate);
      }

      // Ordenar descendente (más reciente primero)
      results.sort((a, b) => b.timestamp - a.timestamp);

      if (limit && Number(limit) > 0) {
        results = results.slice(0, Number(limit));
      }

      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function updateActionLog(id, updates = {}) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('action_logs', 'readwrite');
    const store = tx.objectStore('action_logs');
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const current = getRequest.result;
      if (!current) {
        return reject(new Error('Registro no encontrado'));
      }

      const updated = {
        ...current,
        notes: updates.notes !== undefined ? updates.notes.trim() : current.notes,
        timestamp: updates.timestamp !== undefined ? updates.timestamp : current.timestamp,
        updatedAt: Date.now()
      };

      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve(updated);
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function deleteActionLog(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('action_logs', 'readwrite');
    const store = tx.objectStore('action_logs');
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// ================= COPIA DE SEGURIDAD (EXPORTAR / IMPORTAR) =================

export async function exportAllData() {
  const [categories, actionTypes, actionLogs] = await Promise.all([
    getCategories(),
    getActionTypes(),
    getActionLogs()
  ]);

  return {
    version: DB_VERSION,
    appName: 'ActionTrackerPWA',
    exportedAt: new Date().toISOString(),
    categories,
    actionTypes,
    actionLogs
  };
}

export async function importAllData(data) {
  if (!data || !Array.isArray(data.actionTypes) || !Array.isArray(data.actionLogs)) {
    throw new Error('Formato de datos de copia de seguridad no válido');
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['categories', 'action_types', 'action_logs'], 'readwrite');

    const catStore = tx.objectStore('categories');
    const typesStore = tx.objectStore('action_types');
    const logsStore = tx.objectStore('action_logs');

    catStore.clear();
    typesStore.clear();
    logsStore.clear();

    // Importar categorías (o valores por defecto si venía de versión 1)
    const importedCats = Array.isArray(data.categories) && data.categories.length > 0
      ? data.categories
      : DEFAULT_CATEGORIES;

    importedCats.forEach(cat => catStore.put(cat));
    // Garantizar que la Genérica siempre esté presente
    catStore.put(DEFAULT_CATEGORIES[0]);

    data.actionTypes.forEach(type => {
      if (!type.categoryId) type.categoryId = GENERIC_CATEGORY_ID;
      typesStore.put(type);
    });

    data.actionLogs.forEach(log => logsStore.put(log));

    tx.oncomplete = () => resolve({
      categoriesCount: importedCats.length,
      typesCount: data.actionTypes.length,
      logsCount: data.actionLogs.length
    });
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllData() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['categories', 'action_types', 'action_logs'], 'readwrite');
    tx.objectStore('categories').clear();
    tx.objectStore('action_types').clear();
    tx.objectStore('action_logs').clear();

    DEFAULT_CATEGORIES.forEach(cat => tx.objectStore('categories').put(cat));

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

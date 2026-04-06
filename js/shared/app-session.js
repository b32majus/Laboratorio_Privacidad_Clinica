// Session storage wrapper for sensitive app data.
// Uses sessionStorage by default and migrates legacy localStorage keys.
(function initAppSession(global) {
  const KEYS = {
    clinicalText: "app.clinicalText",
    batchResults: "app.batchResults",
    processingOptions: "app.processingOptions"
  };

  const LEGACY_KEYS = {
    clinicalText: "clinicalText",
    batchResults: "batchResults",
    processingOptions: "processingOptions"
  };

  function getStore() {
    try {
      if (typeof sessionStorage !== "undefined") {
        return sessionStorage;
      }
    } catch (error) {
      // fall through
    }
    return null;
  }

  function readLegacy(key) {
    try {
      if (typeof localStorage === "undefined") return null;
      const value = localStorage.getItem(key);
      return value;
    } catch (error) {
      return null;
    }
  }

  function removeLegacy(key) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } catch (error) {
      // no-op
    }
  }

  function migrateKey(store, newKey, oldKey) {
    if (!store) return;
    const currentValue = store.getItem(newKey);
    if (currentValue !== null) return;
    const legacyValue = readLegacy(oldKey);
    if (legacyValue !== null) {
      store.setItem(newKey, legacyValue);
      removeLegacy(oldKey);
    }
  }

  function migrateLegacyKeys() {
    const store = getStore();
    if (!store) return;
    migrateKey(store, KEYS.clinicalText, LEGACY_KEYS.clinicalText);
    migrateKey(store, KEYS.batchResults, LEGACY_KEYS.batchResults);
    migrateKey(store, KEYS.processingOptions, LEGACY_KEYS.processingOptions);
  }

  function getItem(keyName) {
    const store = getStore();
    if (!store) return null;
    return store.getItem(keyName);
  }

  function setItem(keyName, value) {
    const store = getStore();
    if (!store) return;
    store.setItem(keyName, value);
  }

  function removeItem(keyName) {
    const store = getStore();
    if (!store) return;
    store.removeItem(keyName);
  }

  function safeJsonParse(value) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function safeJsonStringify(value) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return null;
    }
  }

  function clearAllSensitiveData() {
    removeItem(KEYS.clinicalText);
    removeItem(KEYS.batchResults);
    removeItem(KEYS.processingOptions);
    removeLegacy(LEGACY_KEYS.clinicalText);
    removeLegacy(LEGACY_KEYS.batchResults);
    removeLegacy(LEGACY_KEYS.processingOptions);
  }

  migrateLegacyKeys();

  global.AppSession = {
    keys: KEYS,
    migrateLegacyKeys,
    clearAllSensitiveData,

    setClinicalText(text) {
      setItem(KEYS.clinicalText, text || "");
    },

    getClinicalText() {
      return getItem(KEYS.clinicalText);
    },

    clearClinicalText() {
      removeItem(KEYS.clinicalText);
      removeLegacy(LEGACY_KEYS.clinicalText);
    },

    setBatchResults(data) {
      const serialized = safeJsonStringify(data);
      if (serialized !== null) {
        setItem(KEYS.batchResults, serialized);
      }
    },

    getBatchResults() {
      return safeJsonParse(getItem(KEYS.batchResults));
    },

    clearBatchResults() {
      removeItem(KEYS.batchResults);
      removeLegacy(LEGACY_KEYS.batchResults);
    },

    setProcessingOptions(options) {
      const serialized = safeJsonStringify(options || {});
      if (serialized !== null) {
        setItem(KEYS.processingOptions, serialized);
      }
    },

    getProcessingOptions() {
      return safeJsonParse(getItem(KEYS.processingOptions)) || {};
    },

    clearProcessingOptions() {
      removeItem(KEYS.processingOptions);
      removeLegacy(LEGACY_KEYS.processingOptions);
    }
  };
})(window);

/* Immutable view captures and reviewed rendering results, stored on this device. */
(function () {
  'use strict';
  let opening;
  const open = () => opening || (opening = new Promise((resolve, reject) => {
    const q = indexedDB.open('pc-render-library', 1);
    q.onupgradeneeded = () => {
      const store = q.result.createObjectStore('items', {keyPath: 'id'});
      store.createIndex('project', 'project');
    };
    q.onsuccess = () => { q.result.onversionchange = () => q.result.close(); resolve(q.result); };
    q.onerror = () => { opening = null; reject(q.error); };
    q.onblocked = () => { opening = null; reject(Error('Close other PlotCloud tabs to update image storage.')); };
  }));
  async function transaction(mode, read) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('items', mode), request = read(tx.objectStore('items'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(tx.error || Error('Image storage unavailable.'));
    });
  }
  window.PlotCloudRenders = {
    put: item => {
      if (!item.id || !item.project || !item.sourceContext || !item.imageData?.startsWith('data:image/')) return Promise.reject(Error('Incomplete image record.'));
      return transaction('readwrite', s => s.add(item)).then(() => item);
    },
    get: id => transaction('readonly', s => s.get(id)),
    list: project => transaction('readonly', s => s.index('project').getAll(project)).then(items => items.sort((a,b) => b.createdAt.localeCompare(a.createdAt))),
    remove: id => transaction('readwrite', s => s.delete(id))
  };
})();

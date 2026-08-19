// Offline Sync Manager for Kraft Your Trip Admin Portal

export function getQueue() {
  try {
    const queue = localStorage.getItem('kraft_sync_queue');
    return queue ? JSON.parse(queue) : [];
  } catch (err) {
    console.error('Failed to read sync queue from localStorage:', err);
    return [];
  }
}

export function saveQueue(queue) {
  try {
    localStorage.setItem('kraft_sync_queue', JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to write sync queue to localStorage:', err);
  }
}

export function enqueueRequest({ url, method, headers, body, description, retries = 0, maxRetries = 3 }) {
  const queue = getQueue();
  const newItem = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
    url,
    method,
    headers: headers || {},
    body: body || null,
    description,
    retries,
    maxRetries,
    timestamp: Date.now()
  };
  queue.push(newItem);
  saveQueue(queue);
  return queue;
}

export function removeFromQueue(id) {
  const queue = getQueue();
  const updated = queue.filter(item => item.id !== id);
  saveQueue(updated);
  return updated;
}

export function clearQueue() {
  try {
    localStorage.removeItem('kraft_sync_queue');
  } catch (err) {
    console.error('Failed to clear sync queue from localStorage:', err);
  }
}

/**
 * Sequentially process the queue.
 * Stops on the first network error to maintain order.
 * Removes successful items or items with unresolvable client errors (4xx).
 * Retries server errors (5xx/408/429) up to maxRetries before discarding to prevent deadlocks.
 */
export async function processSyncQueue(addNotification, onProgress) {
  const queue = getQueue();
  if (queue.length === 0) return { success: true, processedCount: 0 };

  let processedCount = 0;
  const remainingQueue = [...queue];

  for (const item of queue) {
    if (onProgress) {
      onProgress(item.description);
    }
    
    try {
      const token = localStorage.getItem('kraft_token');
      const res = await fetch(item.url, {
        method: item.method,
        headers: {
          ...item.headers,
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: item.body,
      });

      if (res.ok) {
        // Success: remove from the remaining queue
        const index = remainingQueue.findIndex(q => q.id === item.id);
        if (index !== -1) remainingQueue.splice(index, 1);
        saveQueue(remainingQueue);
        processedCount++;
        
        if (addNotification) {
          addNotification(`Synced successfully: ${item.description}`, 'success');
        }
      } else {
        if (res.status >= 500 || res.status === 408 || res.status === 429) {
          const currentRetries = (item.retries || 0) + 1;
          const maxRetries = item.maxRetries || 3;

          if (currentRetries >= maxRetries) {
            // Reached retry limit: discard from queue (dead-letter) to avoid deadlocking the queue
            console.error(`Sync queue item exceeded max retries (${currentRetries}/${maxRetries}), discarding:`, item);
            const index = remainingQueue.findIndex(q => q.id === item.id);
            if (index !== -1) remainingQueue.splice(index, 1);
            saveQueue(remainingQueue);

            if (addNotification) {
              addNotification(`Sync failed after ${currentRetries} attempts (discarded): ${item.description} (Error ${res.status})`, 'error');
            }
            continue;
          } else {
            // Increment retries on the item in remainingQueue and pause
            const index = remainingQueue.findIndex(q => q.id === item.id);
            if (index !== -1) {
              remainingQueue[index] = { ...remainingQueue[index], retries: currentRetries };
            }
            saveQueue(remainingQueue);
            console.warn(`Sync queue paused (attempt ${currentRetries}/${maxRetries}). Server returned status ${res.status} for ${item.url}`);
            return { success: false, processedCount, error: `Server returned ${res.status}` };
          }
        } else {
          // Client-side validation or logic error (400, 404, 409, etc.): 
          // Log, notify user, and skip to avoid blocking the queue forever
          console.error(`Skipping invalid queue item (Status ${res.status}):`, item);
          const index = remainingQueue.findIndex(q => q.id === item.id);
          if (index !== -1) remainingQueue.splice(index, 1);
          saveQueue(remainingQueue);
          
          if (addNotification) {
            addNotification(`Sync failed (discarded): ${item.description} (Error ${res.status})`, 'warning');
          }
        }
      }
    } catch (err) {
      // Network failure / Server completely offline: Pause processing
      console.warn(`Sync queue paused due to network/server offline:`, err);
      return { success: false, processedCount, error: 'Network error' };
    }
  }

  return { success: true, processedCount };
}

/**
 * Checks backend server health and latency
 */
export async function checkServerHealth(apiUrl) {
  const startTime = Date.now();
  try {
    const res = await fetch(`${apiUrl}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    
    if (res.ok) {
      const latency = Date.now() - startTime;
      const data = await res.json();
      return { online: true, latency, timestamp: data.timestamp || new Date().toISOString() };
    }
    return { online: false, latency: null, timestamp: null };
  } catch {
    return { online: false, latency: null, timestamp: null };
  }
}

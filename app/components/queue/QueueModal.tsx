'use client';

import { useState, useEffect } from 'react';
import { Song, QueueItem, getQueue, clearQueue, getSong, removeFromQueue } from '@/app/lib/api';
import { decodeHtmlEntities } from '@/app/lib/utils';
import '@/app/styles/modal.css';

interface QueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QueueModal({ isOpen, onClose }: QueueModalProps) {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadQueue();
    }
  }, [isOpen]);

  const loadQueue = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await getQueue();
      setQueueItems(items);
    } catch (err) {
      setError('Failed to load queue');
      console.error('Failed to load queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearQueue = async () => {
    setIsLoading(true);
    try {
      await clearQueue();
      await loadQueue();
    } catch (err) {
      setError('Failed to clear queue');
      console.error('Failed to clear queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveItem = async (index: number) => {
    try {
      await removeFromQueue(index);
      await loadQueue();
    } catch (err) {
      setError('Failed to remove item from queue');
      console.error('Failed to remove item from queue:', err);
    }
  };

  // Separate official and unofficial queue items
  const officialItems = queueItems.filter(item => item.index < 1000);
  const unofficialItems = queueItems.filter(item => item.index >= 1000);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Upcoming</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {isLoading && queueItems.length === 0 ? (
            <div className="loading-state">
              <p>LOADING</p>
            </div>
          ) : (
            <>
              {officialItems.length > 0 && (
                <div className="modal-section">
                  <h3 className="modal-section-title">Queued ({officialItems.length})</h3>
                  <div className="modal-list">
                    {officialItems.map((item) => (
                      <QueueItemRow
                        key={`queued-${item.index}`}
                        item={item}
                        onRemove={() => handleRemoveItem(item.index)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {unofficialItems.length > 0 && (
                <div className="modal-section">
                  <h3 className="modal-section-title">Currently Listening ({unofficialItems.length})</h3>
                  <div className="modal-list">
                    {unofficialItems.slice(0, 10).map((item) => (
                      <QueueItemRow
                        key={`upcoming-${item.index}`}
                        item={item}
                        onRemove={() => handleRemoveItem(item.index)}
                      />
                    ))}
                    {unofficialItems.length > 10 && (
                      <div className="modal-list-item">
                        <span className="item-title">... and {unofficialItems.length - 10} more songs</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {queueItems.length === 0 && !isLoading && (
                <div className="empty-state">
                  <p className="empty-state-hint">Add songs to get started!</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button 
            className="ui-panel-button ui-panel-button--secondary"
            onClick={handleClearQueue}
            disabled={isLoading || queueItems.length === 0}
          >
            Clear
          </button>
          <button className="ui-panel-button ui-panel-button--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface QueueItemRowProps {
  item: QueueItem;
  onRemove: () => void;
}

function QueueItemRow({ item, onRemove }: QueueItemRowProps) {
  // Use metadata from queue item directly
  const title = decodeHtmlEntities(item.title || 'Unknown Song');

  return (
    <div className="modal-list-item">
      <div className="item-info">
        <span className="item-title">{title}</span>
      </div>
      <button 
        className="item-remove"
        onClick={() => onRemove()}
        title="Remove from queue"
      >
        ×
      </button>
    </div>
  );
} 

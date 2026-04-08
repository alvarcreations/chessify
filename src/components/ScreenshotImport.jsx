import { useRef, useState } from 'react';

export default function ScreenshotImport({ onFenDetected, apiKey }) {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(file) {
    if (!file) return;

    if (!apiKey) {
      setError('API key required for screenshot import');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Read file as base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          // Strip the data URL prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mediaType = file.type || 'image/png';

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 256,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64,
                  },
                },
                {
                  type: 'text',
                  text: 'Look at this chess board screenshot. Return ONLY a valid FEN string representing this position. Include all 6 FEN fields (piece placement, active color, castling, en passant, halfmove, fullmove). If you can\'t determine the position, return ERROR.',
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text?.trim();

      if (!text || text === 'ERROR') {
        throw new Error('Could not detect position from screenshot');
      }

      onFenDetected(text);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />

      <div
        className="glass-inner"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'background var(--transition-fast)',
        }}
      >
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Detecting position...
          </div>
        ) : (
          <>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>
              Drop a board screenshot or click to upload
            </div>
            <div className="label" style={{ fontSize: 10 }}>
              Uses Claude Vision to detect position
            </div>
          </>
        )}
      </div>

      {error && (
        <div
          style={{
            color: 'var(--color-bad)',
            fontSize: 12,
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

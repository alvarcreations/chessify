import { useRef, useState } from 'react';
import { sanitizeFen } from '../utils/fen';

async function resizeImage(file, maxDim = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Only resize if larger than maxDim or file > 4MB
      if (width <= maxDim && height <= maxDim && file.size <= 4 * 1024 * 1024) {
        // Small enough — use original
        const reader = new FileReader();
        reader.onload = () => resolve({
          base64: reader.result.split(',')[1],
          mediaType: file.type || 'image/png',
        });
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      // Scale down
      const scale = Math.min(maxDim / width, maxDim / height, 1);
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({
        base64: dataUrl.split(',')[1],
        mediaType: 'image/jpeg',
      });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

const MODELS = [
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-sonnet-20240229',
];

const PROMPT = 'Look at this chess board screenshot. Return ONLY a valid FEN string representing this position. Include all 6 FEN fields (piece placement, active color, castling, en passant, halfmove, fullmove). For the active color field: examine any visible UI (clocks, move indicators, highlighted squares, arrows) to determine whose turn it is — use "w" for white and "b" for black. If you cannot determine whose turn it is, use "w". If you cannot detect a chess board at all, return ERROR.';

async function callVisionApi(apiKey, base64, mediaType, model) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    const errMsg = errBody?.error?.message || `HTTP ${response.status}`;
    throw new Error(errMsg);
  }

  const data = await response.json();
  return data.content?.[0]?.text?.trim();
}

export default function ScreenshotImport({ onFenDetected, apiKey }) {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  async function handleFile(file) {
    if (!file) return;

    if (!apiKey) {
      setError('API key required for screenshot import');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Resize large images to stay under API 5MB limit
      const { base64, mediaType } = await resizeImage(file, 1200);

      // Try models in order until one works
      let text = null;
      let lastErr = null;
      for (const model of MODELS) {
        try {
          text = await callVisionApi(apiKey, base64, mediaType, model);
          break;
        } catch (err) {
          lastErr = err;
          // If it's a model-not-found or invalid-model error, try next
          if (err.message.includes('model') || err.message.includes('not_found') || err.message.includes('invalid')) {
            continue;
          }
          // For other errors (auth, rate limit), don't retry
          throw err;
        }
      }

      if (!text) {
        throw new Error(lastErr?.message || 'All models failed');
      }

      if (text === 'ERROR') {
        throw new Error('Could not detect position from screenshot');
      }

      const cleaned = sanitizeFen(text);
      if (!cleaned) {
        throw new Error(`Could not parse FEN from response: ${text.slice(0, 80)}`);
      }

      setSuccess('Position detected');
      onFenDetected(cleaned);
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
            <span className="pulse-dot" />
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
        <div style={{ color: 'var(--color-bad)', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
          {error}
        </div>
      )}
      {success && !error && (
        <div style={{ color: 'var(--color-good)', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
          {success}
        </div>
      )}
    </div>
  );
}

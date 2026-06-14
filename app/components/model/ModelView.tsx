'use client';

import { useState, useEffect } from 'react';

/* ── Band Split: vertical EQ-style frequency spectrum ── */
const BAND_GROUPS = [
  { hz: '0-80', bands: 2, label: 'Low' },
  { hz: '80-250', bands: 12, label: '' },
  { hz: '250-500', bands: 12, label: '' },
  { hz: '500-2k', bands: 20, label: 'Vocals' },
  { hz: '2k-4k', bands: 12, label: '' },
  { hz: '4k-8k', bands: 8, label: '' },
  { hz: '8k-22k', bands: 6, label: 'High' },
];

function useIsMobile(breakpoint = 600) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

function BandSplitGraphic() {
  const isMobile = useIsMobile();
  const scale = isMobile ? 0.4 : 1;
  const groups = BAND_GROUPS.map(g => ({ ...g, bands: Math.max(1, Math.round(g.bands * scale)) }));
  const max = Math.max(...groups.map(b => b.bands));
  // Expand each group into individual band columns for a denser look
  const columns: { height: number; formant: boolean; groupIdx: number }[] = [];
  groups.forEach((g, gi) => {
    for (let i = 0; i < g.bands; i++) {
      // Vary height slightly per column for organic feel
      const base = g.bands / max;
      const jitter = 0.85 + Math.sin(i * 2.7 + gi * 4.1) * 0.15;
      columns.push({ height: base * jitter, formant: g.hz === '500-2k', groupIdx: gi });
    }
  });

  return (
    <div className="vis-spectrum">
      <div className="vis-spectrum-bars">
        {columns.map((col, i) => (
          <div
            key={i}
            className={`vis-spectrum-col${col.formant ? ' vis-spectrum-highlight' : ''}`}
            style={{ height: `${col.height * 100}%` }}
          />
        ))}
      </div>
      <div className="vis-spectrum-labels">
        {groups.map((g, i) => (
          <span key={i} style={{ flex: g.bands }}>{g.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ── U-Net: U-shaped block diagram ── */
function UNetGraphic() {
  return (
    <div className="vis-u">
      <div className="vis-u-each-band">For each frequency band:</div>
      <div className="vis-u-labels">
        <span>ENCODER</span>
        <span>DECODER</span>
      </div>
      <div className="vis-u-diagram">
        {/* Encoder column */}
        <div className="vis-u-col">
          <div className="vis-u-block vis-u-enc" style={{ width: '100%' }}>T</div>
          <div className="vis-u-arrow">&darr; 2x</div>
          <div className="vis-u-block vis-u-enc" style={{ width: '75%' }}>T/2</div>
          <div className="vis-u-arrow">&darr; 2x</div>
          <div className="vis-u-block vis-u-enc" style={{ width: '50%' }}>T/4</div>
          <div className="vis-u-arrow">&darr; 2x</div>
        </div>

        {/* Skip connections */}
        <div className="vis-u-skips">
          <div className="vis-u-skip-row" style={{ top: '6%' }}>
            <div className="vis-u-skip-line" /><span>skip</span><div className="vis-u-skip-line" />
          </div>
          <div className="vis-u-skip-row" style={{ top: '32%' }}>
            <div className="vis-u-skip-line" /><span>skip</span><div className="vis-u-skip-line" />
          </div>
          <div className="vis-u-skip-row" style={{ top: '58%' }}>
            <div className="vis-u-skip-line" /><span>skip</span><div className="vis-u-skip-line" />
          </div>
        </div>

        {/* Decoder column */}
        <div className="vis-u-col vis-u-col-dec">
          <div className="vis-u-block vis-u-dec" style={{ width: '100%' }}>T</div>
          <div className="vis-u-arrow">&uarr; 2x</div>
          <div className="vis-u-block vis-u-dec" style={{ width: '75%' }}>T/2</div>
          <div className="vis-u-arrow">&uarr; 2x</div>
          <div className="vis-u-block vis-u-dec" style={{ width: '50%' }}>T/4</div>
          <div className="vis-u-arrow">&uarr; 2x</div>
        </div>
      </div>

      {/* Bottleneck hint */}
      <div style={{ textAlign: 'center', color: 'var(--color-text-dim)', fontSize: '14px', letterSpacing: '4px', margin: '6px 0' }}>...</div>

      <div className="vis-u-comp-labels">
        <span>BiMamba &times; 72</span>
        <span></span>
        <span>Cross-Attn &times; 72</span>
      </div>
    </div>
  );
}

/* ── Bottleneck: 72 bands → 1 sequence ── */
function BottleneckGraphic() {
  const bandCount = 16; // visual representation of 72 bands
  return (
    <div className="vis-bn">
      <div className="vis-bn-dashes">
        {Array.from({ length: bandCount }).map((_, i) => (
          <div key={i} className="vis-bn-dash" />
        ))}
      </div>
      <div className="vis-bn-label-top">72 bands &times; T/8</div>
      <div className="vis-bn-arrow">&darr;</div>
      <div className="vis-bn-solid">
        {Array.from({ length: bandCount }).map((_, i) => (
          <div key={i} className="vis-bn-solid-block" />
        ))}
      </div>
      <div className="vis-bn-label-bottom">
        1 sequence &rarr; Mamba &rarr; Attn &rarr; Mamba &rarr; Attn
      </div>
    </div>
  );
}

/* ── Mask: pixel heatmap grids ── */
// Generate a fake mini-spectrogram (10 freq bins × 16 time steps)
function generateSpectrogram() {
  const rows = 10;
  const cols = 16;
  const grid: number[][] = [];
  for (let f = 0; f < rows; f++) {
    const row: number[] = [];
    for (let t = 0; t < cols; t++) {
      // Higher energy in mid frequencies, with some temporal variation
      const freqEnergy = 1 - Math.abs(f - 4) / 6;
      const timeVar = 0.6 + 0.4 * Math.sin(t * 0.8 + f * 0.5);
      row.push(Math.max(0.05, Math.min(1, freqEnergy * timeVar)));
    }
    grid.push(row);
  }
  return grid;
}

function generateMask() {
  const rows = 10;
  const cols = 16;
  const grid: number[][] = [];
  for (let f = 0; f < rows; f++) {
    const row: number[] = [];
    for (let t = 0; t < cols; t++) {
      // Vocals concentrated in mid freqs (f=3-6), mask should suppress those
      const isVocalFreq = f >= 3 && f <= 6;
      const vocalPresence = isVocalFreq ? 0.7 + 0.3 * Math.sin(t * 1.2) : 0.1;
      // Mask: 1 = keep (instrument), 0 = suppress (vocal)
      row.push(Math.max(0, Math.min(1, 1 - vocalPresence)));
    }
    grid.push(row);
  }
  return grid;
}

const SPEC = generateSpectrogram();
const MASK = generateMask();

function HeatmapGrid({ data, colorFn }: { data: number[][]; colorFn: (v: number) => string }) {
  return (
    <div className="vis-heatmap">
      {data.map((row, f) => (
        <div key={f} className="vis-heatmap-row">
          {row.map((val, t) => (
            <div
              key={t}
              className="vis-heatmap-cell"
              style={{ background: colorFn(val) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function MaskGraphic() {
  const result = SPEC.map((row, f) => row.map((val, t) => val * MASK[f][t]));

  return (
    <div className="vis-mask-container">
      <div className="vis-mask-grid-group">
        <span className="vis-mask-grid-label">ORIGINAL</span>
        <HeatmapGrid data={SPEC} colorFn={v => `rgba(var(--model-heatmap-rgb), ${v * 0.8})`} />
      </div>
      <span className="vis-mask-op">&times;</span>
      <div className="vis-mask-grid-group">
        <span className="vis-mask-grid-label">MASK</span>
        <HeatmapGrid data={MASK} colorFn={v => `rgba(var(--model-heatmap-rgb), ${v * 0.7})`} />
      </div>
      <span className="vis-mask-op">=</span>
      <div className="vis-mask-grid-group">
        <span className="vis-mask-grid-label">RESULT</span>
        <HeatmapGrid data={result} colorFn={v => `rgba(var(--model-heatmap-rgb), ${v * 0.9})`} />
      </div>
    </div>
  );
}

export function ModelView() {
  return (
    <div className="model-container no-scrollbar">
      <style jsx>{`
        .model-container {
          padding: 16px 0 4px;
          display: flex;
          flex-direction: column;
          gap: 0;
          max-height: calc(100vh - 250px);
          overflow-y: auto;
          padding-right: 4px;
        }
        .model-container p {
          font-size: 12px;
          color: var(--model-copy-color);
          margin: 6px 0;
          line-height: 1.7;
        }
        .model-container em {
          color: var(--model-copy-strong);
          font-style: normal;
        }
        .model-section {
          font-size: 12px;
          letter-spacing: 1px;
          color: var(--model-section-color);
          margin: 36px 0 10px 0;
          font-weight: normal;
        }
        .model-section:first-child {
          margin-top: 0;
        }
        .model-container a {
          color: var(--model-link-color);
          text-decoration: none;
          border-bottom: 1px solid var(--color-border);
        }
        .model-container a:hover {
          color: var(--model-link-hover);
        }
        .refs {
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1px solid var(--color-border);
        }
        .refs p {
          font-size: 11px;
          color: var(--model-ref-color);
        }
        @media (max-width: 768px) {
          .model-container {
            max-height: calc(100dvh - var(--player-height) - 150px);
          }
        }
      `}</style>

      <h3 className="model-section">OVERVIEW</h3>
      <p>The model is a <em>band-split BiMamba U-Net</em>. Frequency bins are grouped into non-uniform bands (<a href="https://arxiv.org/abs/2209.15174" target="_blank" rel="noopener noreferrer">BSRNN</a>), processed by a U-Net encoder-decoder with bidirectional <a href="https://arxiv.org/abs/2312.00752" target="_blank" rel="noopener noreferrer">Mamba</a> in the encoder at O(T), interleaved Mamba + self-attention in the smallest layer (<a href="https://arxiv.org/abs/2403.19887" target="_blank" rel="noopener noreferrer">Jamba</a>-style), and cross-attention in the decoder. The model predicts a mask over the input spectrogram to isolate instrumentals.</p>

      <p>Trained for <em>~3 days on an A40</em> on <em>~1000 songs</em>.</p>

      <h3 className="model-section">BAND SPLIT</h3>
      <p>A 2048-point STFT gives 1025 frequency bins. We then group them into <em>72 non-uniform bands</em> &mdash; denser where <em>vocals</em> live.</p>

      <BandSplitGraphic />

      <h3 className="model-section">U-NET</h3>
      <p><em>3 encoder levels</em>, each <em>downsampling time by 2x</em>. By the bottleneck, temporal resolution is <em>T/8</em>. This <em>8x compression destroys temporal detail</em> needed to cleanly separate things like drum hits and plucks. We solve this via <em>skip connections</em> &mdash; snapshotting each compression level for reference later, instead of permanently downsizing them.</p>

      <UNetGraphic />

      <h3 className="model-section">MAMBA ENCODER</h3>
      <p>Self-attention compares every timestep against every other timestep, requiring a <em>T&times;T matrix</em> &mdash; <em>O(T&sup2;) memory</em>. At the upper U-Net levels T is hundreds of frames, making this <em>infeasible</em>.</p>
      <p><a href="https://arxiv.org/abs/2312.00752" target="_blank" rel="noopener noreferrer">Mamba</a> instead scans through time and compresses what it&rsquo;s seen into a small state &mdash; <em>O(T) memory</em>, no matrix needed. We run it bidirectionally following <a href="https://arxiv.org/abs/2508.14556" target="_blank" rel="noopener noreferrer">BiMamba-S</a>&rsquo;s success. This is because a <em>forward-only scan</em> at position t is <em>blind to everything after t</em>, so we run a <em>second pass backward</em> and combine both.</p>

      <h3 className="model-section">BOTTLENECK</h3>
      <p>Up to this point, the encoder is essentially <em>72 parallel mini-UNETs</em> &mdash; each frequency band compresses independently along time, blind to what the other bands are doing. Now we <em>combine them all into one sequence</em>, enabling high and low frequencies to be aware of each other.</p>
      <p>We had not touched attention until now because attention is <em>O(T&sup2;)</em> and the sequences were too long to afford it. At <em>T/8</em>, the sequence is finally <em>short enough</em>, even with all frequency bands mixed into the picture. It wouldn&rsquo;t be as useful without cross-frequency-band and cross-time awareness. <em>Layers alternate Mamba &rarr; Attention</em> (<a href="https://arxiv.org/abs/2403.19887" target="_blank" rel="noopener noreferrer">Jamba</a>-style). They play into each other&rsquo;s strengths: Mamba scans left to right so it inherently understands <em>order and timing</em> via its internal compressed state, but can lose details. Attention has <em>no built-in sense of position</em>, but can see everything uncompressed at once &mdash; catching things like a chorus at t=10 matching a chorus at t=200.</p>

      <BottleneckGraphic />

      <h3 className="model-section">MEMORY BANK</h3>
      <p>The decoder needs to reconstruct full-resolution audio from a compressed T/8 signal. It has skip connections, but those carry the raw mixture. We need a way for the decoder to reference what the encoder <em>learned</em>, not just what it saw.</p>

      <p>As the encoder compresses through each level (T, T/2, T/4, T/8), we pool each level&rsquo;s output into averaged snapshots &mdash; each summarizing a chunk of consecutive time frames. The decoder <em>similarity-matches</em> against these via dot products: high dot product means relevant, and the result is a weighted blend of matching information. Audio is fairly <em>positionally agnostic</em> &mdash; a chord sounds the same wherever it appears &mdash; so similarity matching works well at the <em>4-second chunk</em> precision we process.</p>

      <h3 className="model-section">DECODER</h3>
      <p>The decoder upsamples the bottleneck from T/8 back to T. At each level it receives <em>skip connections</em> (the encoder&rsquo;s full-resolution output, gated by a learned sigmoid since it still contains vocals), plus the <em>memory bank</em> blend from cross-attention. With these combined, the decoder passes through feed-forward layers (SwiGLU) at each level.</p>

      <h3 className="model-section">MASK</h3>
      <p>BandMerge projects the 72-band decoder output back to 1025 frequency bins. The mask is multiplied element-wise against the original STFT, then inverted back to audio. <em>Masking produces fewer artifacts</em> than predicting raw audio frequencies &mdash; the original spectrogram provides the structure, and the model only decides what to keep.</p>

      <MaskGraphic />

      <div className="refs">
        <h3 className="model-section">REFERENCES</h3>
        <p><a href="https://arxiv.org/abs/2211.08553" target="_blank" rel="noopener noreferrer">Hybrid Transformers for Music Source Separation</a> (Rouard et al., 2022) &mdash; U-Net with transformers</p>
        <p><a href="https://arxiv.org/abs/2209.15174" target="_blank" rel="noopener noreferrer">BSRNN</a> (Luo &amp; Yu, 2022) &mdash; Band-split RNN, dual-path band/sequence modeling</p>
        <p><a href="https://arxiv.org/abs/2312.00752" target="_blank" rel="noopener noreferrer">Mamba</a> (Gu &amp; Dao, 2023) &mdash; Linear-time sequence modeling via state spaces</p>
        <p><a href="https://arxiv.org/abs/2403.19887" target="_blank" rel="noopener noreferrer">Jamba</a> (Lieber et al., 2024) &mdash; Hybrid Transformer-Mamba architecture</p>
        <p><a href="https://arxiv.org/abs/2508.14556" target="_blank" rel="noopener noreferrer">BiMamba-S</a> (Kim &amp; Choi, 2025) &mdash; Mamba2 for vocal source separation</p>
        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0 12px' }} />
        <p><a href="https://github.com/instr-io/ml" target="_blank" rel="noopener noreferrer">instr.io</a> is a project by Rona Fang</p>
      </div>
    </div>
  );
}

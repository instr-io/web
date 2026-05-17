'use client';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function Slider({ value, onChange }: SliderProps) {
  return (
    <div className="slider-container">
      <div className="slider-track">
        <div className="slider-fill" style={{ width: `${value * 100}%` }} />
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.001"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="slider-input"
      />
    </div>
  );
}

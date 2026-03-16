export const POLYFORGE_CHART_DEFAULTS = {
  color: ['#06B6D4', '#10B981', '#EF4444', '#F59E0B', '#3B82F6'],
  plugins: {
    legend: {
      labels: {
        color:   '#7A94B4',
        font:    { family: "'Outfit', sans-serif", size: 12 },
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: '#111D2E',
      titleColor:      '#E8EDF5',
      bodyColor:       '#7A94B4',
      borderColor:     '#1E3350',
      borderWidth:     1,
      padding:         12,
      cornerRadius:    6,
      titleFont:       { family: "'Outfit', sans-serif", size: 13, weight: '600' },
      bodyFont:        { family: "'JetBrains Mono', monospace", size: 12 },
    },
  },
  scales: {
    x: {
      grid:  { color: '#1A2840' },
      ticks: { color: '#445E7A', font: { family: "'JetBrains Mono', monospace", size: 11 } },
    },
    y: {
      grid:  { color: '#1A2840' },
      ticks: { color: '#445E7A', font: { family: "'JetBrains Mono', monospace", size: 11 } },
    },
  },
};
